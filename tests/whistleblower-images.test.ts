// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { crc32, deflateSync, inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { stripJpeg, stripPng } from "@/lib/whistleblower/image-strip";
import { sniffImage } from "@/lib/uploads";

const has = (buf: Uint8Array, marker: string) =>
  Buffer.from(buf).includes(Buffer.from(marker, "latin1"));

// --- PNG ------------------------------------------------------------------------------
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PIXELS = Buffer.from([0, 255, 0, 0]); // filter byte + one red RGB pixel
function png(
  extra: Record<string, Buffer> = {},
  opts: { trailing?: Buffer } = {},
) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    SIG,
    chunk("IHDR", ihdr),
    ...Object.entries(extra)
      .filter(([k]) => k !== "tRNS")
      .map(([k, v]) => chunk(k, v)),
    chunk("IDAT", deflateSync(PIXELS)),
    chunk("IEND", Buffer.alloc(0)),
    opts.trailing ?? Buffer.alloc(0),
  ]);
}
/** Well-formed walk + IDAT inflates back to the original pixels. */
function pngDecodes(buf: Uint8Array): string[] {
  const b = Buffer.from(buf);
  expect(b.subarray(0, 8).equals(SIG)).toBe(true);
  let pos = 8;
  const types: string[] = [];
  const idat: Buffer[] = [];
  while (pos < b.length) {
    const len = b.readUInt32BE(pos);
    const type = b.subarray(pos + 4, pos + 8).toString("latin1");
    const data = b.subarray(pos + 8, pos + 8 + len);
    expect(b.readUInt32BE(pos + 8 + len)).toBe(
      crc32(b.subarray(pos + 4, pos + 8 + len)),
    );
    if (type === "IDAT") idat.push(data);
    types.push(type);
    pos += 12 + len;
  }
  expect(pos).toBe(b.length);
  expect(inflateSync(Buffer.concat(idat)).equals(PIXELS)).toBe(true);
  return types;
}

describe("PNG metadata stripping", () => {
  it("drops eXIf (GPS), tEXt, iTXt, zTXt, tIME, gAMA and trailing data; keeps a decodable image", () => {
    const input = png(
      {
        eXIf: Buffer.from("MM\0*GPS-LATITUDE-MARKER", "latin1"),
        tEXt: Buffer.from("Comment\0TEXT-CHUNK-MARKER", "latin1"),
        iTXt: Buffer.from("XML:com.adobe.xmp\0\0\0\0\0ITXT-MARKER", "latin1"),
        zTXt: Buffer.concat([
          Buffer.from("k\0\0"),
          deflateSync(Buffer.from("ZTXT-MARKER")),
        ]),
        tIME: Buffer.from([7, 234, 10, 15, 1, 2, 3]),
        gAMA: Buffer.from([0, 1, 134, 160]),
      },
      { trailing: Buffer.from("TRAILING-MARKER") },
    );
    for (const m of [
      "GPS-LATITUDE-MARKER",
      "TEXT-CHUNK-MARKER",
      "ITXT-MARKER",
      "TRAILING-MARKER",
    ])
      expect(has(input, m)).toBe(true);
    const out = stripPng(input)!;
    expect(out).not.toBeNull();
    for (const m of [
      "GPS-LATITUDE-MARKER",
      "TEXT-CHUNK-MARKER",
      "ITXT-MARKER",
      "TRAILING-MARKER",
      "eXIf",
      "tEXt",
      "iTXt",
      "zTXt",
      "tIME",
    ])
      expect(has(out, m), m).toBe(false);
    expect(sniffImage(out)).toBe("png");
    expect(pngDecodes(out)).toEqual(["IHDR", "IDAT", "IEND"]);
    // idempotent
    expect(Buffer.from(stripPng(out)!).equals(Buffer.from(out))).toBe(true);
  });

  it("keeps PLTE and tRNS", () => {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(1, 0);
    ihdr.writeUInt32BE(1, 4);
    ihdr[8] = 8;
    ihdr[9] = 3;
    const input = Buffer.concat([
      SIG,
      chunk("IHDR", ihdr),
      chunk("tEXt", Buffer.from("a\0b")),
      chunk("PLTE", Buffer.from([1, 2, 3])),
      chunk("tRNS", Buffer.from([128])),
      chunk("IDAT", deflateSync(Buffer.from([0, 0]))),
      chunk("IEND", Buffer.alloc(0)),
    ]);
    const out = Buffer.from(stripPng(input)!);
    const types: string[] = [];
    for (let pos = 8; pos < out.length; pos += 12 + out.readUInt32BE(pos))
      types.push(out.subarray(pos + 4, pos + 8).toString("latin1"));
    expect(types).toEqual(["IHDR", "PLTE", "tRNS", "IDAT", "IEND"]);
  });

  it("rejects what it cannot parse cleanly: bad CRC, truncation, no IDAT, wrong first chunk, garbage", () => {
    const good = png();
    const badCrc = Buffer.from(good);
    badCrc[badCrc.length - 20] ^= 0xff; // inside IDAT crc area
    expect(stripPng(badCrc)).toBeNull();
    expect(stripPng(good.subarray(0, good.length - 5))).toBeNull(); // no IEND
    expect(
      stripPng(Buffer.concat([SIG, chunk("IEND", Buffer.alloc(0))])),
    ).toBeNull();
    expect(
      stripPng(
        Buffer.concat([
          SIG,
          chunk("tEXt", Buffer.from("a\0b")),
          chunk("IEND", Buffer.alloc(0)),
        ]),
      ),
    ).toBeNull();
    expect(stripPng(Buffer.from("not a png at all, just text"))).toBeNull();
    expect(
      stripPng(readFileSync(path.join(__dirname, "fixtures/logo.jpg"))),
    ).toBeNull();
  });

  it("the repository's real logo.png survives (decodes after stripping)", () => {
    const logo = readFileSync(path.join(__dirname, "fixtures/logo.png"));
    const out = stripPng(logo)!;
    expect(out).not.toBeNull();
    expect(sniffImage(out)).toBe("png");
  });
});

// --- JPEG -----------------------------------------------------------------------------
const seg = (marker: number, payload: Buffer) => {
  const len = Buffer.alloc(2);
  len.writeUInt16BE(payload.length + 2);
  return Buffer.concat([Buffer.from([0xff, marker]), len, payload]);
};
/** A structurally valid JPEG: SOI, optional metadata, DQT, SOF0, DHT, SOS + entropy data with stuffing/RST, EOI. */
function jpeg(meta: Buffer[] = [], trailing = Buffer.alloc(0)) {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    ...meta,
    seg(0xdb, Buffer.alloc(65, 1)),
    seg(0xc0, Buffer.from([8, 0, 1, 0, 1, 1, 1, 0x11, 0])),
    seg(0xc4, Buffer.from([0, ...Array(16).fill(0), 0])),
    seg(0xda, Buffer.from([1, 1, 0, 0, 63, 0])),
    Buffer.from([
      0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0xff, 0xff, 0x00, 0x78,
    ]), // stuffing, RST0, fill
    Buffer.from([0xff, 0xd9]),
    trailing,
  ]);
}
/** Well-formed walk: returns the marker sequence. */
function jpegMarkers(buf: Uint8Array): number[] {
  const b = Buffer.from(buf);
  expect([b[0], b[1]]).toEqual([0xff, 0xd8]);
  const out: number[] = [0xd8];
  let pos = 2;
  while (pos < b.length) {
    expect(b[pos]).toBe(0xff);
    const m = b[pos + 1];
    out.push(m);
    if (m === 0xd9) {
      expect(pos + 2).toBe(b.length);
      return out;
    }
    pos += 2 + b.readUInt16BE(pos + 2);
    if (m === 0xda)
      while (!(
        b[pos] === 0xff &&
        b[pos + 1] !== 0x00 &&
        !(b[pos + 1] >= 0xd0 && b[pos + 1] <= 0xd7) &&
        b[pos + 1] !== 0xff
      ))
        pos++;
  }
  throw new Error("no EOI");
}

describe("JPEG metadata stripping", () => {
  const exif = seg(
    0xe1,
    Buffer.from("Exif\0\0MM\0*GPS-LATITUDE-MARKER", "latin1"),
  );
  const xmp = seg(
    0xe1,
    Buffer.from("http://ns.adobe.com/xap/1.0/\0XMP-MARKER", "latin1"),
  );
  const icc = seg(0xe2, Buffer.from("ICC_PROFILE\0ICC-MARKER", "latin1"));
  const jfif = seg(
    0xe0,
    Buffer.from("JFIF\0\x01\x01\0\0\x01\0\x01\0\0", "latin1"),
  );
  const com = seg(0xfe, Buffer.from("COMMENT-MARKER"));

  it("drops every APPn (EXIF/GPS, XMP, ICC, JFIF), COM and trailing data; image segments stay", () => {
    const input = jpeg(
      [jfif, exif, xmp, icc, com],
      Buffer.from("TRAILING-MARKER"),
    );
    for (const m of [
      "GPS-LATITUDE-MARKER",
      "XMP-MARKER",
      "ICC-MARKER",
      "COMMENT-MARKER",
      "TRAILING-MARKER",
    ])
      expect(has(input, m)).toBe(true);
    const out = stripJpeg(input)!;
    expect(out).not.toBeNull();
    for (const m of [
      "Exif",
      "GPS-LATITUDE-MARKER",
      "XMP-MARKER",
      "ICC-MARKER",
      "COMMENT-MARKER",
      "TRAILING-MARKER",
      "JFIF",
    ])
      expect(has(out, m), m).toBe(false);
    expect(sniffImage(out)).toBe("jpg");
    expect(jpegMarkers(out)).toEqual([0xd8, 0xdb, 0xc0, 0xc4, 0xda, 0xd9]);
    // entropy data (stuffing, RST, fill) is untouched, and stripping is idempotent
    expect(has(out, "\x12\xff\x00\x34\xff\xd0\x56")).toBe(true);
    expect(Buffer.from(stripJpeg(out)!).equals(Buffer.from(out))).toBe(true);
  });

  it("the repository's real logo.jpg, with an EXIF/GPS segment injected, strips back to the clean image", () => {
    const logo = readFileSync(path.join(__dirname, "fixtures/logo.jpg"));
    const dirty = Buffer.concat([logo.subarray(0, 2), exif, logo.subarray(2)]);
    expect(has(dirty, "GPS-LATITUDE-MARKER")).toBe(true);
    const clean = stripJpeg(dirty)!;
    expect(clean).not.toBeNull();
    expect(has(clean, "GPS-LATITUDE-MARKER")).toBe(false);
    expect(Buffer.from(clean).equals(Buffer.from(stripJpeg(logo)!))).toBe(true);
    jpegMarkers(clean);
  });

  it("rejects what it cannot parse cleanly: truncated, no scan, no frame, bad length, garbage", () => {
    const good = jpeg();
    expect(stripJpeg(good.subarray(0, good.length - 2))).toBeNull(); // no EOI
    expect(stripJpeg(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))).toBeNull(); // nothing inside
    expect(
      stripJpeg(
        Buffer.concat([
          Buffer.from([0xff, 0xd8]),
          seg(0xda, Buffer.from([1, 1, 0, 0, 63, 0])),
          Buffer.from([0xff, 0xd9]),
        ]),
      ),
    ).toBeNull(); // no SOF
    const badLen = Buffer.from(good);
    badLen.writeUInt16BE(0xffff, 4); // first segment length runs off the end
    expect(stripJpeg(badLen)).toBeNull();
    expect(stripJpeg(Buffer.from("plain text, not a jpeg"))).toBeNull();
    expect(stripJpeg(Buffer.from([0xff, 0xd8, 0x00, 0x01]))).toBeNull();
  });
});
