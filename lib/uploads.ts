import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_LOGO_BYTES = 1024 * 1024;

export const uploadsDir = () =>
  path.resolve(process.env.UPLOADS_DIR || "./uploads");

const TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp", // legacy: served if present, never accepted (react-pdf cannot embed WebP)
} as const;
/** Extensions a new upload may have: PNG/JPEG only, so the logo can be embedded in PDFs. */
type Ext = "png" | "jpg";

/** Magic-byte sniff. SVG (and anything else) is deliberately not accepted. */
export function sniffImage(buf: Uint8Array): Ext | null {
  const b = (...xs: number[]) => xs.every((x, i) => buf[i] === x);
  if (buf.length >= 8 && b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return "png";
  if (buf.length >= 3 && b(0xff, 0xd8, 0xff)) return "jpg";
  return null;
}

export type LogoResult = { ok: true; file: string } | { ok: false };

/** Validates and stores a logo under a random server-chosen name. The client's name/type are never used. */
export async function saveLogo(bytes: Uint8Array): Promise<LogoResult> {
  if (bytes.length === 0 || bytes.length > MAX_LOGO_BYTES) return { ok: false };
  const ext = sniffImage(bytes);
  if (!ext) return { ok: false };
  const file = `${randomBytes(16).toString("hex")}.${ext}`;
  await mkdir(uploadsDir(), { recursive: true });
  await writeFile(path.join(uploadsDir(), file), bytes, { flag: "wx" });
  return { ok: true, file };
}

export const UPLOAD_NAME = /^[a-f0-9]{32}\.(png|jpg|webp)$/;

export function contentTypeFor(name: string): string | null {
  const m = UPLOAD_NAME.exec(name);
  return m ? TYPES[m[1] as keyof typeof TYPES] : null;
}

export async function readUpload(name: string): Promise<Buffer | null> {
  if (!UPLOAD_NAME.test(name)) return null;
  try {
    return await readFile(path.join(uploadsDir(), name));
  } catch {
    return null;
  }
}
