import { crc32 } from "node:zlib";

// Metadata stripping for evidence images. Pure functions, no dependency. Both return null when
// the file cannot be parsed cleanly end to end — the caller rejects such a file (never stores it).
//   JPEG: keep image data only — drop every APPn (EXIF, XMP, ICC, JFIF, ...) and COM segment,
//         and anything after EOI.
//   PNG:  keep IHDR, PLTE, IDAT, IEND and tRNS; drop eXIf, tEXt, iTXt, zTXt, tIME, ... and
//         anything after IEND.

const u16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32 = (b: Uint8Array, i: number) =>
  ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;

export function stripJpeg(buf: Uint8Array): Uint8Array | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  const out: Uint8Array[] = [buf.subarray(0, 2)];
  let pos = 2;
  let sawFrame = false;
  let sawScan = false;
  while (pos < buf.length) {
    if (buf[pos] !== 0xff) return null;
    while (buf[pos] === 0xff && pos + 1 < buf.length) pos++; // fill bytes
    const marker = buf[pos++];
    if (marker === 0xd9) {
      out.push(Uint8Array.of(0xff, 0xd9));
      return sawFrame && sawScan ? Buffer.concat(out) : null;
    }
    if (
      marker === 0x00 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd8)
    )
      return null; // stand-alone markers have no business outside entropy data
    if (pos + 2 > buf.length) return null;
    const len = u16(buf, pos);
    if (len < 2 || pos + len > buf.length) return null;
    const segment = buf.subarray(pos - 2, pos + len); // 0xFF marker + length + payload
    pos += len;
    const isMeta = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
    if (!isMeta) out.push(segment);
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker)
    )
      sawFrame = true;
    if (marker === 0xda) {
      sawScan = true;
      // Entropy-coded data: runs to the next marker that is not a stuffed 0xFF00, an RSTn or fill.
      const start = pos;
      while (pos < buf.length) {
        if (buf[pos] === 0xff) {
          const n = buf[pos + 1];
          if (n === undefined) return null;
          if (n === 0x00 || (n >= 0xd0 && n <= 0xd7) || n === 0xff) {
            pos += n === 0xff ? 1 : 2;
            continue;
          }
          break;
        }
        pos++;
      }
      out.push(buf.subarray(start, pos));
    }
  }
  return null; // no EOI
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const KEEP = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS"]);

export function stripPng(buf: Uint8Array): Uint8Array | null {
  if (buf.length < 8 + 12 || !PNG_SIG.every((x, i) => buf[i] === x))
    return null;
  const out: Uint8Array[] = [buf.subarray(0, 8)];
  let pos = 8;
  let first = true;
  let sawIdat = false;
  while (pos + 12 <= buf.length) {
    const len = u32(buf, pos);
    const end = pos + 12 + len;
    if (len > 0x7fffffff || end > buf.length) return null;
    const type = Buffer.from(buf.subarray(pos + 4, pos + 8)).toString("latin1");
    if (!/^[A-Za-z]{4}$/.test(type)) return null;
    if (first && (type !== "IHDR" || len !== 13)) return null;
    first = false;
    if (crc32(buf.subarray(pos + 4, pos + 8 + len)) !== u32(buf, end - 4))
      return null;
    if (type === "IDAT") sawIdat = true;
    if (KEEP.has(type)) out.push(buf.subarray(pos, end));
    pos = end;
    if (type === "IEND")
      return sawIdat && len === 0 ? Buffer.concat(out) : null;
  }
  return null; // no IEND
}
