// @vitest-environment node
import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  aadFor,
  currentKeyId,
  decryptText,
  encryptText,
  keyIdOf,
  parseKeyRing,
} from "@/lib/whistleblower/crypto";
import { createLimiter } from "@/lib/whistleblower/rate-limit";
import { slugify, withSuffix } from "@/lib/whistleblower/slug";
import {
  CODE_ALPHABET,
  formatTrackingCode,
  generateTrackingCode,
  normalizeTrackingCode,
} from "@/lib/whistleblower/tracking-code";

const ORIGINAL = process.env.REPORT_ENCRYPTION_KEYS;
afterEach(() => {
  process.env.REPORT_ENCRYPTION_KEYS = ORIGINAL;
});
const newKey = () => randomBytes(32).toString("base64");
const AAD = aadFor("whistleblower_reports", "company-a", "description");

describe("whistleblower crypto (AES-256-GCM)", () => {
  it("round-trips, with the key id in the ciphertext and a fresh IV every time", () => {
    const a = encryptText("denúncia confidencial ✓", AAD);
    const b = encryptText("denúncia confidencial ✓", AAD);
    expect(a).toMatch(/^vt1:[^:]+:[^:]+:[^:]+$/);
    expect(a).not.toBe(b);
    expect(a).not.toContain("confidencial");
    expect(keyIdOf(a)).toBe("t1");
    expect(decryptText(a, AAD)).toBe("denúncia confidencial ✓");
    expect(decryptText(b, AAD)).toBe("denúncia confidencial ✓");
  });

  it("a tampered ciphertext, tag or iv throws", () => {
    const [v, iv, tag, ct] = encryptText("secret", AAD).split(":");
    const flip = (b64: string) => {
      const buf = Buffer.from(b64, "base64");
      buf[0] ^= 1;
      return buf.toString("base64");
    };
    expect(() => decryptText([v, iv, tag, flip(ct)].join(":"), AAD)).toThrow();
    expect(() => decryptText([v, iv, flip(tag), ct].join(":"), AAD)).toThrow();
    expect(() => decryptText([v, flip(iv), tag, ct].join(":"), AAD)).toThrow();
    expect(() => decryptText("not-encrypted", AAD)).toThrow();
  });

  it("AAD binds the ciphertext to its company and field: moved elsewhere it fails to decrypt", () => {
    const sealed = encryptText("secret", AAD);
    const otherTenant = aadFor(
      "whistleblower_reports",
      "company-b",
      "description",
    );
    const otherField = aadFor(
      "whistleblower_reports",
      "company-a",
      "reporter_contact",
    );
    const otherTable = aadFor(
      "whistleblower_notes",
      "company-a",
      "description",
    );
    for (const aad of [otherTenant, otherField, otherTable])
      expect(() => decryptText(sealed, aad)).toThrow();
  });

  it("rotation: encrypt with key1; with key2 first, old values still decrypt and new ones use key2", () => {
    const k1 = newKey();
    const k2 = newKey();
    process.env.REPORT_ENCRYPTION_KEYS = `a:${k1}`;
    const old = encryptText("old", AAD);
    expect(keyIdOf(old)).toBe("a");
    process.env.REPORT_ENCRYPTION_KEYS = `b:${k2},a:${k1}`;
    expect(currentKeyId()).toBe("b");
    expect(decryptText(old, AAD)).toBe("old");
    const fresh = encryptText("new", AAD);
    expect(keyIdOf(fresh)).toBe("b");
    // dropping the old key: old values become undecryptable (clear error), new ones are fine
    process.env.REPORT_ENCRYPTION_KEYS = `b:${k2}`;
    expect(() => decryptText(old, AAD)).toThrow(/not configured/);
    expect(decryptText(fresh, AAD)).toBe("new");
  });

  it("a missing, empty, malformed or short key throws a clear error — never a default key or plaintext", () => {
    for (const bad of [
      undefined,
      "",
      "   ",
      "nocolon",
      `x:${Buffer.alloc(16).toString("base64")}`, // 16 bytes
      `x:${Buffer.alloc(33).toString("base64")}`, // 33 bytes
      "x:not base64!!",
      `bad id:${newKey()}`,
      `a:${newKey()},a:${newKey()}`, // duplicate id
    ]) {
      if (bad === undefined) delete process.env.REPORT_ENCRYPTION_KEYS;
      else process.env.REPORT_ENCRYPTION_KEYS = bad;
      expect(() => encryptText("x", AAD), String(bad)).toThrow(
        /REPORT_ENCRYPTION_KEYS/,
      );
    }
    expect(() => parseKeyRing(`k:${newKey()}`)).not.toThrow();
  });
});

describe("company slug", () => {
  it("strips accents, lowercases, keeps [a-z0-9-], caps the length, never returns empty", () => {
    expect(slugify("Construções São João Ltda.")).toBe(
      "construcoes-sao-joao-ltda",
    );
    expect(slugify("  ACME & Filhos — S/A  ")).toBe("acme-filhos-s-a");
    expect(slugify("Ñandú Ünïcode")).toBe("nandu-unicode");
    expect(slugify("!!!")).toBe("empresa");
    expect(slugify("日本語")).toBe("empresa");
    const long = slugify("a".repeat(30) + " " + "b".repeat(30));
    expect(long.length).toBeLessThanOrEqual(40);
    expect(long).not.toMatch(/-$/);
    expect(slugify("x".repeat(100)).length).toBe(40);
  });

  it("collision suffix is '-' + 4 chars from [a-z0-9]", () => {
    for (let i = 0; i < 50; i++)
      expect(withSuffix("acme")).toMatch(/^acme-[a-z0-9]{4}$/);
  });
});

describe("tracking code", () => {
  it("is 12 characters from the unambiguous alphabet, and varies", () => {
    expect(CODE_ALPHABET).not.toMatch(/[01OIL]/);
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const c = generateTrackingCode();
      expect(c).toMatch(new RegExp(`^[${CODE_ALPHABET}]{12}$`));
      seen.add(c);
    }
    expect(seen.size).toBe(500);
  });

  it("is displayed XXXX-XXXX-XXXX and normalised back (spaces, dashes, case)", () => {
    const c = generateTrackingCode();
    const shown = formatTrackingCode(c);
    expect(shown).toMatch(/^\w{4}-\w{4}-\w{4}$/);
    expect(normalizeTrackingCode(shown)).toBe(c);
    expect(normalizeTrackingCode(shown.toLowerCase().replace(/-/g, " "))).toBe(
      c,
    );
    expect(normalizeTrackingCode(` ${shown} `)).toBe(c);
  });

  it("malformed input normalises to null (wrong length, excluded letters, non-strings)", () => {
    for (const bad of [
      "",
      "ABC",
      "ABCD-EFGH-IJKL",
      "0000-0000-0000",
      "AAAA-AAAA-AAAA-A",
      null,
      12,
      {},
      "A".repeat(100),
    ])
      expect(normalizeTrackingCode(bad)).toBeNull();
  });
});

describe("rate limiter (in memory, keyed by slug)", () => {
  it("allows `max` per window, then refuses; resets after the window", () => {
    const l = createLimiter(3, 1000);
    expect([1, 2, 3, 4, 5].map(() => l.hit("a", 0))).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
    expect(l.hit("a", 999)).toBe(false);
    expect(l.hit("a", 1000)).toBe(true);
  });

  it("keys are isolated from each other", () => {
    const l = createLimiter(1, 1000);
    expect(l.hit("a", 0)).toBe(true);
    expect(l.hit("a", 1)).toBe(false);
    expect(l.hit("b", 1)).toBe(true);
  });
});
