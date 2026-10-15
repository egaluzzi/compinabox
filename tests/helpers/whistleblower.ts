import { readFileSync } from "node:fs";
import path from "node:path";
import { crc32 } from "node:zlib";
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { companies } from "@/lib/db/schema";
import { seedCompany } from "./db";

const fixture = (name: string) =>
  readFileSync(path.resolve(__dirname, "../fixtures", name));

/** The repo's real logo.png with a tEXt chunk (carrying `marker`) inserted after IHDR. */
export function pngWithMarker(marker: string): Buffer {
  const logo = fixture("logo.png");
  const data = Buffer.from(`Comment\0${marker}`, "latin1");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from("tEXt"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([
    logo.subarray(0, 33),
    len,
    body,
    crc,
    logo.subarray(33),
  ]);
}

/** The repo's real logo.jpg with an APP1 (EXIF-style) segment carrying `marker` after SOI. */
export function jpegWithMarker(marker: string): Buffer {
  const logo = fixture("logo.jpg");
  const payload = Buffer.from(`Exif\0\0${marker}`, "latin1");
  const len = Buffer.alloc(2);
  len.writeUInt16BE(payload.length + 2);
  return Buffer.concat([
    logo.subarray(0, 2),
    Buffer.from([0xff, 0xe1]),
    len,
    payload,
    logo.subarray(2),
  ]);
}

/** An onboarded tenant with a known slug (the dashboard gate needs onboarding_completed_at). */
export async function seedOnboarded(db: Db, label?: string) {
  const s = await seedCompany(db, label);
  await db
    .update(companies)
    .set({ onboardingCompletedAt: new Date(), name: s.company.name })
    .where(eq(companies.id, s.company.id));
  return s;
}

export function reportRequest(
  slug: string,
  fields: Record<string, string>,
  files: { name: string; bytes: Uint8Array; type?: string }[] = [],
  headers: Record<string, string> = {},
) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  for (const f of files)
    form.append(
      "evidence",
      new File([new Uint8Array(f.bytes)], f.name, {
        type: f.type ?? "image/png",
      }),
    );
  return new Request(`http://localhost/api/report/${slug}`, {
    method: "POST",
    body: form,
    headers,
  });
}

export const slugCtx = (slug: string) => ({
  params: Promise.resolve({ slug }),
});
