// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/uploads/[name]/route";
import {
  MAX_LOGO_BYTES,
  saveLogo,
  sniffImage,
  UPLOAD_NAME,
} from "@/lib/uploads";
import { getCompany } from "@/lib/db/tenant";
import { seedCompany, useTestDb } from "./helpers/db";

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const WEBP = Uint8Array.from([
  ...Buffer.from("RIFF"),
  1,
  0,
  0,
  0,
  ...Buffer.from("WEBPVP8 "),
]);
const SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
);
const GIF = Buffer.from("GIF89a....");
const HTML_AS_PNG_NAME = Buffer.from("<html><script>alert(1)</script></html>");

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "uploads-"));
  vi.stubEnv("UPLOADS_DIR", dir);
});

describe("logo validation", () => {
  it("accepts PNG / JPEG / WebP by magic bytes", () => {
    expect(sniffImage(PNG)).toBe("png");
    expect(sniffImage(JPG)).toBe("jpg");
    expect(sniffImage(WEBP)).toBe("webp");
  });
  it("rejects SVG, GIF, HTML and empty input regardless of what the client claims", async () => {
    for (const bad of [SVG, GIF, HTML_AS_PNG_NAME, Buffer.alloc(0)])
      expect(await saveLogo(bad)).toEqual({ ok: false });
    expect(readdirSync(dir)).toEqual([]);
  });
  it("rejects > 1 MB, accepts exactly 1 MB", async () => {
    const big = new Uint8Array(MAX_LOGO_BYTES + 1);
    big.set(PNG);
    expect(await saveLogo(big)).toEqual({ ok: false });
    const edge = new Uint8Array(MAX_LOGO_BYTES);
    edge.set(PNG);
    expect((await saveLogo(edge)).ok).toBe(true);
  });
  it("stores under a random server-chosen name with the sniffed extension", async () => {
    const r = await saveLogo(PNG);
    expect(r.ok && UPLOAD_NAME.test(r.file)).toBe(true);
    const r2 = await saveLogo(PNG);
    expect(r.ok && r2.ok && r.file !== r2.file).toBe(true);
    expect(readdirSync(dir)).toHaveLength(2);
  });
});

describe("serving uploads", () => {
  const get = (name: string) =>
    GET(new Request(`http://localhost/uploads/${name}`), {
      params: Promise.resolve({ name }),
    });
  it("fixed content-type, nosniff, locked-down CSP", async () => {
    const r = await saveLogo(PNG);
    if (!r.ok) throw new Error("save failed");
    const res = await get(r.file);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
    expect(
      Buffer.from(await res.arrayBuffer()).equals(
        readFileSync(path.join(dir, r.file)),
      ),
    ).toBe(true);
  });
  it("404 for traversal, odd names, other extensions and missing files", async () => {
    for (const name of [
      "../etc/passwd",
      "..%2f..%2fetc%2fpasswd",
      "a.png",
      "x.svg",
      `${"a".repeat(32)}.svg`,
      `${"a".repeat(32)}.html`,
      `${"a".repeat(32)}.png`,
    ])
      expect((await get(name)).status, name).toBe(404);
  });
});

describe("onboarding with a logo", () => {
  let db: ReturnType<typeof useTestDb>;
  beforeAll(() => {
    db = useTestDb();
  });
  async function post(file: Blob | null, filename = "logo.png") {
    const { company, user } = await seedCompany(db);
    vi.resetModules();
    vi.doMock("@/lib/auth/tenant", () => ({
      getTenant: async () => ({ userId: user.id, companyId: company.id }),
    }));
    const { POST } = await import("@/app/api/onboarding/route");
    const form = new FormData();
    form.set("companyName", "Logo Co");
    form.set("industry", "technology");
    if (file) form.set("logo", file, filename);
    const res = await POST(
      new Request("http://localhost/api/onboarding", {
        method: "POST",
        body: form,
      }),
    );
    vi.doUnmock("@/lib/auth/tenant");
    return { res, company };
  }
  it("valid PNG: saved, linked, redirect to dashboard", async () => {
    const { res, company } = await post(new Blob([PNG], { type: "image/png" }));
    expect(res.headers.get("location")).toMatch(/\/dashboard$/);
    const c = await getCompany(db, company.id);
    expect(c?.logoFile).toMatch(UPLOAD_NAME);
    expect(c?.onboardingCompletedAt).not.toBeNull();
  });
  it("SVG named .png with an image content-type: rejected, profile NOT saved", async () => {
    const { res, company } = await post(
      new Blob([SVG], { type: "image/png" }),
      "logo.png",
    );
    expect(res.headers.get("location")).toMatch(/error=logo/);
    const c = await getCompany(db, company.id);
    expect(c?.logoFile).toBeNull();
    expect(c?.onboardingCompletedAt).toBeNull();
  });
  it("no logo is fine", async () => {
    const { res } = await post(null);
    expect(res.headers.get("location")).toMatch(/\/dashboard$/);
  });
});
