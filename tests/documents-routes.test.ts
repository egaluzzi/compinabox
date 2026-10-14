// @vitest-environment node
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { companies } from "@/lib/db/schema";
import { listDocuments } from "@/lib/documents/store";
import { saveLogo } from "@/lib/uploads";
import { seedCompany, useTestDb } from "./helpers/db";
import { extractPdf } from "./helpers/pdf";

let db: ReturnType<typeof useTestDb>;
let dir: string;
beforeAll(() => {
  db = useTestDb();
});
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "docs-routes-"));
  vi.stubEnv("UPLOADS_DIR", dir);
});

type Seeded = Awaited<ReturnType<typeof seedCompany>>;
function actAs(s: Seeded | null) {
  vi.resetModules();
  vi.doMock("@/lib/auth/tenant", () => ({
    getTenant: async () => s && { userId: s.user.id, companyId: s.company.id },
  }));
}
async function onboard(s: Seeded, name = "Rotas Ltda") {
  actAs(s);
  const { POST } = await import("@/app/api/onboarding/route");
  const form = new FormData();
  form.set("companyName", name);
  form.set("industry", "health");
  return POST(
    new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: form,
    }),
  );
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
async function getPdf(s: Seeded | null, id: string) {
  actAs(s);
  const { GET } =
    await import("@/app/(app)/dashboard/documents/[id]/pdf/route");
  return GET(
    new Request(`http://localhost/dashboard/documents/${id}/pdf`),
    ctx(id),
  );
}
async function regenerate(s: Seeded | null, type: string) {
  actAs(s);
  const { POST } = await import("@/app/api/documents/regenerate/route");
  const form = new FormData();
  form.set("type", type);
  return POST(
    new Request("http://localhost/api/documents/regenerate", {
      method: "POST",
      body: form,
    }),
  );
}

describe("onboarding creates the documents", () => {
  it("completing onboarding creates six v1 documents in the same transaction as the profile", async () => {
    const s = await seedCompany(db);
    const res = await onboard(s);
    expect(res.status).toBe(303);
    const rows = await listDocuments(db, s.company.id);
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.version === 1)).toBe(true);
    expect(rows[0].content).toContain("Rotas Ltda");
    expect(rows[0].content).toContain("Saúde");
  });

  it("re-submitting onboarding does not create duplicates", async () => {
    const s = await seedCompany(db);
    await onboard(s);
    await onboard(s, "Rotas Renomeada Ltda");
    expect(await listDocuments(db, s.company.id)).toHaveLength(6);
  });

  it("if generation throws, onboarding fails loudly and the profile update rolls back", async () => {
    const s = await seedCompany(db);
    await db
      .update(companies)
      .set({ country: "ar" })
      .where(eq(companies.id, s.company.id));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(onboard(s)).rejects.toThrow(/not enabled yet/);
    err.mockRestore();
    const [c] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, s.company.id));
    expect(c.onboardingCompletedAt).toBeNull();
    expect(c.industry).toBeNull();
    expect(await listDocuments(db, s.company.id)).toHaveLength(0);
  });
});

describe("PDF route", () => {
  it("returns an attachment PDF with the right headers, containing the company name", async () => {
    const s = await seedCompany(db);
    await onboard(s, "Cabeçalhos & Cia Ltda");
    const [doc] = await listDocuments(db, s.company.id);
    const res = await getPdf(s, doc.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const cd = res.headers.get("content-disposition")!;
    expect(cd).toMatch(/^attachment; filename="[a-z0-9-]+-v1\.pdf"$/);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect((await extractPdf(buf)).text).toContain("Cabeçalhos & Cia Ltda");
  });

  it("embeds the company's stored logo; a broken stored logo still yields a PDF", async () => {
    const s = await seedCompany(db);
    await onboard(s);
    const [doc] = await listDocuments(db, s.company.id);

    const png = readFileSync(path.join(__dirname, "fixtures", "logo.png"));
    const saved = await saveLogo(new Uint8Array(png));
    if (!saved.ok) throw new Error("logo not saved");
    await db
      .update(companies)
      .set({ logoFile: saved.file })
      .where(eq(companies.id, s.company.id));
    const withLogo = Buffer.from(await (await getPdf(s, doc.id)).arrayBuffer());
    expect(withLogo.includes("/Subtype /Image")).toBe(true);

    const broken = "a".repeat(32) + ".png";
    writeFileSync(path.join(dir, broken), png.subarray(0, 40));
    await db
      .update(companies)
      .set({ logoFile: broken })
      .where(eq(companies.id, s.company.id));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await getPdf(s, doc.id);
    expect(err).toHaveBeenCalledTimes(1); // logged once
    err.mockRestore();
    expect(res.status).toBe(200);
    expect(
      Buffer.from(await res.arrayBuffer()).includes("/Subtype /Image"),
    ).toBe(false);

    await db
      .update(companies)
      .set({ logoFile: "b".repeat(32) + ".png" })
      .where(eq(companies.id, s.company.id));
    const err2 = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await getPdf(s, doc.id)).status).toBe(200); // file missing on disk
    err2.mockRestore();
  });

  it("another company's document id -> 404 (not 403); unknown/odd ids -> 404; no session -> 401", async () => {
    const a = await seedCompany(db);
    const b = await seedCompany(db);
    await onboard(a);
    await onboard(b);
    const [aDoc] = await listDocuments(db, a.company.id);
    expect((await getPdf(a, aDoc.id)).status).toBe(200);
    expect((await getPdf(b, aDoc.id)).status).toBe(404);
    expect(
      (await getPdf(a, "00000000-0000-4000-8000-000000000000")).status,
    ).toBe(404);
    expect((await getPdf(a, "not-a-uuid")).status).toBe(404);
    expect((await getPdf(a, "1' or '1'='1")).status).toBe(404);
    expect((await getPdf(null, aDoc.id)).status).toBe(401);
  });
});

describe("web view page", () => {
  async function page(s: Seeded, id: string) {
    actAs(s);
    vi.doMock("next/navigation", () => ({
      redirect: (to: string) => {
        throw new Error(`REDIRECT ${to}`);
      },
      notFound: () => {
        throw new Error("NOT_FOUND");
      },
    }));
    const mod = await import("@/app/(app)/dashboard/documents/[id]/page");
    return mod.default({ params: Promise.resolve({ id }) });
  }
  it("shows own document; another company's id is notFound", async () => {
    const a = await seedCompany(db);
    const b = await seedCompany(db);
    await onboard(a);
    await onboard(b);
    const [aDoc] = await listDocuments(db, a.company.id);
    await expect(page(a, aDoc.id)).resolves.toBeTruthy();
    await expect(page(b, aDoc.id)).rejects.toThrow("NOT_FOUND");
    await expect(page(b, "zzz")).rejects.toThrow("NOT_FOUND");
  });
});

describe("regenerate route", () => {
  it("401 without a session; 400 for an unknown type", async () => {
    expect((await regenerate(null, "all")).status).toBe(401);
    const s = await seedCompany(db);
    await onboard(s);
    expect((await regenerate(s, "policy:nope")).status).toBe(400);
    expect((await regenerate(s, "")).status).toBe(400);
  });
  it("unchanged -> no new rows; changed name -> v2 only for the requested type", async () => {
    const s = await seedCompany(db);
    await onboard(s);
    const res = await regenerate(s, "all");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("regenerated=unchanged");
    expect(await listDocuments(db, s.company.id)).toHaveLength(6);

    await db
      .update(companies)
      .set({ name: "Nome Novo Ltda" })
      .where(eq(companies.id, s.company.id));
    const res2 = await regenerate(s, "code_of_conduct");
    expect(res2.headers.get("location")).toContain("regenerated=created");
    const rows = await listDocuments(db, s.company.id);
    expect(rows).toHaveLength(7);
    expect(rows.filter((r) => r.version === 2).map((r) => r.type)).toEqual([
      "code_of_conduct",
    ]);
  });
  it("only ever touches the session's company", async () => {
    const a = await seedCompany(db);
    const b = await seedCompany(db);
    await onboard(a);
    await onboard(b);
    await db
      .update(companies)
      .set({ name: "Só A Muda" })
      .where(eq(companies.id, a.company.id));
    await regenerate(b, "all");
    expect(await listDocuments(db, a.company.id)).toHaveLength(6);
    expect(await listDocuments(db, b.company.id)).toHaveLength(6);
  });
});
