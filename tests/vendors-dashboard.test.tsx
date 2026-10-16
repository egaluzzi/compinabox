// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { vendorScreenings, vendors } from "@/lib/db/schema";
import type { EmailMessage } from "@/lib/email";
import { LOCALES, getMessages } from "@/lib/i18n";
import type {
  ScreeningOutcome,
  ScreeningProvider,
} from "@/lib/screening/types";
import { parseAnswers } from "@/lib/vendors/answers";
import { submitQuestionnaire } from "@/lib/vendors/submit";
import { summarizeVendors } from "@/lib/vendors/summary";
import { uid, useTestDb } from "./helpers/db";
import { seedPortalCompany } from "./helpers/employee";

// Only the admin session lookup, next/navigation and the screening provider are replaced; the
// gate, queries, crypto, email sink and rendering are real, on a real Postgres.
const session = vi.hoisted(() => ({
  current: null as { userId: string; companyId: string } | null,
  provider: null as unknown,
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
  usePathname: () => "/dashboard/vendors",
}));
vi.mock("@/lib/screening", () => ({
  getScreeningProvider: () => session.provider,
}));

type Seeded = Awaited<ReturnType<typeof seedPortalCompany>>;
let db: ReturnType<typeof useTestDb>;
let A: Seeded;
let B: Seeded;
let outbox: string;
const D = "@/app/(app)/dashboard";
const as = (s: Seeded | null) => {
  session.current = s && { userId: s.user.id, companyId: s.company.id };
};
let calls: number;
const useProvider = (outcome: ScreeningOutcome | null) => {
  calls = 0;
  session.provider = {
    name: "stub",
    available: outcome !== null,
    dataset: "stub_ds",
    screen: async () => {
      calls++;
      return outcome ?? { status: "error", code: "not_configured" };
    },
  } satisfies ScreeningProvider;
};
const POSSIBLE: ScreeningOutcome = {
  status: "possible_match",
  dataset: "stub_ds",
  matches: [
    {
      id: "NK-9",
      caption: "Empresa Listada SA",
      score: 0.93,
      datasets: ["us_ofac_sdn"],
      topics: ["sanction"],
    },
  ],
};

beforeAll(() => {
  db = useTestDb();
  outbox = mkdtempSync(path.join(tmpdir(), "outbox-"));
  vi.stubEnv("EMAIL_DEV_SINK", "true");
  vi.stubEnv("EMAIL_SINK_DIR", outbox);
  vi.stubEnv("APP_URL", "http://localhost:3000");
});
beforeEach(async () => {
  A = await seedPortalCompany(db, `va-${uid()}`);
  B = await seedPortalCompany(db, `vb-${uid()}`);
  as(A);
  useProvider(POSSIBLE);
});

const mails = (): EmailMessage[] =>
  readdirSync(outbox)
    .sort()
    .map((f) => JSON.parse(readFileSync(path.join(outbox, f), "utf8")));
async function render(mod: string, props: Record<string, unknown> = {}) {
  const page = (await import(/* @vite-ignore */ `${D}/${mod}`)).default;
  const layout = (await import(`${D}/layout`)).default;
  const body = (await page(props)) as ReactNode;
  return renderToStaticMarkup(
    createElement("div", null, await layout({ children: body })),
  );
}
const list = (sp: Record<string, string> = {}) =>
  render("vendors/page", { searchParams: Promise.resolve(sp) });
const detail = (id: string, sp: Record<string, string> = {}) =>
  render("vendors/[id]/page", {
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(sp),
  });
const route = async (mod: string, init?: RequestInit, id?: string) =>
  (await import(/* @vite-ignore */ `${D}/${mod}`))[init?.method ?? "POST"](
    new Request("http://localhost/x", init),
    { params: Promise.resolve({ id }) },
  ) as Promise<Response>;
const loc = (r: Response) =>
  new URL(r.headers.get("location")!).pathname +
  new URL(r.headers.get("location")!).search;
const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return { method: "POST", body: f };
};
const add = (o: Record<string, string>) => route("vendors/add/route", form(o));
async function mk(
  s: Seeded,
  name = `Forn ${uid()}`,
  over: Partial<typeof vendors.$inferInsert> = {},
) {
  const [v] = await db
    .insert(vendors)
    .values({ companyId: s.company.id, name, ...over })
    .returning();
  return v;
}

describe("adding vendors", () => {
  it("adds with only a name; the company is the session's, never a form field", async () => {
    const res = await add({ name: "  Acme Ltda ", companyId: B.company.id });
    expect(loc(res)).toBe("/dashboard/vendors?added=1");
    const rows = await db
      .select()
      .from(vendors)
      .where(eq(vendors.name, "Acme Ltda"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      companyId: A.company.id,
      country: null,
      contactEmail: null,
      questionnaireStatus: "not_sent",
    });
  });

  it("keeps country (upper-cased), tax id, contact; lower-cases the email", async () => {
    await add({
      name: "Dois",
      country: "br",
      taxId: "11.222.333/0001-81",
      contactName: "Ana",
      contactEmail: "ANA@Forn.TEST",
    });
    const [v] = await db.select().from(vendors).where(eq(vendors.name, "Dois"));
    expect(v).toMatchObject({
      country: "BR",
      taxId: "11.222.333/0001-81",
      contactName: "Ana",
      contactEmail: "ana@forn.test",
    });
  });

  it.each([
    [{ name: "" }, "name_required"],
    [{ name: "x".repeat(201) }, "name_long"],
    [{ name: "ok", country: "BRA" }, "country_invalid"],
    [{ name: "ok", country: "1" }, "country_invalid"],
    [{ name: "ok", contactEmail: "nope" }, "email_invalid"],
    [{ name: "ok", taxId: "9".repeat(61) }, "tax_id_long"],
    [{ name: "ok", contactName: "n".repeat(201) }, "contact_name_long"],
  ])("rejects %j with %s and stores nothing", async (o, code) => {
    const before = (
      await db.select().from(vendors).where(eq(vendors.companyId, A.company.id))
    ).length;
    expect(loc(await add(o))).toBe(`/dashboard/vendors?error=${code}`);
    expect(
      (
        await db
          .select()
          .from(vendors)
          .where(eq(vendors.companyId, A.company.id))
      ).length,
    ).toBe(before);
    expect(await list({ error: code })).toContain('role="alert"');
  });

  it("a 200-character name is accepted", async () => {
    expect(loc(await add({ name: "n".repeat(200) }))).toBe(
      "/dashboard/vendors?added=1",
    );
  });
});

describe("list and detail", () => {
  it("lists only the session company's vendors, with questionnaire and screening state", async () => {
    const a = await mk(A, "Fornecedor A1", { country: "BR" });
    await mk(B, "Fornecedor Secreto B");
    const html = await list();
    expect(html).toContain("Fornecedor A1");
    expect(html).not.toContain("Fornecedor Secreto B");
    expect(html).toContain("Não triado");
    expect(html).toContain("Não enviado");
    await route("vendors/[id]/screen/route", form({}), a.id);
    expect(await list()).toContain(
      "Possível correspondência — revisão necessária",
    );
    as(B);
    expect(await list()).not.toContain("Fornecedor A1");
  });

  it("archive hides a vendor from the list, 'show archived' brings it back, unarchive restores; nothing is deleted", async () => {
    const v = await mk(A, "Arquivável");
    expect(
      loc(await route("vendors/[id]/archive/route", { method: "POST" }, v.id)),
    ).toBe("/dashboard/vendors");
    expect(await list()).not.toContain("Arquivável");
    const shown = await list({ show: "archived" });
    expect(shown).toContain("Arquivável");
    expect(shown).toContain("Arquivado");
    await route("vendors/[id]/unarchive/route", { method: "POST" }, v.id);
    expect(await list()).toContain("Arquivável");
    expect(
      await db.select().from(vendors).where(eq(vendors.id, v.id)),
    ).toHaveLength(1);
  });

  it("the detail page shows decrypted answers, the history of earlier answers, and screening runs with their matches", async () => {
    const v = await mk(A, "Detalhado", { contactEmail: "d@forn.test" });
    const m1 = await sendFor(A, v.id);
    await submitQuestionnaire(
      db,
      m1,
      ans({ respondentName: "Primeira Pessoa" }),
      new Date("2026-10-10T10:00:00Z"),
    );
    const m2 = await sendFor(A, v.id);
    await submitQuestionnaire(
      db,
      m2,
      ans({
        respondentName: "Segunda Pessoa",
        pep: "yes",
        pepDetails: "Irmão é vereador 9z",
      }),
      new Date("2026-10-11T10:00:00Z"),
    );
    await route("vendors/[id]/screen/route", form({}), v.id);
    const html = await detail(v.id);
    expect(html).toContain("Segunda Pessoa");
    expect(html).toContain("Irmão é vereador 9z");
    expect(html).toContain("Respostas anteriores");
    expect(html).toContain("Primeira Pessoa");
    expect(html.indexOf("Segunda Pessoa")).toBeLessThan(
      html.indexOf("Primeira Pessoa"),
    );
    expect(html).toContain("Empresa Listada SA");
    expect(html).toContain("93%");
    expect(html).toContain("us_ofac_sdn");
    expect(html).toContain("NK-9");
    expect(html).toContain("Não é uma investigação de due diligence");
  });

  it("shows 'cannot decrypt — key missing' when the key is gone, and still renders", async () => {
    const v = await mk(A, "Sem chave", { contactEmail: "k@forn.test" });
    await submitQuestionnaire(db, await sendFor(A, v.id), ans());
    const keys = process.env.REPORT_ENCRYPTION_KEYS!;
    vi.stubEnv(
      "REPORT_ENCRYPTION_KEYS",
      "z9:" + Buffer.alloc(32, 7).toString("base64"),
    );
    const html = await detail(v.id);
    vi.stubEnv("REPORT_ENCRYPTION_KEYS", keys);
    expect(html).toContain("Não foi possível descriptografar");
    expect(html).not.toContain("Maria Silva");
  });
});

let sendCount = 0;
async function sendFor(s: Seeded, vendorId: string) {
  const before = mails().length;
  const res = await route(
    "vendors/[id]/send/route",
    { method: "POST" },
    vendorId,
  );
  expect(loc(res)).toBe("/dashboard/vendors?send=sent");
  const all = mails();
  expect(all.length).toBe(before + 1);
  sendCount++;
  return /\/vendor\/([A-Za-z0-9_-]{43})/.exec(all.at(-1)!.text)![1];
}
const ans = (o: Record<string, string> = {}) => {
  const r = parseAnswers({
    respondentName: "Maria Silva",
    respondentRole: "CFO",
    ownershipText: "Holding X",
    pep: "no",
    sanctions: "no",
    antibribery: "yes",
    ...o,
  });
  if (!r.ok) throw new Error("bad test answers");
  return r.answers;
};

describe("send / resend", () => {
  it("sends the questionnaire from the dashboard and shows the state", async () => {
    const v = await mk(A, "Enviável", { contactEmail: "e@forn.test" });
    const token = await sendFor(A, v.id);
    expect(token).toHaveLength(43);
    expect(await list()).toContain("Enviado, aguardando resposta");
    expect(sendCount).toBeGreaterThan(0);
  });

  it("without a contact email: refused with a message, nothing sent", async () => {
    const v = await mk(A, "Sem email");
    const before = mails().length;
    expect(
      loc(await route("vendors/[id]/send/route", { method: "POST" }, v.id)),
    ).toBe("/dashboard/vendors?send=no_email");
    expect(mails().length).toBe(before);
    expect(await list({ send: "no_email" })).toContain(
      "não tem e-mail de contato",
    );
  });

  it("an expired link shows as expired and can be resent", async () => {
    const v = await mk(A, "Vencido", { contactEmail: "x@forn.test" });
    await sendFor(A, v.id);
    await db
      .update(vendors)
      .set({ inviteExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(vendors.id, v.id));
    expect(await list()).toContain("Link expirado");
    await sendFor(A, v.id);
    expect(await list()).toContain("Enviado, aguardando resposta");
  });

  it("email sending not configured: says so, changes nothing", async () => {
    const v = await mk(A, "Sem canal", { contactEmail: "n@forn.test" });
    vi.stubEnv("EMAIL_DEV_SINK", "");
    vi.stubEnv("RESEND_API_KEY", "");
    const res = await route(
      "vendors/[id]/send/route",
      { method: "POST" },
      v.id,
    );
    vi.stubEnv("EMAIL_DEV_SINK", "true");
    expect(loc(res)).toBe("/dashboard/vendors?send=notconfigured");
    expect(
      (await db.select().from(vendors).where(eq(vendors.id, v.id)))[0]
        .inviteTokenHash,
    ).toBeNull();
  });
});

describe("screening from the dashboard", () => {
  it("possible match → detail page with the match; no_match → 'Nenhum resultado nas listas triadas em <data>' plus the caveat", async () => {
    const hit = await mk(A, "Alvo");
    expect(
      loc(await route("vendors/[id]/screen/route", form({}), hit.id)),
    ).toBe(`/dashboard/vendors/${hit.id}?screen=possible_match`);
    const h = await detail(hit.id, { screen: "possible_match" });
    expect(h).toContain("Triagem concluída: possível correspondência");
    expect(h).toContain("Empresa Listada SA");

    useProvider({ status: "no_match", dataset: "stub_ds", matches: [] });
    const clean = await mk(A, "Outro");
    await route("vendors/[id]/screen/route", form({}), clean.id);
    const html = await detail(clean.id);
    expect(html).toMatch(
      /Nenhum resultado nas listas triadas em \d{1,2}\/\d{1,2}\/\d{4}/,
    );
    expect(html).toContain(
      "A ausência de resultados não comprova ausência de risco",
    );
    expect(html).toContain("(stub_ds)");
  });

  it("a second click inside the cooldown is refused with a message and no provider call", async () => {
    const v = await mk(A);
    await route("vendors/[id]/screen/route", form({}), v.id);
    const res = await route("vendors/[id]/screen/route", form({}), v.id);
    expect(loc(res)).toBe(`/dashboard/vendors/${v.id}?screen=cooldown`);
    expect(calls).toBe(1);
    expect(await detail(v.id, { screen: "cooldown" })).toContain(
      "menos de 5 minutos",
    );
  });

  it("an error is shown as 'Falha na triagem', never as no result; the earlier good result stays in the history", async () => {
    const v = await mk(A, "Falho");
    useProvider({ status: "no_match", dataset: "stub_ds", matches: [] });
    await route("vendors/[id]/screen/route", form({}), v.id);
    // the cooldown must pass: screen again through the library with a later "now"
    const { screenVendor } = await import("@/lib/vendors/screen");
    useProvider({ status: "error", code: "rate_limited" });
    const later = new Date(Date.now() + 10 * 60_000);
    await screenVendor(
      db,
      A.company.id,
      A.user.id,
      v.id,
      session.provider as ScreeningProvider,
      later,
    );
    const html = await detail(v.id);
    expect(html).toContain("Falha na triagem");
    expect(html).toContain("rate_limited");
    const list1 = await list();
    expect(list1).toContain("Falha na triagem");
    expect(html).toContain("Nenhum resultado nas listas triadas"); // the history keeps the earlier run
    // ... but the vendor's CURRENT state (list row) is the failure
    const row = list1.slice(list1.indexOf("Falho"));
    expect(row.slice(0, row.indexOf("</tr>"))).not.toContain(
      "Nenhum resultado",
    );
  });

  it("an unconfigured provider: the page says screening is unavailable, offers no button, the route refuses, the questionnaire still works", async () => {
    useProvider(null);
    const v = await mk(A, "Sem triagem", { contactEmail: "s@forn.test" });
    expect(await list()).toContain("Triagem indisponível");
    const html = await detail(v.id);
    expect(html).toContain("Triagem indisponível");
    expect(html).not.toContain(`/dashboard/vendors/${v.id}/screen`);
    expect(loc(await route("vendors/[id]/screen/route", form({}), v.id))).toBe(
      `/dashboard/vendors/${v.id}?screen=unavailable`,
    );
    expect(calls).toBe(0);
    await sendFor(A, v.id); // questionnaire unaffected
    expect(
      await db
        .select()
        .from(vendorScreenings)
        .where(eq(vendorScreenings.vendorId, v.id)),
    ).toHaveLength(0);
  });

  it("archived vendors cannot be screened", async () => {
    const v = await mk(A, "Arq", { archivedAt: new Date() });
    expect(loc(await route("vendors/[id]/screen/route", form({}), v.id))).toBe(
      `/dashboard/vendors/${v.id}?screen=archived`,
    );
    expect(calls).toBe(0);
  });
});

describe("tenant isolation of every vendor route", () => {
  it("another company's vendor is a 404 on the page and on every handler, and nothing changes or is sent", async () => {
    const b = await mk(B, "Vendor do B", { contactEmail: "b@forn.test" });
    const mailsBefore = mails().length;
    await expect(detail(b.id)).rejects.toThrow("NOT_FOUND");
    for (const r of ["send", "archive", "unarchive", "screen"]) {
      const res = await route(
        `vendors/[id]/${r}/route`,
        { method: "POST" },
        b.id,
      );
      expect(res.status, r).toBe(404);
    }
    expect(calls).toBe(0);
    expect(mails().length).toBe(mailsBefore);
    const [after] = await db.select().from(vendors).where(eq(vendors.id, b.id));
    expect(after).toMatchObject({
      archivedAt: null,
      inviteTokenHash: null,
      screeningResult: null,
    });
    expect(
      await db
        .select()
        .from(vendorScreenings)
        .where(eq(vendorScreenings.vendorId, b.id)),
    ).toHaveLength(0);
    // a malformed id is a 404 too
    await expect(detail("not-a-uuid")).rejects.toThrow("NOT_FOUND");
    expect(
      (await route("vendors/[id]/screen/route", { method: "POST" }, "zzz"))
        .status,
    ).toBe(404);
  });

  it("without a session the handlers answer 401 and the pages redirect to /login", async () => {
    as(null);
    const v = await mk(B);
    for (const r of ["send", "archive", "unarchive", "screen"])
      expect(
        (await route(`vendors/[id]/${r}/route`, { method: "POST" }, v.id))
          .status,
      ).toBe(401);
    expect((await add({ name: "x" })).status).toBe(401);
    await expect(list()).rejects.toThrow("REDIRECT /login");
    await expect(detail(v.id)).rejects.toThrow("REDIRECT /login");
  });

  it("the detail page never renders another company's data (answers, screenings)", async () => {
    const b = await mk(B, "Segredo B", { contactEmail: "sb@forn.test" });
    as(B);
    await submitQuestionnaire(
      db,
      await sendFor(B, b.id),
      ans({ respondentName: "Pessoa Secreta B" }),
    );
    as(A);
    const a = await mk(A, "Vendor A");
    const html = await detail(a.id);
    expect(html).not.toContain("Pessoa Secreta B");
    expect(html).not.toContain("Segredo B");
  });
});

describe("every dashboard vendor file uses the tenant gate", () => {
  const root = path.resolve(__dirname, "..", "app/(app)/dashboard/vendors");
  const walk = (d: string): string[] =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
    );
  it("each page.tsx / route.ts calls requireTenant()/requireTenantRoute(), and none reads company_id from the request", () => {
    const files = walk(root).filter((f) => /(page\.tsx|route\.ts)$/.test(f));
    expect(files.length).toBe(7);
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src, f).toMatch(/\brequireTenant(Route)?\(\)/);
      expect(src, f).not.toMatch(
        /(formData|searchParams|params|form)[^;\n]*company_?id/i,
      );
    }
  });
});

describe("summary for the binder", () => {
  it("is tenant-scoped and reports questionnaire state/date and the last screening", async () => {
    const v = await mk(A, "Resumo 1", {
      country: "BR",
      contactEmail: "r@forn.test",
    });
    await mk(A, "Resumo 2");
    await mk(A, "Arquivado", { archivedAt: new Date() });
    await mk(B, "Do B");
    await submitQuestionnaire(
      db,
      await sendFor(A, v.id),
      ans(),
      new Date("2026-10-12T10:00:00Z"),
    );
    await route("vendors/[id]/screen/route", form({}), v.id);
    const sum = await summarizeVendors(db, A.company.id);
    expect(sum.map((s) => s.name).sort()).toEqual(["Resumo 1", "Resumo 2"]);
    const one = sum.find((s) => s.name === "Resumo 1")!;
    expect(one).toMatchObject({
      country: "BR",
      questionnaire: "submitted",
      questionnaireDate: new Date("2026-10-12T10:00:00Z"),
      screening: {
        status: "possible_match",
        dataset: "stub_ds",
        possibleMatchCount: 1,
      },
    });
    expect(sum.find((s) => s.name === "Resumo 2")).toMatchObject({
      questionnaire: "not_sent",
      screening: null,
    });
    expect(
      (await summarizeVendors(db, B.company.id)).map((s) => s.name),
    ).toEqual(["Do B"]);
  });
});

describe("copy: a screening tool, never a verdict", () => {
  const FORBIDDEN =
    /\b(approved|clear|clean|safe|aprovad[oa]s?|limp[oa]s?|segur[oa]s?|aprobad[oa]s?|limpi[oa]s?|due diligence completa)\b/i;
  const flat = (o: unknown, prefix = ""): Record<string, string> =>
    Object.fromEntries(
      Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
        typeof v === "string"
          ? [[`${prefix}${k}`, v]]
          : Object.entries(flat(v, `${prefix}${k}.`)),
      ),
    );
  it.each(LOCALES)(
    "%s: the vendor strings (dashboard, public form, emails) contain none of the verdict words",
    (l) => {
      const m = getMessages(l) as unknown as Record<string, unknown>;
      const mine = {
        ...flat(
          (m.dashboard as Record<string, unknown>).vendors,
          "dashboard.vendors.",
        ),
        ...flat(m.vendor, "vendor."),
        "email.vendorSubject": (m.email as Record<string, string>)
          .vendorSubject,
        "email.vendorBody": (m.email as Record<string, string>).vendorBody,
        "email.vendorButton": (m.email as Record<string, string>).vendorButton,
      };
      expect(Object.keys(mine).length).toBeGreaterThan(90);
      const bad = Object.entries(mine)
        .filter(([, v]) => FORBIDDEN.test(v))
        .map(([k]) => k);
      expect(bad).toEqual([]);
    },
  );

  it("every locale's disclaimer carries the lists-and-date caveat and the 'absence of results' line; the pt-BR states are the specified ones", () => {
    const pt = (
      getMessages("pt-BR") as unknown as {
        dashboard: {
          vendors: { screenState: Record<string, string>; disclaimer: string };
        };
      }
    ).dashboard.vendors;
    expect(pt.screenState.never).toBe("Não triado");
    expect(pt.screenState.no_match).toBe(
      "Nenhum resultado nas listas triadas em {date}",
    );
    expect(pt.screenState.possible_match).toBe(
      "Possível correspondência — revisão necessária",
    );
    expect(pt.screenState.error).toBe("Falha na triagem");
    expect(pt.disclaimer).toBe(
      "Ferramenta de triagem automatizada contra listas públicas de sanções ({dataset}). Não é uma investigação de due diligence nem uma determinação legal. A ausência de resultados não comprova ausência de risco.",
    );
    for (const l of LOCALES) {
      const v = (
        getMessages(l) as unknown as {
          dashboard: { vendors: Record<string, string> };
        }
      ).dashboard.vendors;
      expect(v.disclaimer).toContain("{dataset}");
    }
  });
});
