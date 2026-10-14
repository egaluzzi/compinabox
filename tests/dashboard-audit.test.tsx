// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { companies } from "@/lib/db/schema";
import { ensureInitialDocuments, listDocuments } from "@/lib/documents/store";
import { seedCompany, useTestDb } from "./helpers/db";
import { extractPdf } from "./helpers/pdf";

const session = vi.hoisted(() => ({
  current: null as { userId: string; companyId: string } | null,
}));
vi.mock("@/lib/auth/tenant", () => ({
  getTenant: async () => session.current,
}));
vi.mock("@/auth", () => ({ signOut: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  usePathname: () => "/dashboard",
}));

let db: ReturnType<typeof useTestDb>;
beforeAll(() => {
  db = useTestDb();
  process.env.UPLOADS_DIR = mkdtempSync(path.join(tmpdir(), "audit-"));
});

const D = "@/app/(app)/dashboard";
const OLD = "Nome Antigo Ltda";
const NEW = "Nome Novo Ltda";

async function viewDoc(id: string) {
  const page = (await import(`${D}/documents/[id]/page`)).default;
  const layout = (await import(`${D}/layout`)).default;
  const body = await page({ params: Promise.resolve({ id }) });
  return renderToStaticMarkup(
    createElement("div", null, await layout({ children: body })),
  );
}
async function pdfText(id: string) {
  const { GET } = await import(`${D}/documents/[id]/pdf/route`);
  const res = await GET(new Request("http://localhost/x"), {
    params: Promise.resolve({ id }),
  });
  expect(res.status).toBe(200);
  return (await extractPdf(Buffer.from(await res.arrayBuffer()))).text;
}
const article = (html: string) =>
  /<article[\s\S]*<\/article>/.exec(html)?.[0] ?? "";

describe("audit trail: renaming the company in Settings", () => {
  it("v1 view and PDF keep the old name; a regenerated v2 view and PDF show the new one", async () => {
    const s = await seedCompany(db);
    await db
      .update(companies)
      .set({
        name: OLD,
        industry: "services",
        onboardingCompletedAt: new Date(),
      })
      .where(eq(companies.id, s.company.id));
    await ensureInitialDocuments(db, s.company.id, s.user.id);
    session.current = { userId: s.user.id, companyId: s.company.id };
    const [v1] = (await listDocuments(db, s.company.id)).filter(
      (d) => d.type === "code_of_conduct",
    );

    // Settings save, through the real route handler, with a new logo.
    const { POST } = await import(`${D}/settings/save/route`);
    const png = readFileSync(path.join(__dirname, "fixtures", "logo.png"));
    const form = new FormData();
    form.set("companyName", NEW);
    form.set("industry", "services");
    form.set(
      "logo",
      new File([new Uint8Array(png)], "logo.png", { type: "image/png" }),
    );
    const res = await POST(
      new Request("http://localhost/x", { method: "POST", body: form }),
    );
    expect(res.headers.get("location")).toContain("saved=1");
    const [renamed] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, s.company.id));
    expect(renamed.name).toBe(NEW);
    expect(renamed.logoFile).toMatch(/^[a-f0-9]{32}\.png$/);
    expect(
      existsSync(path.join(process.env.UPLOADS_DIR!, renamed.logoFile!)),
    ).toBe(true);
    expect(await listDocuments(db, s.company.id)).toHaveLength(6); // saving regenerates nothing

    // v1: web view article and PDF still carry the name it was generated with.
    const v1Html = await viewDoc(v1.id);
    expect(article(v1Html)).toContain(OLD);
    expect(article(v1Html)).not.toContain(NEW);
    const v1Pdf = await pdfText(v1.id);
    expect(v1Pdf).toContain(OLD);
    expect(v1Pdf).not.toContain(NEW);
    // (The shell header is chrome, not the document: it shows the live name.)
    expect(v1Html).toContain(
      `<span class="truncate font-semibold">${NEW}</span>`,
    );

    // Explicit regenerate -> v2 with the new name; v1 is untouched.
    const regen = await import("@/app/api/documents/regenerate/route");
    const f = new FormData();
    f.set("type", "all");
    const r2 = await regen.POST(
      new Request("http://localhost/x", { method: "POST", body: f }),
    );
    expect(r2.headers.get("location")).toContain("regenerated=created");
    const [v2] = (await listDocuments(db, s.company.id)).filter(
      (d) => d.type === "code_of_conduct" && d.version === 2,
    );
    const v2Html = await viewDoc(v2.id);
    expect(article(v2Html)).toContain(NEW);
    expect(article(v2Html)).not.toContain(OLD);
    const v2Pdf = await pdfText(v2.id);
    expect(v2Pdf).toContain(NEW);
    expect(v2Pdf).not.toContain(OLD);
    expect(article(await viewDoc(v1.id))).toContain(OLD);
  });
});
