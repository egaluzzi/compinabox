import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM for whistleblower data at rest (SPEC §11). Output string:
//   v<keyId>:<base64 iv>:<base64 tag>:<base64 ciphertext>
// The AAD binds a ciphertext to "<table>:<company_id>:<field>", so a value copied to another
// tenant or column fails to decrypt. Keys come from REPORT_ENCRYPTION_KEYS (comma-separated
// `id:base64(32 bytes)`): the FIRST encrypts, all are accepted for decryption. There is no
// default key and no plaintext fallback: a missing or malformed key throws.

const KEY_ID = /^[A-Za-z0-9_-]{1,16}$/;
type KeyRing = {
  current: { id: string; key: Buffer };
  all: Map<string, Buffer>;
};

let cache: { raw: string; ring: KeyRing } | null = null;

export function parseKeyRing(raw: string | undefined): KeyRing {
  if (!raw || raw.trim() === "")
    throw new Error(
      "REPORT_ENCRYPTION_KEYS is not set: whistleblower data cannot be encrypted or decrypted",
    );
  const all = new Map<string, Buffer>();
  let current: KeyRing["current"] | null = null;
  for (const entry of raw.split(",")) {
    const i = entry.indexOf(":");
    const id = entry.slice(0, i).trim();
    const b64 = entry.slice(i + 1).trim();
    if (i < 0 || !KEY_ID.test(id))
      throw new Error(
        "REPORT_ENCRYPTION_KEYS is malformed: expected id:base64key[,id:base64key...]",
      );
    const key = Buffer.from(b64, "base64");
    if (key.length !== 32 || key.toString("base64") !== b64)
      throw new Error(
        `REPORT_ENCRYPTION_KEYS: key "${id}" is not valid base64 of exactly 32 bytes (openssl rand -base64 32)`,
      );
    if (all.has(id))
      throw new Error(`REPORT_ENCRYPTION_KEYS: duplicate key id "${id}"`);
    all.set(id, key);
    current ??= { id, key };
  }
  return { all, current: current! };
}

function ring(): KeyRing {
  const raw = process.env.REPORT_ENCRYPTION_KEYS ?? "";
  if (cache?.raw !== raw) cache = { raw, ring: parseKeyRing(raw) };
  return cache.ring;
}

/** The AAD for a column of a tenant row. `field` may carry a row id (evidence files do). */
export const aadFor = (table: string, companyId: string, field: string) =>
  `${table}:${companyId}:${field}`;

export function encryptBytes(plain: Uint8Array, aad: string): string {
  const { current } = ring();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", current.key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  return [
    `v${current.id}`,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ct.toString("base64"),
  ].join(":");
}

export function decryptBytes(value: string, aad: string): Buffer {
  const parts = value.split(":");
  if (parts.length !== 4 || !parts[0].startsWith("v"))
    throw new Error("not an encrypted value");
  const key = ring().all.get(parts[0].slice(1));
  if (!key) throw new Error("encryption key for this value is not configured");
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  if (iv.length !== 12 || tag.length !== 16)
    throw new Error("malformed encrypted value");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(Buffer.from(parts[3], "base64")),
    decipher.final(),
  ]);
}

export const encryptText = (plain: string, aad: string) =>
  encryptBytes(Buffer.from(plain, "utf8"), aad);
export const decryptText = (value: string, aad: string) =>
  decryptBytes(value, aad).toString("utf8");

/** Id of the key a stored value was encrypted with ("" if it is not in our format). */
export function keyIdOf(value: string): string {
  const head = value.split(":", 1)[0];
  return head.startsWith("v") ? head.slice(1) : "";
}

/** The id new values are encrypted under (the first configured key). */
export const currentKeyId = () => ring().current.id;
