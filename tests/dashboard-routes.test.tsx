// @vitest-environment node
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  billingRecords,
  companies,
  employees,
  whistleblowerReports,
} from "@/lib/db/schema";
import { ensureInitialDocuments, listDocuments } from "@/lib/documents/store";
import { seedCompany, uid, useTestDb } from "./helpers/db";

// The only mock is the session -> {userId, companyId} lookup (Auth.js JWT decoding needs a live
// request). Everything below it — requireTenant, queries, rendering — is real, on a real Postgres.
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
  usePathname: () => "/dashboard/billing",
}));

let db: ReturnType<typeof useTestDb>;
let A: Awaited<ReturnType<typeof seedCompany>>;
let B: Awaited<ReturnType<typeof seedCompany>>;
let aDocs: Awaited<ReturnType<typeof listDocuments>>;
let bDocs: Awaited<ReturnType<typeof listDocuments>>;

const NAME_A = "Alfa Ltda";
const NAME_B = "Beta Segredo S.A.";
const MONEY_A = "123,45"; // 12345 cents
const MONEY_B = "987,65"; // 98765 cents

async function onboarded(name: string, industry = "technology") {
  const s = await seedCompany(db);
  await db
    .update(companies)
    .set({ name, industry, onboardingCompletedAt: new Date() })
    .where(eq(companies.id, s.company.id));
  await ensureInitialDocuments(db, s.company.id, s.user.id);
  return s;
}

beforeAll(async () => {
  db = useTestDb();
  process.env.UPLOADS_DIR = mkdtempSync(path.join(tmpdir(), "dash-"));
  const run = uid();
  A = await onboarded(NAME_A);
  B = await onboarded(NAME_B, "health");
  await db.insert(billingRecords).values([
    {
      companyId: A.company.id,
      amountCents: 12345,
      currency: "BRL",
      paidAt: new Date("2026-03-04T15:00:00Z"),
    },
    {
      companyId: B.company.id,
      amountCents: 98765,
      currency: "BRL",
      paidAt: new Date("2026-05-06T15:00:00Z"),
    },
  ]);
  await db.insert(employees).values([
    { companyId: A.company.id, name: "Pessoa A", email: "pa@example.test" },
    ...["1", "2", "3"].map((n) => ({
      companyId: B.company.id,
      name: `Pessoa B${n}`,
      email: `pb${n}@example.test`,
    })),
  ]);
  await db.insert(whistleblowerReports).values([
    {
      companyId: B.company.id,
      trackingCode: `TB-OPEN-1-${run}`,
      category: "fraud",
      description: "x",
      status: "new",
    },
    {
      companyId: B.company.id,
      trackingCode: `TB-OPEN-2-${run}`,
      category: "fraud",
      description: "x",
      status: "under_review",
    },
    {
      companyId: B.company.id,
      trackingCode: `TB-CLOSED-${run}`,
      category: "fraud",
      description: "x",
      status: "closed",
    },
  ]);
  aDocs = await listDocuments(db, A.company.id);
  bDocs = await listDocuments(db, B.company.id);
});
beforeEach(() => {
  session.current = { userId: A.user.id, companyId: A.company.id };
});

const as = (s: typeof A | null) => {
  session.current = s && { userId: s.user.id, companyId: s.company.id };
};

/** Renders a page inside the real dashboard layout, exactly as a request would. */
async function renderRoute(
  mod: string,
  props: Record<string, unknown> = {},
): Promise<string> {
  const page = (await import(/* @vite-ignore */ mod)).default;
  const layout = (await import("@/app/(app)/dashboard/layout")).default;
  const body = (await page(props)) as ReactNode;
  const shell = await layout({ children: body });
  return renderToStaticMarkup(createElement("div", null, shell));
}

const D = "@/app/(app)/dashboard";
const PAGES: { name: string; mod: string; props?: Record<string, unknown> }[] =
  [
    { name: "overview", mod: `${D}/page` },
    {
      name: "documents",
      mod: `${D}/documents/page`,
      props: { searchParams: Promise.resolve({}) },
    },
    {
      name: "employees",
      mod: `${D}/employees/page`,
      props: { searchParams: Promise.resolve({}) },
    },
    { name: "training", mod: `${D}/training/page` },
    { name: "whistleblower", mod: `${D}/whistleblower/page` },
    { name: "vendors", mod: `${D}/vendors/page` },
    { name: "billing", mod: `${D}/billing/page` },
    {
      name: "settings",
      mod: `${D}/settings/page`,
      props: { searchParams: Promise.resolve({}) },
    },
  ];

describe.each(PAGES)("$name page", ({ mod, props }) => {
  it("without a session redirects to /login", async () => {
    as(null);
    await expect(renderRoute(mod, props)).rejects.toThrow("REDIRECT /login");
  });

  it("before onboarding is complete redirects to /onboarding", async () => {
    const fresh = await seedCompany(db);
    as(fresh);
    await expect(renderRoute(mod, props)).rejects.toThrow(
      "REDIRECT /onboarding",
    );
  });

  it("renders for company A with the nav, and never shows company B's name, documents or amounts", async () => {
    as(A);
    const html = await renderRoute(mod, props);
    expect(html).toContain(NAME_A);
    expect(html).toContain('aria-label="Navegação principal"');
    expect(html).not.toContain(NAME_B);
    expect(html).not.toContain("Beta Segredo");
    expect(html).not.toContain(MONEY_B);
    expect(html).not.toContain(B.user.email);
    for (const d of bDocs) expect(html).not.toContain(d.id);
    expect(html).not.toContain("Pessoa B");
    expect(html).not.toContain("TB-OPEN");
  });

  it("is rendered in the company's country locale (pt-BR), not an English default", async () => {
    as(A);
    const html = await renderRoute(mod, props);
    expect(html).toContain("Visão geral");
    expect(html).not.toContain("Sign out");
  });
});

describe("overview counts are tenant-scoped", () => {
  it("A sees 1 employee and 0 open cases; B sees 3 employees and 2 open cases (closed excluded)", async () => {
    as(A);
    const a = await renderRoute(`${D}/page`);
    expect(a).toContain("1 colaborador");
    expect(a).not.toContain("3 colaboradores");
    expect(a).toContain("Nenhuma denúncia em aberto");
    expect(a).toContain("6 de 6 documentos gerados");
    expect(a).toContain("6 documentos em rascunho");
    expect(a).toContain("0%"); // 1 active employee, nothing done yet (phase 6 completion)
    as(B);
    const b = await renderRoute(`${D}/page`);
    expect(b).toContain("3 colaboradores");
    expect(b).toContain("2 denúncias em aberto");
    expect(b).not.toContain(NAME_A);
  });
});

describe("billing page", () => {
  it("shows the session company's payments formatted for the locale, in São Paulo time", async () => {
    as(A);
    const html = await renderRoute(`${D}/billing/page`);
    expect(html).toMatch(/R\$\s*123,45/);
    expect(html).toContain("04/03/2026");
    expect(html).toContain("Pago");
    expect(html).toContain("Ativa");
    expect(html).not.toContain(MONEY_B);
  });
});

describe("documents pages", () => {
  const docPage = (s: typeof A | null, id: string) => {
    as(s);
    return renderRoute(`${D}/documents/[id]/page`, {
      params: Promise.resolve({ id }),
    });
  };
  it("lists only own documents and marks each with the draft status", async () => {
    as(A);
    const html = await renderRoute(`${D}/documents/page`, {
      searchParams: Promise.resolve({}),
    });
    for (const d of aDocs) expect(html).toContain(d.id);
    for (const d of bDocs) expect(html).not.toContain(d.id);
    expect(html.match(/RASCUNHO/g)?.length).toBeGreaterThanOrEqual(6);
  });
  it("A can open own document; B's document id is notFound for A (and vice versa)", async () => {
    await expect(docPage(A, aDocs[0].id)).resolves.toContain(NAME_A);
    await expect(docPage(A, bDocs[0].id)).rejects.toThrow("NOT_FOUND");
    await expect(docPage(B, aDocs[0].id)).rejects.toThrow("NOT_FOUND");
    await expect(docPage(A, "not-a-uuid")).rejects.toThrow("NOT_FOUND");
  });
  it("document view without a session redirects to /login", async () => {
    await expect(docPage(null, aDocs[0].id)).rejects.toThrow("REDIRECT /login");
  });
});

describe("route handlers", () => {
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  it("PDF: own 200, other tenant's 404, no session 401, not onboarded 403", async () => {
    const { GET } = await import(`${D}/documents/[id]/pdf/route`);
    const req = new Request("http://localhost/x");
    as(A);
    expect((await GET(req, ctx(aDocs[0].id))).status).toBe(200);
    expect((await GET(req, ctx(bDocs[0].id))).status).toBe(404);
    as(null);
    expect((await GET(req, ctx(aDocs[0].id))).status).toBe(401);
    as(await seedCompany(db));
    expect((await GET(req, ctx(aDocs[0].id))).status).toBe(403);
  });

  it("settings/save: renames only the session's company, ignores a posted company id, keeps onboarding_completed_at", async () => {
    const s = await onboarded("Antes Ltda");
    const before = (
      await db.select().from(companies).where(eq(companies.id, s.company.id))
    )[0];
    const { POST } = await import(`${D}/settings/save/route`);
    const form = new FormData();
    form.set("companyName", "Depois Ltda");
    form.set("industry", "retail");
    form.set("companyId", B.company.id); // must be ignored: it is never read
    form.set("company_id", B.company.id);
    as(s);
    const res = await POST(
      new Request("http://localhost/x", { method: "POST", body: form }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain(
      "/dashboard/settings?saved=1",
    );
    const [after] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, s.company.id));
    expect(after.name).toBe("Depois Ltda");
    expect(after.industry).toBe("retail");
    expect(after.onboardingCompletedAt?.getTime()).toBe(
      before.onboardingCompletedAt?.getTime(),
    );
    const [bAfter] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, B.company.id));
    expect(bAfter.name).toBe(NAME_B);
    // no documents regenerated by saving
    expect(await listDocuments(db, s.company.id)).toHaveLength(6);
  });

  it("settings/save: no session 401, not onboarded 403, bad input -> error redirect, bad logo -> error=logo", async () => {
    const { POST } = await import(`${D}/settings/save/route`);
    const post = (fields: Record<string, string | Blob>) => {
      const f = new FormData();
      for (const [k, v] of Object.entries(fields)) f.set(k, v);
      return POST(
        new Request("http://localhost/x", { method: "POST", body: f }),
      );
    };
    as(null);
    expect(
      (await post({ companyName: "Valida Ltda", industry: "retail" })).status,
    ).toBe(401);
    as(await seedCompany(db));
    expect(
      (await post({ companyName: "Valida Ltda", industry: "retail" })).status,
    ).toBe(403);
    as(A);
    expect(
      (await post({ companyName: "x", industry: "retail" })).headers.get(
        "location",
      ),
    ).toContain("error=1");
    expect(
      (
        await post({ companyName: "Valida Ltda", industry: "nope" })
      ).headers.get("location"),
    ).toContain("error=1");
    const svg = new File(
      ['<svg xmlns="http://www.w3.org/2000/svg"/>'],
      "l.png",
      { type: "image/png" },
    );
    expect(
      (
        await post({ companyName: NAME_A, industry: "technology", logo: svg })
      ).headers.get("location"),
    ).toContain("error=logo");
    const [a] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, A.company.id));
    expect(a.name).toBe(NAME_A);
  });

  it("regenerate: 401 / 403 gates; only the session's company changes", async () => {
    const { POST } = await import("@/app/api/documents/regenerate/route");
    const post = () => {
      const f = new FormData();
      f.set("type", "all");
      f.set("companyId", B.company.id);
      return POST(
        new Request("http://localhost/x", { method: "POST", body: f }),
      );
    };
    as(null);
    expect((await post()).status).toBe(401);
    as(await seedCompany(db));
    expect((await post()).status).toBe(403);
    as(A);
    expect((await post()).status).toBe(303);
    expect(await listDocuments(db, B.company.id)).toHaveLength(bDocs.length);
  });
});
