// @vitest-environment node
import { eq } from "drizzle-orm";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { BINDER_DAILY_CAP } from "@/lib/binder/constants";
import { binders, companies } from "@/lib/db/schema";
import { LOCALES, getMessages } from "@/lib/i18n";
import { useTestDb } from "./helpers/db";
import { seedBinderCompany } from "./helpers/binder";

// Only the admin session lookup and next/navigation are replaced; the gate, queries, the job
// runner, the renderer and Postgres are real.
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
  usePathname: () => "/dashboard/binder",
  useRouter: () => ({ refresh: () => {} }),
}));

type Seeded = Awaited<ReturnType<typeof seedBinderCompany>>;
let db: ReturnType<typeof useTestDb>;
let A: Seeded;
let B: Seeded;
const D = "@/app/(app)/dashboard";
const as = (s: Seeded | null) => {
  session.current = s && { userId: s.user.id, companyId: s.company.id };
};

beforeAll(() => {
  db = useTestDb();
  vi.stubEnv("APP_URL", "http://localhost:3000");
});
beforeEach(async () => {
  A = await seedBinderCompany(db, { employees: 3, vendors: 2 });
  B = await seedBinderCompany(db, { employees: 3, vendors: 2 });
  as(A);
});

async function render(mod: string, props: Record<string, unknown> = {}) {
  const page = (await import(/* @vite-ignore */ `${D}/${mod}`)).default;
  const layout = (await import(`${D}/layout`)).default;
  const body = (await page(props)) as ReactNode;
  return renderToStaticMarkup(
    createElement("div", null, await layout({ children: body })),
  );
}
const page = (sp: Record<string, string> = {}) =>
  render("binder/page", { searchParams: Promise.resolve(sp) });
const call = async (
  mod: string,
  method: "GET" | "POST",
  init: RequestInit = {},
  id?: string,
  url = "http://localhost/x",
) =>
  (await import(/* @vite-ignore */ `${D}/${mod}`))[method](
    new Request(url, { method, ...init }),
    { params: Promise.resolve({ id }) },
  ) as Promise<Response>;
const generate = (fields: Record<string, string> = {}) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return call("binder/generate/route", "POST", { body: f });
};
const status = (id: string) =>
  call(
    "binder/status/route",
    "GET",
    {},
    undefined,
    `http://localhost/s?id=${id}`,
  );
const download = (id: string) => call("binder/[id]/pdf/route", "GET", {}, id);
const loc = (r: Response) => {
  const u = new URL(r.headers.get("location")!);
  return u.pathname + u.search;
};
async function waitReady(id: string) {
  for (let i = 0; i < 200; i++) {
    const body = await (await status(id)).json();
    if (body.status === "ready" || body.status === "failed") return body;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("binder never finished");
}

describe("generate -> poll -> download, through the real handlers", () => {
  it("the click returns at once with a queued/running job; the status handler reaches ready; the file downloads with the right headers", async () => {
    const t0 = Date.now();
    const r = await generate();
    expect(r.status).toBe(303);
    expect(loc(r)).toBe("/dashboard/binder?generate=started");
    // the response did not wait for the render
    expect(Date.now() - t0).toBeLessThan(2000);
    const [b] = await db
      .select()
      .from(binders)
      .where(eq(binders.companyId, A.company.id));
    expect(["queued", "running", "ready"]).toContain(b.status);
    expect(b.requestedByUserId).toBe(A.user.id);
    expect(b.options).toEqual({ includeChannelStats: false });

    const done = await waitReady(b.id);
    expect(done.status).toBe("ready");
    expect(done.sizeBytes).toBeGreaterThan(1000);
    expect(done.pageCount).toBeGreaterThan(10);

    const f = await download(b.id);
    expect(f.status).toBe(200);
    expect(f.headers.get("content-type")).toBe("application/pdf");
    expect(f.headers.get("cache-control")).toBe("no-store");
    expect(f.headers.get("x-content-type-options")).toBe("nosniff");
    const cd = f.headers.get("content-disposition")!;
    expect(cd).toMatch(/^attachment; filename="dossie-[a-z0-9-]+-\d{8}\.pdf"$/);
    expect(/^[\x20-\x7e]*$/.test(cd)).toBe(true);
    const bytes = Buffer.from(await f.arrayBuffer());
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.length).toBe(done.sizeBytes);
    expect(f.headers.get("content-length")).toBe(String(bytes.length));
    // the hash the dashboard shows is the hash of the file the customer downloaded
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(done.sha256);
  }, 90_000);

  it("the statistics checkbox is stored with the job", async () => {
    await generate({ stats: "on" });
    const [b] = await db
      .select()
      .from(binders)
      .where(eq(binders.companyId, A.company.id));
    expect(b.options).toEqual({ includeChannelStats: true });
    await waitReady(b.id);
  }, 90_000);

  it("a second click while one is active lands on the same job", async () => {
    const r1 = await generate();
    const r2 = await generate();
    expect(loc(r1)).toBe("/dashboard/binder?generate=started");
    expect(loc(r2)).toBe("/dashboard/binder?generate=existing");
    const rows = await db
      .select()
      .from(binders)
      .where(eq(binders.companyId, A.company.id));
    expect(rows.length).toBe(1);
    await waitReady(rows[0].id);
  }, 90_000);

  it("right after a finished job the cooldown message comes back and nothing new is created", async () => {
    await generate();
    const [b] = await db
      .select()
      .from(binders)
      .where(eq(binders.companyId, A.company.id));
    await waitReady(b.id);
    const r = await generate();
    expect(loc(r)).toBe("/dashboard/binder?generate=cooldown");
    expect(
      (
        await db
          .select()
          .from(binders)
          .where(eq(binders.companyId, A.company.id))
      ).length,
    ).toBe(1);
  }, 90_000);

  it("the daily cap message comes back at the cap", async () => {
    await db.insert(binders).values(
      Array.from({ length: BINDER_DAILY_CAP }, () => ({
        companyId: A.company.id,
        options: { includeChannelStats: false },
        status: "failed",
        errorCode: "render_failed",
        finishedAt: new Date(Date.now() - 3600_000),
      })),
    );
    expect(loc(await generate())).toBe("/dashboard/binder?generate=cap");
  });
});

describe("access control", () => {
  it("no session: every binder handler answers 401, the page redirects to /login", async () => {
    as(null);
    expect((await generate()).status).toBe(401);
    expect((await status(crypto.randomUUID())).status).toBe(401);
    expect((await download(crypto.randomUUID())).status).toBe(401);
    await expect(page()).rejects.toThrow("REDIRECT /login");
  });

  it("another company's binder: status 404 and download 404 — and the owner still gets 200", async () => {
    const [bB] = await db
      .insert(binders)
      .values({
        companyId: B.company.id,
        options: { includeChannelStats: false },
      })
      .returning();
    await db
      .update(binders)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(binders.id, bB.id));
    // B's job finishes for real
    const { runBinderJob } = await import("@/lib/binder/jobs");
    await db
      .update(binders)
      .set({ status: "queued" })
      .where(eq(binders.id, bB.id));
    await runBinderJob(db, bB.id);
    // as B: fine
    as(B);
    expect((await status(bB.id)).status).toBe(200);
    expect((await download(bB.id)).status).toBe(200);
    // as A: 404 on both, indistinguishable from a missing id
    as(A);
    expect((await status(bB.id)).status).toBe(404);
    expect((await download(bB.id)).status).toBe(404);
    expect((await status(crypto.randomUUID())).status).toBe(404);
    // A's page does not list it
    expect(await page()).not.toContain(bB.id);
  }, 90_000);

  it("malformed ids are 404, a binder that is not ready cannot be downloaded", async () => {
    expect((await status("not-a-uuid")).status).toBe(404);
    expect((await download("not-a-uuid")).status).toBe(404);
    const [q] = await db
      .insert(binders)
      .values({
        companyId: A.company.id,
        options: { includeChannelStats: false },
        status: "running",
        startedAt: new Date(),
      })
      .returning();
    expect((await download(q.id)).status).toBe(404);
    expect((await (await status(q.id)).json()).status).toBe("running");
  });

  it("a company whose language is not pt-BR is told the dossier is unavailable and no job is created", async () => {
    await db
      .update(companies)
      .set({ country: "ar" })
      .where(eq(companies.id, A.company.id));
    const r = await generate();
    expect(loc(r)).toBe("/dashboard/binder?generate=unavailable");
    expect(
      (
        await db
          .select()
          .from(binders)
          .where(eq(binders.companyId, A.company.id))
      ).length,
    ).toBe(0);
    expect(await page()).toContain(
      getMessages("es-AR").dashboard.binder.unavailable,
    );
  });

  it("the status poll recovers a stuck job", async () => {
    const old = new Date(Date.now() - 3600_000);
    const [q] = await db
      .insert(binders)
      .values({
        companyId: A.company.id,
        options: { includeChannelStats: false },
        status: "running",
        startedAt: old,
        createdAt: old,
      })
      .returning();
    const body = await (await status(q.id)).json();
    expect(body.status).toBe("failed");
    expect(body.errorCode).toBe("interrupted");
  });
});

describe("the page", () => {
  it("shows the generate form with the plain notice, the exclusions and the stats checkbox (off)", async () => {
    const html = await page();
    expect(html).toContain(
      "O arquivo contém nomes de colaboradores e datas; compartilhe só com quem precisa.",
    );
    expect(html).toContain('action="/dashboard/binder/generate"');
    expect(html).toContain('name="stats"');
    expect(html).not.toMatch(/name="stats"[^>]*checked/);
    expect(html).toContain("Nenhum dossiê gerado ainda.");
    // not a ninth navigation item
    expect(html.match(/href="\/dashboard\/binder"/g)?.length ?? 0).toBe(0);
  });

  it("an active job: status text, the no-JS refresh link, no generate form", async () => {
    await db.insert(binders).values({
      companyId: A.company.id,
      options: { includeChannelStats: false },
      status: "running",
      startedAt: new Date(),
    });
    const html = await page();
    expect(html).toContain("Gerando");
    expect(html).toContain('href="/dashboard/binder"');
    expect(html).not.toContain('action="/dashboard/binder/generate"');
  });

  it("a ready binder: date, size, pages, the full SHA-256 and a download link; failed ones show a fixed reason", async () => {
    await generate();
    const [b] = await db
      .select()
      .from(binders)
      .where(eq(binders.companyId, A.company.id));
    await waitReady(b.id);
    await db.insert(binders).values({
      companyId: A.company.id,
      options: { includeChannelStats: false },
      status: "failed",
      errorCode: "too_large",
    });
    const html = await page();
    const done = (
      await db.select().from(binders).where(eq(binders.id, b.id))
    )[0];
    expect(html).toContain(done.sha256!);
    expect(html).toContain(`/dashboard/binder/${b.id}/pdf`);
    expect(html).toContain("Pronto");
    expect(html).toContain("Falhou");
    expect(html).toContain("O arquivo ficou grande demais");
    expect(html).toContain("SHA-256");
  }, 90_000);

  it("the overview card reflects the latest state and links to the page", async () => {
    let html = await render("page");
    expect(html).toContain("Nenhum dossiê gerado ainda.");
    expect(html).toContain('href="/dashboard/binder"');
    expect(html).not.toContain("Baixar dossiê");
    await generate();
    const [b] = await db
      .select()
      .from(binders)
      .where(eq(binders.companyId, A.company.id));
    await waitReady(b.id);
    html = await render("page");
    expect(html).toContain("Último dossiê: posição em");
    expect(html).toContain(`/dashboard/binder/${b.id}/pdf`);
    expect(html).toContain("Baixar dossiê");
  }, 90_000);
});

describe("copy: no compliance claim or verdict in any binder string, in any locale", () => {
  const BAD =
    /em conformidade|certificad[oa]s?\b|aprovad[oa]s?\b|adequad[oa]s?\b|\batende\b|ISO ?3730|\b(compliant|certified|approved|adequate|clear|clean|safe)\b|aprobad[oa]s?\b|limp[oa]s?\b|segur[oa]s?\b|cumplimiento|conforme a la ley/i;
  const flat = (o: unknown, prefix = ""): Record<string, string> =>
    Object.fromEntries(
      Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
        typeof v === "string"
          ? [[`${prefix}${k}`, v]]
          : Object.entries(flat(v, `${prefix}${k}.`)),
      ),
    );
  it.each(LOCALES)(
    "%s: binder.* and dashboard.binder.* are free of them",
    (l) => {
      const m = getMessages(l) as unknown as {
        binder: unknown;
        dashboard: { binder: unknown };
      };
      const mine = {
        ...flat(m.binder, "binder."),
        ...flat(m.dashboard.binder, "dashboard.binder."),
      };
      expect(Object.keys(mine).length).toBeGreaterThan(110);
      const bad = Object.entries(mine)
        .filter(([, v]) => BAD.test(v))
        .map(([k]) => k);
      expect(bad).toEqual([]);
    },
  );

  it("the cover statement exists in every locale and says it is not an audit, certification or legal opinion", () => {
    for (const l of LOCALES) {
      const m = getMessages(l) as unknown as {
        binder: { pdf: Record<string, string> };
      };
      expect(m.binder.pdf.how2.length).toBeGreaterThan(60);
      expect(m.binder.pdf.how3.length).toBeGreaterThan(40);
    }
  });
});
