import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { aadFor, decryptBytes, encryptBytes } from "./crypto.ts";

// Evidence files live ENCRYPTED under EVIDENCE_DIR — never UPLOADS_DIR (which the public
// /uploads route serves) and never anything Caddy serves. The only way out is the
// tenant-gated dashboard download route.

export const evidenceDir = () =>
  path.resolve(process.env.EVIDENCE_DIR || "./evidence");

const uploadsRoot = () => path.resolve(process.env.UPLOADS_DIR || "./uploads");

/** True when `child` is `parent` or inside it. */
const inside = (parent: string, child: string) => {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
};

/** Refuses to run if evidence could end up in (or above) the publicly served uploads dir. */
export function assertEvidenceDirSeparate() {
  const e = evidenceDir();
  const u = uploadsRoot();
  if (inside(u, e) || inside(e, u))
    throw new Error("EVIDENCE_DIR must be separate from UPLOADS_DIR");
}

export const EVIDENCE_FILE = /^[a-f0-9]{32}\.enc$/;

/** The AAD field for a file: binds the bytes to their evidence row. */
export const evidenceField = (evidenceId: string) => `file:${evidenceId}`;
const AAD_TABLE = "whistleblower_evidence";

/** Encrypts and writes one file under a random server-chosen name (wx: never overwrites). */
export async function writeEvidenceFile(
  companyId: string,
  evidenceId: string,
  bytes: Uint8Array,
): Promise<string> {
  assertEvidenceDirSeparate();
  const fileName = `${randomBytes(16).toString("hex")}.enc`;
  await mkdir(evidenceDir(), { recursive: true });
  const sealed = encryptBytes(
    bytes,
    aadFor(AAD_TABLE, companyId, evidenceField(evidenceId)),
  );
  await writeFile(path.join(evidenceDir(), fileName), sealed, {
    flag: "wx",
    mode: 0o600,
  });
  return fileName;
}

export async function readEvidenceFile(
  companyId: string,
  evidenceId: string,
  fileName: string,
): Promise<Buffer | null> {
  if (!EVIDENCE_FILE.test(fileName)) return null;
  let sealed: string;
  try {
    sealed = await readFile(path.join(evidenceDir(), fileName), "utf8");
  } catch {
    return null;
  }
  return decryptBytes(
    sealed,
    aadFor(AAD_TABLE, companyId, evidenceField(evidenceId)),
  );
}

export async function removeEvidenceFiles(fileNames: string[]) {
  await Promise.all(
    fileNames
      .filter((n) => EVIDENCE_FILE.test(n))
      .map((n) => rm(path.join(evidenceDir(), n), { force: true })),
  );
}
