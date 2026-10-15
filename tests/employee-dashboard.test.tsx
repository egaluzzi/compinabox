// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { acknowledgments, employees, employeeSessions } from "@/lib/db/schema";
import { listDocuments } from "@/lib/documents/store";
import { DOCUMENT_TYPES } from "@/lib/documents/types";
import { sendInvite, sendPending } from "@/lib/employee/invites";
import { isInviteUsable, sha256 } from "@/lib/employee/session";
import { submitDisclosure } from "@/lib/employee/disclosure";
import { recordPass } from "@/lib/employee/training";
import type { EmailMessage, EmailSender } from "@/lib/email";
import { extractPdf } from "./helpers/pdf";
import { uid, useTestDb } from "./helpers/db";
import { seedInvited, seedPortalCompany } from "./helpers/employee";

// Only the admin session lookup and next/navigation are mocked; the gate, queries, crypto, email
// sink, CSV, PDF and rendering are real, on a real Postgres.
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
  usePathname: () => "/dashboard/employees",
}));

let db: ReturnType<typeof useTestDb>;
type Seeded = Awaited<ReturnType<typeof seedPortalCompany>>;
let A: Seeded;
let B: Seeded;
let outbox: string;
const as = (s: Seeded | null) => {
  session.current = s && { userId: s.user.id, companyId: s.company.id };
};
const D = "@/app/(app)/dashboard";

beforeAll(() => {
  db = useTestDb();
  outbox = mkdtempSync(path.join(tmpdir(), "outbox-"));
  vi.stubEnv("EMAIL_DEV_SINK", "true");
  vi.stubEnv("EMAIL_SINK_DIR", outbox);
  vi.stubEnv("APP_URL", "http://localhost:3000");
});
beforeEach(async () => {
  A = await seedPortalCompany(db, `da-${uid()}`);
  B = await seedPortalCompany(db, `db-${uid()}`);
  as(A);
});

const mails = (): EmailMessage[] =>
  readdirSync(outbox)
    .sort()
    .map((f) => JSON.parse(readFileSync(path.join(outbox, f), "utf8")));
const mailsTo = (to: string) => mails().filter((m) => m.to === to);

async function renderPage(mod: string, props: Record<string, unknown> = {}) {
  const page = (await import(/* @vite-ignore */ `${D}/${mod}`)).default;
  const layout = (await import(`${D}/layout`)).default;
  const body = (await page(props)) as ReactNode;
  return renderToStaticMarkup(
    createElement("div", null, await layout({ children: body })),
  );
}
const grid = (sp: Record<string, string> = {}) =>
  renderPage("employees/page", { searchParams: Promise.resolve(sp) });
const detail = (id: string) =>
  renderPage("employees/[id]/page", { params: Promise.resolve({ id }) });
const route = async (mod: string, init?: RequestInit, id?: string) =>
  (await import(/* @vite-ignore */ `${D}/${mod}`))[init?.method ?? "GET"](
    new Request("http://localhost/x", init),
    { params: Promise.resolve({ id }) },
  ) as Promise<Response>;
const csvFile = (text: string | Uint8Array, name = "equipe.csv") => {
  const f = new FormData();
  f.set("file", new File([text as BlobPart], name, { type: "text/csv" }));
  return { method: "POST", body: f };
};
const importCsv = (text: string | Uint8Array) =>
  route("employees/import/route", csvFile(text));
const loc = (r: Response) => new URL(r.headers.get("location")!).search;
const emps = (companyId: string) =>
  db.select().from(employees).where(eq(employees.companyId, companyId));

describe("CSV import (dashboard)", () => {
  it("imports a ;-delimited UTF-8 file with a BOM: lower-cases emails, reports counts and bad lines, echoes no personal data", async () => {
    const text =
      "\uFEFFnome;email\nAna Souza;ANA@Empresa.TEST\nBeto;beto@empresa.test\nSem Email;nao-e-email\nAna Souza;ana@empresa.test\n";
    const res = await importCsv(text);
    expect(res.status).toBe(303);
    const q = loc(res);
    expect(q).toContain("imported=2.0.1.1"); // created.reactivated.skipped(dup in file).invalid
    expect(q).toContain("bad=4:email_invalid");
    expect(q).not.toMatch(/ana|beto|empresa|souza/i); // no names or emails in the URL
    expect((await emps(A.company.id)).map((e) => e.email).sort()).toEqual([
      "ana@empresa.test",
      "beto@empresa.test",
    ]);
    const html = await grid(Object.fromEntries(new URLSearchParams(q)));
    expect(html).toContain("Criados: 2");
    expect(html).toContain("Linha 4: o e-mail não é válido");
    expect(html).toContain("Ana Souza");
  });

  it("an existing active email is skipped; a deactivated one is reactivated and left un-invited", async () => {
    const inv = await seedInvited(
      db,
      A.company.id,
      "Carla",
      "carla@empresa.test",
    );
    const off = await seedInvited(
      db,
      A.company.id,
      "Davi",
      "davi@empresa.test",
    );
    await db
      .update(employees)
      .set({ deactivatedAt: new Date() })
      .where(eq(employees.id, off.employee.id));
    const res = await importCsv(
      "name,email\nCarla Nova,carla@empresa.test\nDavi,DAVI@empresa.test\nEva,eva@empresa.test\n",
    );
    expect(loc(res)).toContain("imported=1.1.1.0");
    const rows = Object.fromEntries(
      (await emps(A.company.id)).map((e) => [e.email, e]),
    );
    expect(rows["carla@empresa.test"].name).toBe("Carla"); // untouched
    expect(rows["carla@empresa.test"].id).toBe(inv.employee.id);
    expect(rows["davi@empresa.test"].deactivatedAt).toBeNull();
    expect(rows["davi@empresa.test"].invitedAt).toBeNull();
    expect(rows["davi@empresa.test"].inviteTokenHash).toBeNull();
    expect(rows["eva@empresa.test"]).toBeTruthy();
  });

  it("file-level problems redirect with a friendly code and import nothing", async () => {
    for (const [body, code] of [
      ["", "no_file"],
      ["email,name\nx,y", "bad_header"],
      [new Uint8Array([0x89, 0x50, 0, 0]), "not_text"],
      ["name,email\n" + "a,b@c.test\n".repeat(501), "too_many_rows"],
      [new Uint8Array(256 * 1024 + 1).fill(97), "too_large"],
    ] as const) {
      const res = await importCsv(body);
      expect(loc(res), code).toBe(`?fileError=${code}`);
    }
    expect(await emps(A.company.id)).toHaveLength(0);
    const html = await grid({ fileError: "bad_header" });
    expect(html).toContain("A primeira linha deve ser um cabeçalho");
  });

  it("is tenant-scoped: the same email can exist in two companies; B's import never touches A", async () => {
    await importCsv("name,email\nShared,shared@empresa.test\n");
    as(B);
    await importCsv("name,email\nShared B,shared@empresa.test\n");
    expect((await emps(A.company.id)).map((e) => e.name)).toEqual(["Shared"]);
    expect((await emps(B.company.id)).map((e) => e.name)).toEqual(["Shared B"]);
  });

  it("without a session: 401, nothing written", async () => {
    as(null);
    const res = await importCsv("name,email\nX,x@y.test\n");
    expect(res.status).toBe(401);
  });
});

describe("invitations", () => {
  it("sends the CONTENT.md invitation (pt-BR) with a personal link, no document text; stores only the hash; sets invited_at/expires 14 days", async () => {
    const e = (
      await seedInvited(db, A.company.id, "Fábio", "fabio@empresa.test")
    ).employee;
    await db
      .update(employees)
      .set({ inviteTokenHash: null, invitedAt: null, inviteExpiresAt: null })
      .where(eq(employees.id, e.id));
    const res = await route(
      "employees/[id]/invite/route",
      { method: "POST" },
      e.id,
    );
    expect(res.status).toBe(303);
    expect(loc(res)).toBe("?invite=sent");
    const [mail] = mailsTo("fabio@empresa.test");
    expect(mail.subject).toBe(
      `A ${A.company.name} convida você a concluir seu treinamento de compliance`,
    );
    expect(mail.text).toContain("Olá Fábio");
    expect(mail.text).toContain(A.company.name);
    expect(mail.text).toContain("15-20 min");
    const token = /\/employee\/([A-Za-z0-9_-]{43})/.exec(mail.text)![1];
    expect(mail.text).toContain(`http://localhost:3000/employee/${token}`);
    expect(mail.html).toContain(
      `href="http://localhost:3000/employee/${token}"`,
    );
    // no document content, no other personal data
    for (const d of await listDocuments(db, A.company.id)) {
      const doc = JSON.parse(d.content);
      expect(mail.text).not.toContain(doc.title);
      expect(mail.text).not.toContain(
        doc.sections[0].paragraphs[0].slice(0, 30),
      );
    }
    const [row] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, e.id));
    expect(row.inviteTokenHash).toBe(sha256(token));
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row.invitedAt).not.toBeNull();
    const days =
      (row.inviteExpiresAt!.getTime() - row.invitedAt!.getTime()) / 86_400_000;
    expect(days).toBeCloseTo(14, 3);
  });

  it("the es-AR company gets the CONTENT.md es-AR wording; en and es-MX are faithful", async () => {
    const { inviteEmail } = await import("@/lib/employee/invites");
    const emp = { name: "Lucía", email: "l@x.test" };
    const ar = inviteEmail(
      { name: "ACME SA", country: "ar" },
      emp,
      "http://x/employee/t",
    );
    expect(ar.subject).toBe(
      "ACME SA te invita a completar tu capacitación de cumplimiento",
    );
    expect(ar.text).toContain(
      "Hola Lucía, ACME SA implementó un programa de cumplimiento y necesitamos que completes dos pasos cortos: 1) leer y aceptar el código de conduct".replace(
        "conduct",
        "conducta",
      ),
    );
    expect(ar.text).toContain(
      "2) completar una capacitación breve (15-20 min).",
    );
    expect(ar.text).toContain("Empezar →: http://x/employee/t");
    const mx = inviteEmail(
      { name: "ACME SA", country: "mx" },
      emp,
      "http://x/employee/t",
    );
    expect(mx.subject).toContain("te invita a completar tu capacitación");
  });

  it("every send issues a NEW token and kills the previous link", async () => {
    const e = (await seedInvited(db, A.company.id, "Gil", "gil@empresa.test"))
      .employee;
    await route("employees/[id]/invite/route", { method: "POST" }, e.id);
    await route("employees/[id]/invite/route", { method: "POST" }, e.id);
    const tokens = mailsTo("gil@empresa.test").map(
      (m) => /\/employee\/([A-Za-z0-9_-]{43})/.exec(m.text)![1],
    );
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).not.toBe(tokens[1]);
    expect(await isInviteUsable(db, tokens[0])).toBe(false);
    expect(await isInviteUsable(db, tokens[1])).toBe(true);
  });

  it("a failed send leaves invited_at unset (and an existing link working)", async () => {
    const boom: EmailSender = {
      send: async () => {
        throw new Error("smtp down");
      },
    };
    const company = { id: A.company.id, name: A.company.name, country: "br" };
    // first invitation fails: nothing is stored
    const fresh = (
      await seedInvited(db, A.company.id, "Hana", "hana@empresa.test")
    ).employee;
    await db
      .update(employees)
      .set({ inviteTokenHash: null, invitedAt: null, inviteExpiresAt: null })
      .where(eq(employees.id, fresh.id));
    expect(await sendInvite(db, company, fresh.id, boom)).toBe("failed");
    const [r1] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, fresh.id));
    expect(r1.invitedAt).toBeNull();
    expect(r1.inviteTokenHash).toBeNull();
    // a resend that fails keeps the previous link alive
    const live = await seedInvited(db, A.company.id, "Ivo", "ivo@empresa.test");
    expect(await sendInvite(db, company, live.employee.id, boom)).toBe(
      "failed",
    );
    expect(await isInviteUsable(db, live.token)).toBe(true);
  });

  it("email not configured: friendly redirect, nothing changed", async () => {
    const e = (await seedInvited(db, A.company.id, "Jô", "jo@empresa.test"))
      .employee;
    vi.stubEnv("EMAIL_DEV_SINK", "false");
    vi.stubEnv("RESEND_API_KEY", "");
    const res = await route(
      "employees/[id]/invite/route",
      { method: "POST" },
      e.id,
    );
    vi.stubEnv("EMAIL_DEV_SINK", "true");
    expect(loc(res)).toBe("?invite=notconfigured");
    const html = await grid({ invite: "notconfigured" });
    expect(html).toContain("O envio de e-mail não está configurado");
  });

  it("'send pending' sends at most 50 per click, sequentially, and reports sent / failed / remaining", async () => {
    await db.insert(employees).values(
      Array.from({ length: 55 }, (_, i) => ({
        companyId: A.company.id,
        name: `E${String(i).padStart(2, "0")}`,
        email: `bulk${i}@empresa.test`,
      })),
    );
    // one already-invited active employee (not pending) and one with an expired unused link (pending)
    await seedInvited(db, A.company.id, "Ok", "ok@empresa.test");
    await seedInvited(db, A.company.id, "Venc", "venc@empresa.test", {
      expiresInMs: -1000,
    });
    const sent: string[] = [];
    const sender: EmailSender = {
      send: async (m) => {
        sent.push(m.to);
      },
    };
    const company = { id: A.company.id, name: A.company.name, country: "br" };
    const first = await sendPending(db, company, new Date(), sender);
    expect(first).toEqual({ sent: 50, failed: 0, remaining: 6 });
    expect(new Set(sent).size).toBe(50);
    expect(sent).not.toContain("ok@empresa.test");
    const second = await sendPending(db, company, new Date(), sender);
    expect(second).toEqual({ sent: 6, failed: 0, remaining: 0 });
    expect(sent).toContain("venc@empresa.test");
    const third = await sendPending(db, company, new Date(), sender);
    expect(third).toEqual({ sent: 0, failed: 0, remaining: 0 });
  });

  it("'send pending' counts failures, leaves those employees pending, and never touches deactivated ones", async () => {
    const [bad, ok, off] = await db
      .insert(employees)
      .values([
        { companyId: A.company.id, name: "Bad", email: "bad@empresa.test" },
        { companyId: A.company.id, name: "Good", email: "good@empresa.test" },
        {
          companyId: A.company.id,
          name: "Off",
          email: "off@empresa.test",
          deactivatedAt: new Date(),
        },
      ])
      .returning();
    const sender: EmailSender = {
      send: async (m) => {
        if (m.to === "bad@empresa.test") throw new Error("bounce");
      },
    };
    const r = await sendPending(
      db,
      { id: A.company.id, name: "X", country: "br" },
      new Date(),
      sender,
    );
    expect(r).toEqual({ sent: 1, failed: 1, remaining: 1 });
    const get = async (id: string) =>
      (await db.select().from(employees).where(eq(employees.id, id)))[0];
    expect((await get(bad.id)).invitedAt).toBeNull();
    expect((await get(ok.id)).invitedAt).not.toBeNull();
    expect((await get(off.id)).invitedAt).toBeNull();
  });

  it("the route sends the batch through the real sender and redirects with the counts", async () => {
    await db.insert(employees).values([
      { companyId: A.company.id, name: "P1", email: "p1@empresa.test" },
      { companyId: A.company.id, name: "P2", email: "p2@empresa.test" },
    ]);
    const res = await route("employees/invite-pending/route", {
      method: "POST",
    });
    expect(loc(res)).toBe("?batch=2.0.0");
    expect(mailsTo("p1@empresa.test")).toHaveLength(1);
    expect(mailsTo("p2@empresa.test")).toHaveLength(1);
    const html = await grid({ batch: "2.0.0" });
    expect(html).toContain("enviados: 2");
  });
});

describe("deactivate / reactivate and the grid", () => {
  it("deactivating never deletes: records stay, sessions and the invite die, the grid and the numbers drop the employee", async () => {
    const a = (await seedInvited(db, A.company.id, "Keep", "keep@empresa.test"))
      .employee;
    const b = await seedInvited(
      db,
      A.company.id,
      "Leave",
      "leave@empresa.test",
    );
    const [doc] = await listDocuments(db, A.company.id);
    await db.insert(acknowledgments).values({
      companyId: A.company.id,
      employeeId: b.employee.id,
      documentId: doc.id,
    });
    await db.insert(employeeSessions).values({
      companyId: A.company.id,
      employeeId: b.employee.id,
      tokenHash: sha256("s"),
      expiresAt: new Date(Date.now() + 1e6),
    });
    const res = await route(
      "employees/[id]/deactivate/route",
      { method: "POST" },
      b.employee.id,
    );
    expect(res.status).toBe(303);
    expect(
      await db
        .select()
        .from(employeeSessions)
        .where(eq(employeeSessions.employeeId, b.employee.id)),
    ).toHaveLength(0);
    expect(await isInviteUsable(db, b.token)).toBe(false);
    expect(
      await db
        .select()
        .from(acknowledgments)
        .where(eq(acknowledgments.employeeId, b.employee.id)),
    ).toHaveLength(1);
    const html = await grid();
    expect(html).toContain("Keep");
    expect(html).not.toContain("Leave");
    expect(html).toContain("1 de 1 colaboradores".replace("1 de 1", "0 de 1")); // only Keep counts
    const all = await grid({ show: "deactivated" });
    expect(all).toContain("Leave");
    expect(all).toContain("Desativado");
    expect(all).toContain("Reativar");
    expect(a.id).toBeTruthy();
    const re = await route(
      "employees/[id]/reactivate/route",
      { method: "POST" },
      b.employee.id,
    );
    expect(re.status).toBe(303);
    expect(await grid()).toContain("Leave");
    expect(
      (
        await route(
          "employees/[id]/reactivate/route",
          { method: "POST" },
          b.employee.id,
        )
      ).status,
    ).toBe(303); // idempotent
  });

  it("empty roster shows the empty state; the overview keeps '—'", async () => {
    const html = await grid();
    expect(html).toContain("Nenhum colaborador ainda");
    const overview = await renderPage("page");
    expect(overview).toContain("—");
    expect(overview).toContain("Nenhum colaborador ainda");
  });

  it("the overview shows the real completion: one fully complete employee of one = 100%", async () => {
    const e = (await seedInvited(db, A.company.id, "Full", "full@empresa.test"))
      .employee;
    const me = { companyId: A.company.id, employeeId: e.id };
    for (const d of await listDocuments(db, A.company.id))
      await db.insert(acknowledgments).values({
        companyId: A.company.id,
        employeeId: e.id,
        documentId: d.id,
      });
    await recordPass(db, me, 100);
    await submitDisclosure(db, me, { hasConflict: false, details: "" });
    const overview = await renderPage("page");
    expect(overview).toContain("100%");
    expect(overview).toContain("1 de 1 colaboradores com tudo concluído");
    expect(overview).toContain("1 colaborador");
  });
});

describe("employee detail page", () => {
  it("shows acknowledgments with timestamp and IP, the training score, and the DECRYPTED disclosure", async () => {
    const e = (
      await seedInvited(db, A.company.id, "Detalhe", "detalhe@empresa.test")
    ).employee;
    const me = { companyId: A.company.id, employeeId: e.id };
    const [doc] = await listDocuments(db, A.company.id);
    await db.insert(acknowledgments).values({
      companyId: A.company.id,
      employeeId: e.id,
      documentId: doc.id,
      ipAddress: "203.0.113.77",
    });
    await recordPass(db, me, 92);
    await submitDisclosure(db, me, {
      hasConflict: true,
      details: "Minha prima é dona da fornecedora XPTO",
    });
    const html = await detail(e.id);
    expect(html).toContain("Detalhe");
    expect(html).toContain("203.0.113.77");
    expect(html).toContain("Pontuação 92%");
    expect(html).toContain("Tem algo a declarar");
    expect(html).toContain("Minha prima é dona da fornecedora XPTO");
    expect(html).toContain("Versão 1");
  });

  it("'cannot decrypt — key missing' state when the key ring no longer has the key", async () => {
    const e = (
      await seedInvited(db, A.company.id, "Sem Chave", "semchave@empresa.test")
    ).employee;
    await submitDisclosure(
      db,
      { companyId: A.company.id, employeeId: e.id },
      { hasConflict: true, details: "conteúdo secreto 91ab" },
    );
    const original = process.env.REPORT_ENCRYPTION_KEYS;
    vi.stubEnv(
      "REPORT_ENCRYPTION_KEYS",
      `other:${Buffer.alloc(32, 7).toString("base64")}`,
    );
    const html = await detail(e.id);
    vi.stubEnv("REPORT_ENCRYPTION_KEYS", original!);
    expect(html).toContain("Não foi possível descriptografar");
    expect(html).not.toContain("conteúdo secreto 91ab");
  });

  it("another company's employee is a 404 (page and every action), and nothing changes", async () => {
    const victim = (
      await seedInvited(db, A.company.id, "Vítima", "vitima@empresa.test")
    ).employee;
    as(B);
    await expect(detail(victim.id)).rejects.toThrow("NOT_FOUND");
    await expect(detail("not-a-uuid")).rejects.toThrow("NOT_FOUND");
    for (const act of ["invite", "deactivate", "reactivate"])
      expect(
        (
          await route(
            `employees/[id]/${act}/route`,
            { method: "POST" },
            victim.id,
          )
        ).status,
      ).toBe(404);
    const [row] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, victim.id));
    expect(row.deactivatedAt).toBeNull();
    expect(mailsTo("vitima@empresa.test")).toHaveLength(0);
    const html = await grid();
    expect(html).not.toContain("Vítima");
    const csv = await (await route("employees/export.csv/route")).text();
    expect(csv).not.toContain("vitima@empresa.test");
  });
});

describe("exports (CSV and PDF) equal the grid", () => {
  async function seedMixed() {
    const rows = await db
      .insert(employees)
      .values([
        {
          companyId: A.company.id,
          name: "Ana Zeta",
          email: "ana@empresa.test",
        },
        {
          companyId: A.company.id,
          name: 'Bruno =HYPERLINK("http://evil")',
          email: "bruno@empresa.test",
        },
        {
          companyId: A.company.id,
          name: 'Carla, "CC" Lima',
          email: "carla@empresa.test",
        },
        { companyId: A.company.id, name: "+Davi", email: "davi@empresa.test" },
      ])
      .returning();
    const all = await listDocuments(db, A.company.id);
    // the first three documents in the grid's column order
    const docs = DOCUMENT_TYPES.map((t) => all.find((d) => d.type === t)!);
    const ana = rows.find((r) => r.name === "Ana Zeta")!;
    const carla = rows.find((r) => r.email === "carla@empresa.test")!;
    for (const d of docs.slice(0, 3))
      await db.insert(acknowledgments).values({
        companyId: A.company.id,
        employeeId: ana.id,
        documentId: d.id,
        ipAddress: "198.51.100.23",
      });
    await db.insert(acknowledgments).values({
      companyId: A.company.id,
      employeeId: carla.id,
      documentId: docs[0].id,
      ipAddress: "198.51.100.24",
    });
    await recordPass(db, { companyId: A.company.id, employeeId: ana.id }, 100);
    await submitDisclosure(
      db,
      { companyId: A.company.id, employeeId: ana.id },
      { hasConflict: true, details: "DISCLOSURE-SECRET-5521" },
    );
    return rows;
  }

  it("CSV: same rows and marks as the grid; ISO timestamps; no IP and no disclosure content; formula-injection safe", async () => {
    await seedMixed();
    const res = await route("employees/export.csv/route");
    expect(res.headers.get("content-type")).toMatch(/text\/csv/);
    expect(res.headers.get("content-disposition")).toMatch(/attachment/);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const csv = await res.text();
    // text() drops the BOM; check the raw bytes (Excel needs it for accents)
    const raw = Buffer.from(
      await (await route("employees/export.csv/route")).arrayBuffer(),
    );
    expect([...raw.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(csv).not.toContain("198.51.100");
    expect(csv).not.toContain("DISCLOSURE-SECRET-5521");
    expect(csv).not.toMatch(/\bIP\b/i);
    const { parseCsv } = await import("@/lib/employee/csv");
    const parsed = parseCsv(csv, ",");
    expect(parsed[0].cells).toHaveLength(11);
    expect(parsed[0].cells.slice(0, 3)).toEqual(["Nome", "E-mail", "Convite"]);
    const body = parsed.slice(1).map((r) => r.cells);
    expect(body).toHaveLength(4);
    // formula injection neutralised on name cells
    const names = body.map((r) => r[0]);
    expect(names).toContain("'+Davi");
    expect(names).toContain(
      '\'Bruno =HYPERLINK("http://evil")'.replace("'Bruno", "Bruno"),
    ); // only a LEADING = triggers; this one starts with B
    expect(names).toContain('Carla, "CC" Lima');
    const ana = body.find((r) => r[1] === "ana@empresa.test")!;
    expect(
      ana
        .slice(3, 6)
        .every((c) => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(c)),
    ).toBe(true);
    expect(ana.slice(6, 9)).toEqual(["pending", "pending", "pending"]);
    expect(ana[9]).toMatch(/^\d{4}-/); // training
    expect(ana[10]).toMatch(/^\d{4}-/); // disclosure: only submitted + date
    // equals the grid: same employees in the same order, same number of done marks per employee
    const html = await grid();
    const gridRows = [
      ...html.matchAll(/<tr class="border-b border-slate-200">(.*?)<\/tr>/g),
    ].map((m) => m[1]);
    expect(gridRows).toHaveLength(body.length);
    body.forEach((r, i) => {
      const doneInCsv = r.slice(3).filter((c) => /^\d{4}-/.test(c)).length;
      const doneInGrid = (gridRows[i].match(/Feito /g) ?? []).length;
      expect(doneInGrid, r[1]).toBe(doneInCsv);
      expect(gridRows[i]).toContain(r[1]);
    });
    expect(html).not.toContain("198.51.100");
    expect(html).not.toContain("DISCLOSURE-SECRET-5521");
  });

  it("a name that STARTS with a formula character is exported as text (apostrophe), including from a hostile import", async () => {
    await importCsv(
      "name,email\n\"=cmd|' /C calc'!A0\",evil@empresa.test\n@SUM(A1),at@empresa.test\n-5+5,minus@empresa.test\n",
    );
    const csv = await (await route("employees/export.csv/route")).text();
    expect(csv).toContain("'=cmd|' /C calc'!A0,evil@empresa.test");
    expect(csv).toContain("'@SUM(A1)");
    expect(csv).toContain("'-5+5");
    expect(csv).not.toMatch(/(^|,|\n)=cmd/);
  });

  it("the deactivated toggle applies to the export as well", async () => {
    const rows = await seedMixed();
    await db
      .update(employees)
      .set({ deactivatedAt: new Date() })
      .where(eq(employees.id, rows[0].id));
    const plain = await (await route("employees/export.csv/route")).text();
    const all = await (
      (await (
        await import(`${D}/employees/export.csv/route`)
      ).GET(new Request("http://localhost/x?show=deactivated"))) as Response
    ).text();
    const count = (s: string) => s.trim().split("\r\n").length;
    expect(count(all)).toBe(count(plain) + 1);
  });

  it("PDF: a real A4 PDF with the roster, page numbers, the disclaimer; no IP, no disclosure content; paginates", async () => {
    await seedMixed();
    await db.insert(employees).values(
      Array.from({ length: 80 }, (_, i) => ({
        companyId: A.company.id,
        name: `Colaborador ${String(i).padStart(3, "0")}`,
        email: `c${i}@empresa.test`,
      })),
    );
    const res = await route("employees/export.pdf/route");
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toMatch(/attachment/);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    const { text, numPages, pages } = await extractPdf(buf);
    expect(numPages).toBeGreaterThan(1);
    expect(text).toContain(A.company.name);
    expect(text).toContain("Situação dos colaboradores");
    expect(text).toContain("Ana Zeta");
    expect(text).toContain("Colaborador 079");
    expect(text).not.toContain("198.51.100");
    expect(text).not.toContain("DISCLOSURE-SECRET-5521");
    for (let i = 1; i <= numPages; i++) {
      expect(pages[i - 1]).toContain(`Página ${i} de ${numPages}`);
      expect(pages[i - 1]).toContain("Nome"); // the table header repeats on every page
    }
    expect(text.replace(/\s+/g, " ")).toContain("não garante a conformidade");
  });

  it("exports need a session (401) and are tenant-scoped", async () => {
    await seedMixed();
    as(B);
    const csvB = await (await route("employees/export.csv/route")).text();
    expect(csvB.trim().split("\r\n")).toHaveLength(1); // header only
    const pdfB = await extractPdf(
      Buffer.from(
        await (await route("employees/export.pdf/route")).arrayBuffer(),
      ),
    );
    expect(pdfB.text).not.toContain("Ana Zeta");
    as(null);
    expect((await route("employees/export.csv/route")).status).toBe(401);
    expect((await route("employees/export.pdf/route")).status).toBe(401);
  });
});

describe("training dashboard page", () => {
  it("shows the module overview, the per-employee results and the company training rate", async () => {
    const e1 = (
      await seedInvited(db, A.company.id, "Passou", "passou@empresa.test")
    ).employee;
    await seedInvited(db, A.company.id, "Nao Fez", "naofez@empresa.test");
    await recordPass(db, { companyId: A.company.id, employeeId: e1.id }, 83);
    const html = await renderPage("training/page");
    expect(html).toContain("6 lições");
    expect(html).toContain("questionário de 12 perguntas");
    expect(html).toContain("nota de aprovação 80%");
    expect(html).toContain("rascunho pendente de revisão");
    expect(html).toContain("O código de conduta: o essencial");
    expect(html).toContain("Aprovado — 83%");
    expect(html).toContain("Não concluído");
    expect(html).toContain("1 de 2 colaboradores ativos (50%)");
    expect(html).toContain("tentativas reprovadas não são registradas");
  });

  it("a company without training content (es-AR) sees the unavailable state", async () => {
    const ar = await seedPortalCompany(db, `ar-${uid()}`, "ar");
    as(ar);
    const html = await renderPage("training/page");
    expect(html).toContain("La capacitación aún no está disponible");
    expect(html).not.toContain("O código de conduta: o essencial");
  });
});

it("the employees grid never shows another company's rows", async () => {
  await db.insert(employees).values({
    companyId: B.company.id,
    name: "Pessoa de B",
    email: "b@empresa.test",
  });
  expect(await grid()).not.toContain("Pessoa de B");
  as(B);
  expect(await grid()).toContain("Pessoa de B");
  expect(and).toBeDefined();
});
