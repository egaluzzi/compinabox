// @vitest-environment node
import { and, eq, sql } from "drizzle-orm";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  acknowledgments,
  disclosures,
  employees,
  employeeSessions,
  trainingCompletions,
} from "@/lib/db/schema";
import { listDocuments, regenerateDocuments } from "@/lib/documents/store";
import { DOCUMENT_TYPES } from "@/lib/documents/types";
import { deactivateEmployee } from "@/lib/employee/admin";
import {
  getPortalEmployee,
  isInviteUsable,
  sha256,
  startSession,
} from "@/lib/employee/session";
import { getRoster } from "@/lib/employee/roster";
import { QUESTIONS } from "@/lib/training/content";
import { decryptText, aadFor } from "@/lib/whistleblower/crypto";
import { companies } from "@/lib/db/schema";
import { uid, useTestDb } from "./helpers/db";
import {
  formOf,
  postReq,
  seedInvited,
  seedPortalCompany,
  seedSession,
} from "./helpers/employee";

// Mocked: the cookie jar the page-side gate reads (next/headers) and next/navigation. Everything
// else — the gate, sessions, queries, crypto, rendering — is real, on a real Postgres.
const jar = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) =>
      n === "employee_session" && jar.token ? { value: jar.token } : undefined,
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

let db: ReturnType<typeof useTestDb>;
type Seeded = Awaited<ReturnType<typeof seedPortalCompany>>;
let A: Seeded;
let B: Seeded;
const E = "@/app/employee";

beforeAll(async () => {
  db = useTestDb();
  vi.stubEnv("APP_URL", "http://localhost:3000");
});
beforeEach(async () => {
  jar.token = undefined;
  A = await seedPortalCompany(db, `pa-${uid()}`);
  B = await seedPortalCompany(db, `pb-${uid()}`);
});

const page = async (mod: string, props: Record<string, unknown> = {}) => {
  const p = (await import(/* @vite-ignore */ `${E}/${mod}`)).default;
  return renderToStaticMarkup(
    createElement("div", null, (await p(props)) as ReactNode),
  );
};
const exchange = async (token: string) =>
  (await import(`${E}/api/session/route`)).POST(
    postReq("http://localhost/employee/api/session", null, formOf({ token })),
  ) as Promise<Response>;
const acknowledge = async (
  sessionToken: string | null,
  documentId: string,
  headers = {},
) =>
  (await import(`${E}/api/acknowledge/route`)).POST(
    postReq(
      "http://localhost/employee/api/acknowledge",
      sessionToken,
      formOf({ documentId }),
      headers,
    ),
  ) as Promise<Response>;
const quiz = async (
  sessionToken: string | null,
  answers: Record<string, number>,
) =>
  (await import(`${E}/api/training/route`)).POST(
    postReq("http://localhost/employee/api/training", sessionToken, {
      answers,
    }),
  ) as Promise<Response>;
const discl = async (
  sessionToken: string | null,
  fields: Record<string, string>,
) =>
  (await import(`${E}/api/disclosure/route`)).POST(
    postReq(
      "http://localhost/employee/api/disclosure",
      sessionToken,
      formOf(fields),
    ),
  ) as Promise<Response>;
const docsOf = async (companyId: string) => {
  const rows = await listDocuments(db, companyId);
  return DOCUMENT_TYPES.map((t) => rows.find((r) => r.type === t)!);
};
const answers = (wrong: number) =>
  Object.fromEntries(
    QUESTIONS.map((q, i) => [
      q.id,
      i < wrong ? (q.correct + 1) % 4 : q.correct,
    ]),
  );

describe("token -> session", () => {
  it("GET of the link page does not consume the token (mail-scanner prefetch)", async () => {
    const { token, employee } = await seedInvited(db, A.company.id);
    const before = await page("[token]/page", {
      params: Promise.resolve({ token }),
    });
    await page("[token]/page", { params: Promise.resolve({ token }) });
    const [row] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, employee.id));
    expect(row.inviteTokenHash).toBe(sha256(token));
    expect(before).toContain('action="/employee/api/session"');
    expect(before).toContain(`value="${token}"`);
    expect(before.split(token).length - 1).toBe(1); // the token appears exactly once: the hidden field
    expect(await isInviteUsable(db, token)).toBe(true);
    // ... and the POST still works afterwards
    expect((await exchange(token)).status).toBe(303);
  });

  it("POST consumes once: the second POST with the same token fails and creates no second session", async () => {
    const { token, employee } = await seedInvited(db, A.company.id);
    const first = await exchange(token);
    expect(first.status).toBe(303);
    expect(first.headers.get("location")).toBe(
      "http://localhost:3000/employee",
    );
    const second = await exchange(token);
    expect(second.headers.get("location")).toBe(
      "http://localhost:3000/employee/link-invalid",
    );
    const sessions = await db
      .select()
      .from(employeeSessions)
      .where(eq(employeeSessions.employeeId, employee.id));
    expect(sessions).toHaveLength(1);
    const [row] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, employee.id));
    expect(row.inviteTokenHash).toBeNull();
  });

  it("two concurrent POSTs with the same token: exactly one wins", async () => {
    const { token, employee } = await seedInvited(db, A.company.id);
    const results = await Promise.all(
      Array.from({ length: 8 }, () => startSession(db, token)),
    );
    const winners = results.filter((r) => r !== null);
    expect(winners).toHaveLength(1);
    const sessions = await db
      .select()
      .from(employeeSessions)
      .where(eq(employeeSessions.employeeId, employee.id));
    expect(sessions).toHaveLength(1);
    // and through the HTTP handler
    const t2 = await seedInvited(db, A.company.id);
    const http = await Promise.all([
      exchange(t2.token),
      exchange(t2.token),
      exchange(t2.token),
    ]);
    expect(
      http.filter((r) => r.headers.get("location")!.endsWith("/employee")),
    ).toHaveLength(1);
    expect(http.filter((r) => r.headers.get("set-cookie"))).toHaveLength(1);
  });

  it("expired, deactivated, re-issued-old and unknown tokens all get the identical friendly response", async () => {
    const expired = await seedInvited(db, A.company.id, "Exp", undefined, {
      expiresInMs: -1000,
    });
    const deact = await seedInvited(db, A.company.id, "Deact");
    await deactivateEmployee(db, A.company.id, deact.employee.id);
    // deactivation clears the hash; a leaked hash on a deactivated row must still fail: put it back
    await db
      .update(employees)
      .set({
        inviteTokenHash: sha256(deact.token),
        inviteExpiresAt: new Date(Date.now() + 3600_000),
      })
      .where(eq(employees.id, deact.employee.id));
    const old = await seedInvited(db, A.company.id, "Old");
    await db
      .update(employees)
      .set({ inviteTokenHash: sha256("the-new-token") })
      .where(eq(employees.id, old.employee.id)); // re-issued
    const used = await seedInvited(db, A.company.id, "Used");
    await exchange(used.token);
    const valid = await seedInvited(db, A.company.id, "Valid");

    const cases = {
      expired: expired.token,
      deactivated: deact.token,
      reissued: old.token,
      unknown: "no-such-token-xyz",
      used: used.token,
      empty: "",
    };
    const posts = await Promise.all(
      Object.values(cases).map((t) => exchange(t)),
    );
    const shape = posts.map((r) => [
      r.status,
      r.headers.get("location"),
      r.headers.get("set-cookie"),
    ]);
    for (const s of shape)
      expect(s).toEqual([
        303,
        "http://localhost:3000/employee/link-invalid",
        null,
      ]);
    const html = await Promise.all(
      Object.values(cases).map((t) =>
        page("[token]/page", { params: Promise.resolve({ token: t }) }),
      ),
    );
    for (const h of html) expect(h).toBe(html[0]);
    const friendly = await page("link-invalid/page");
    expect(html[0]).toContain("Este link não é mais válido");
    expect(friendly).toContain("Este link não é mais válido");
    expect(friendly).not.toMatch(/Error:|stack trace/); // no technical detail
    const ok = await page("[token]/page", {
      params: Promise.resolve({ token: valid.token }),
    });
    expect(ok).not.toBe(html[0]);
  });

  it("stores only hashes: the invite hash and the session hash are sha256, the raw values are nowhere in the database", async () => {
    const { token, employee } = await seedInvited(db, A.company.id);
    const res = await exchange(token);
    const cookie = res.headers.get("set-cookie")!;
    const sessionToken = /employee_session=([^;]+)/.exec(cookie)![1];
    const dump = JSON.stringify([
      await db.select().from(employees).where(eq(employees.id, employee.id)),
      await db
        .select()
        .from(employeeSessions)
        .where(eq(employeeSessions.employeeId, employee.id)),
    ]);
    expect(dump).not.toContain(token);
    expect(dump).not.toContain(sessionToken);
    const [s] = await db
      .select()
      .from(employeeSessions)
      .where(eq(employeeSessions.employeeId, employee.id));
    expect(s.tokenHash).toBe(sha256(sessionToken));
    expect(sessionToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("session cookie: httpOnly, SameSite=Lax, Path=/employee, 8 hours, Secure only on https", async () => {
    const a = await exchange((await seedInvited(db, A.company.id)).token);
    const c = a.headers.get("set-cookie")!;
    expect(c).toMatch(/^employee_session=/);
    expect(c).toMatch(/HttpOnly/i);
    expect(c).toMatch(/SameSite=lax/i);
    expect(c).toMatch(/Path=\/employee(;|$)/);
    expect(c).toMatch(/Max-Age=28800/);
    expect(c).not.toMatch(/Secure/i);
    vi.stubEnv("APP_URL", "https://app.example.test");
    const b = await exchange((await seedInvited(db, A.company.id)).token);
    expect(b.headers.get("set-cookie")).toMatch(/Secure/i);
    expect(b.headers.get("location")).toBe("https://app.example.test/employee");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    // handlers/pages carry the privacy headers
    expect(a.headers.get("cache-control")).toBe("private, no-store");
    expect(a.headers.get("referrer-policy")).toBe("no-referrer");
    expect(a.headers.get("x-frame-options")).toBe("DENY");
  });

  it("session expiry: an expired session is refused by the lookup, the gate and the handlers", async () => {
    const s = await seedSession(db, A.company.id);
    expect(await getPortalEmployee(db, s.sessionToken)).not.toBeNull();
    await db
      .update(employeeSessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(employeeSessions.employeeId, s.employee.id));
    expect(await getPortalEmployee(db, s.sessionToken)).toBeNull();
    expect((await quiz(s.sessionToken, answers(0))).status).toBe(401);
    jar.token = s.sessionToken;
    await expect(page("page")).rejects.toThrow(
      "REDIRECT /employee/link-invalid",
    );
  });

  it("deactivation kills the employee's sessions and clears the unused invite", async () => {
    const s = await seedSession(db, A.company.id);
    const other = await seedSession(db, A.company.id, "Outra");
    await deactivateEmployee(db, A.company.id, s.employee.id);
    expect(
      await db
        .select()
        .from(employeeSessions)
        .where(eq(employeeSessions.employeeId, s.employee.id)),
    ).toHaveLength(0);
    expect(await getPortalEmployee(db, s.sessionToken)).toBeNull();
    expect(
      (await acknowledge(s.sessionToken, (await docsOf(A.company.id))[0].id))
        .status,
    ).toBe(401);
    expect(await getPortalEmployee(db, other.sessionToken)).not.toBeNull();
    // even a surviving session row of a deactivated employee is refused
    const t = await seedSession(db, A.company.id, "T");
    await db
      .update(employees)
      .set({ deactivatedAt: new Date() })
      .where(eq(employees.id, t.employee.id));
    expect(await getPortalEmployee(db, t.sessionToken)).toBeNull();
  });

  it("sign-out deletes the session row and clears the cookie; a copied cookie dies too", async () => {
    const s = await seedSession(db, A.company.id);
    const res = await (
      await import(`${E}/api/sign-out/route`)
    ).POST(
      postReq("http://localhost/employee/api/sign-out", s.sessionToken, null),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("set-cookie")).toMatch(
      /employee_session=;.*Max-Age=0|Max-Age=0.*employee_session=/i,
    );
    expect(res.headers.get("set-cookie")).toMatch(/Path=\/employee/);
    expect(await getPortalEmployee(db, s.sessionToken)).toBeNull();
    expect((await quiz(s.sessionToken, answers(0))).status).toBe(401);
  });

  it("no session -> 401 on every handler; the pages redirect to the friendly page", async () => {
    const doc = (await docsOf(A.company.id))[0];
    expect((await acknowledge(null, doc.id)).status).toBe(401);
    expect((await quiz(null, answers(0))).status).toBe(401);
    expect((await discl(null, { choice: "none" })).status).toBe(401);
    for (const mod of ["page", "disclosure/page", "training/quiz/page"])
      await expect(
        page(mod, { searchParams: Promise.resolve({}) }),
      ).rejects.toThrow("REDIRECT /employee/link-invalid");
    await expect(
      page("documents/[id]/page", { params: Promise.resolve({ id: doc.id }) }),
    ).rejects.toThrow("REDIRECT");
    await expect(
      page("training/[n]/page", { params: Promise.resolve({ n: "1" }) }),
    ).rejects.toThrow("REDIRECT");
  });
});

describe("cross-tenant", () => {
  it("an employee session of company A can neither read nor acknowledge a document of company B (404, no row)", async () => {
    const a = await seedSession(db, A.company.id);
    const bDoc = (await docsOf(B.company.id))[0];
    jar.token = a.sessionToken;
    await expect(
      page("documents/[id]/page", { params: Promise.resolve({ id: bDoc.id }) }),
    ).rejects.toThrow("NOT_FOUND");
    const res = await acknowledge(a.sessionToken, bDoc.id);
    expect(res.status).toBe(404);
    expect(
      await db
        .select()
        .from(acknowledgments)
        .where(eq(acknowledgments.documentId, bDoc.id)),
    ).toHaveLength(0);
    // home shows A's company only
    const home = await page("page");
    expect(home).toContain(A.company.name);
    expect(home).not.toContain(B.company.name);
    for (const d of await docsOf(B.company.id))
      expect(home).not.toContain(d.id);
  });

  it("employee, acknowledgment, training and disclosure rows never cross; ids in the body are not trusted", async () => {
    const a = await seedSession(db, A.company.id, "Alice");
    const b = await seedSession(db, B.company.id, "Beto");
    const aDoc = (await docsOf(A.company.id))[0];
    await acknowledge(a.sessionToken, aDoc.id);
    await quiz(a.sessionToken, answers(0));
    await discl(a.sessionToken, {
      choice: "some",
      details: "segredo da Alice",
    });
    const rosterB = await getRoster(db, B.company.id, "pt-BR");
    expect(rosterB.rows.map((r) => r.name)).toEqual(["Beto"]);
    const [bRow] = rosterB.rows;
    expect(bRow.docs[DOCUMENT_TYPES[0]].state).toBe("pending");
    expect(bRow.training).toEqual({ state: "pending" });
    expect(bRow.disclosure.state).toBe("pending");
    // a forged employeeId/companyId in the body is simply ignored: the session decides
    const f = formOf({
      documentId: (await docsOf(B.company.id))[0].id,
      employeeId: a.employee.id,
      companyId: A.company.id,
    });
    const res = await (
      await import(`${E}/api/acknowledge/route`)
    ).POST(postReq("http://localhost/x", b.sessionToken, f));
    expect(res.status).toBe(303);
    const rows = await db
      .select()
      .from(acknowledgments)
      .where(
        eq(acknowledgments.documentId, (await docsOf(B.company.id))[0].id),
      );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      employeeId: b.employee.id,
      companyId: B.company.id,
    });
  });
});

describe("acknowledgments", () => {
  it("stores accepted_at and the IP from cf-connecting-ip", async () => {
    const s = await seedSession(db, A.company.id);
    const [doc] = await docsOf(A.company.id);
    const res = await acknowledge(s.sessionToken, doc.id, {
      "cf-connecting-ip": "203.0.113.7",
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost:3000/employee");
    const [row] = await db
      .select()
      .from(acknowledgments)
      .where(eq(acknowledgments.employeeId, s.employee.id));
    expect(row).toMatchObject({
      ipAddress: "203.0.113.7",
      documentId: doc.id,
      companyId: A.company.id,
    });
    expect(Math.abs(row.acceptedAt.getTime() - Date.now())).toBeLessThan(
      60_000,
    );
  });

  it("accepts an IPv6 address; stores NULL when the header is absent or garbage; ignores x-forwarded-for", async () => {
    const docs = await docsOf(A.company.id);
    const cases: [Record<string, string>, string | null][] = [
      [{ "cf-connecting-ip": "2001:db8::1" }, "2001:db8::1"],
      [{}, null],
      [{ "cf-connecting-ip": "not-an-ip" }, null],
      [{ "cf-connecting-ip": "1.2.3.4, 5.6.7.8" }, null],
      [{ "cf-connecting-ip": "999.1.1.1" }, null],
      [{ "x-forwarded-for": "198.51.100.9" }, null],
      [
        {
          "x-forwarded-for": "198.51.100.9",
          "cf-connecting-ip": "203.0.113.9",
        },
        "203.0.113.9",
      ],
    ];
    for (const [i, [headers, expected]] of cases.entries()) {
      const s = await seedSession(db, A.company.id, `ip${i}`);
      await acknowledge(s.sessionToken, docs[0].id, headers);
      const [row] = await db
        .select()
        .from(acknowledgments)
        .where(eq(acknowledgments.employeeId, s.employee.id));
      expect(row.ipAddress, JSON.stringify(headers)).toBe(expected);
    }
  });

  it("is idempotent: a double submit leaves one row with the first IP and timestamp", async () => {
    const s = await seedSession(db, A.company.id);
    const [doc] = await docsOf(A.company.id);
    const [r1, r2] = await Promise.all([
      acknowledge(s.sessionToken, doc.id, {
        "cf-connecting-ip": "203.0.113.1",
      }),
      acknowledge(s.sessionToken, doc.id, {
        "cf-connecting-ip": "203.0.113.2",
      }),
    ]);
    expect([r1.status, r2.status]).toEqual([303, 303]);
    const rows = await db
      .select()
      .from(acknowledgments)
      .where(eq(acknowledgments.employeeId, s.employee.id));
    expect(rows).toHaveLength(1);
  });

  it("a regenerated document makes the old acceptance 'outdated'; the old version cannot be accepted", async () => {
    const s = await seedSession(db, A.company.id);
    const [oldDoc] = await docsOf(A.company.id);
    await acknowledge(s.sessionToken, oldDoc.id);
    let roster = await getRoster(db, A.company.id, "pt-BR");
    expect(
      roster.rows[0].docs[oldDoc.type as (typeof DOCUMENT_TYPES)[number]].state,
    ).toBe("done");
    // regeneration with changed inputs -> a new version
    await db
      .update(companies)
      .set({ name: "Nome Novo Ltda" })
      .where(eq(companies.id, A.company.id));
    await regenerateDocuments(db, A.company.id);
    const [newDoc] = await docsOf(A.company.id);
    expect(newDoc.id).not.toBe(oldDoc.id);
    roster = await getRoster(db, A.company.id, "pt-BR");
    const step =
      roster.rows[0].docs[oldDoc.type as (typeof DOCUMENT_TYPES)[number]];
    expect(step.state).toBe("outdated");
    // the old version: friendly page, and the handler records nothing
    jar.token = s.sessionToken;
    const html = await page("documents/[id]/page", {
      params: Promise.resolve({ id: oldDoc.id }),
    });
    expect(html).toContain("Este documento foi atualizado");
    expect(html).not.toContain("/employee/api/acknowledge");
    const res = await acknowledge(s.sessionToken, oldDoc.id);
    expect(res.headers.get("location")).toBe(
      `http://localhost:3000/employee/documents/${oldDoc.id}`,
    );
    expect(
      await db
        .select()
        .from(acknowledgments)
        .where(eq(acknowledgments.employeeId, s.employee.id)),
    ).toHaveLength(1);
    // the home page shows the outdated state and links to the NEW version
    const home = await page("page");
    expect(home).toContain("Atualizado");
    expect(home).toContain(`/employee/documents/${newDoc.id}`);
    // accepting the new version completes the step
    await acknowledge(s.sessionToken, newDoc.id);
    roster = await getRoster(db, A.company.id, "pt-BR");
    expect(
      roster.rows[0].docs[newDoc.type as (typeof DOCUMENT_TYPES)[number]].state,
    ).toBe("done");
  });

  it("the document page renders the full document, the IP notice and the accept button", async () => {
    const s = await seedSession(db, A.company.id);
    const [doc] = await docsOf(A.company.id);
    jar.token = s.sessionToken;
    const html = await page("documents/[id]/page", {
      params: Promise.resolve({ id: doc.id }),
    });
    expect(html).toContain("Código de Conduta");
    expect(html).toContain(A.company.name);
    expect(html).toContain("Li e aceito");
    expect(html).toContain("endereço IP");
    expect(html).toContain('action="/employee/api/acknowledge"');
    await expect(
      page("documents/[id]/page", {
        params: Promise.resolve({ id: "not-a-uuid" }),
      }),
    ).rejects.toThrow("NOT_FOUND");
  });
});

describe("append-only (database triggers)", () => {
  it("UPDATE, DELETE and TRUNCATE are rejected for acknowledgments, training completions and disclosures", async () => {
    const s = await seedSession(db, A.company.id);
    const [doc] = await docsOf(A.company.id);
    await acknowledge(s.sessionToken, doc.id);
    await quiz(s.sessionToken, answers(0));
    await discl(s.sessionToken, { choice: "none" });
    const fails = async (p: PromiseLike<unknown>) => {
      try {
        await p;
      } catch (e) {
        const err = e as { cause?: { message?: string }; message: string };
        expect(err.cause?.message ?? err.message).toMatch(/append-only/);
        return;
      }
      expect.unreachable("expected the query to fail");
    };
    await fails(
      db
        .update(acknowledgments)
        .set({ ipAddress: "1.1.1.1" })
        .where(eq(acknowledgments.employeeId, s.employee.id)),
    );
    await fails(
      db
        .delete(acknowledgments)
        .where(eq(acknowledgments.employeeId, s.employee.id)),
    );
    await fails(db.execute(sql`truncate table acknowledgments`));
    await fails(
      db
        .update(trainingCompletions)
        .set({ score: 1 })
        .where(eq(trainingCompletions.employeeId, s.employee.id)),
    );
    await fails(
      db
        .delete(trainingCompletions)
        .where(eq(trainingCompletions.employeeId, s.employee.id)),
    );
    await fails(db.execute(sql`truncate table training_completions`));
    await fails(
      db
        .update(disclosures)
        .set({ content: "x" })
        .where(eq(disclosures.employeeId, s.employee.id)),
    );
    await fails(
      db.delete(disclosures).where(eq(disclosures.employeeId, s.employee.id)),
    );
    await fails(db.execute(sql`truncate table disclosures`));
    expect(
      await db
        .select()
        .from(acknowledgments)
        .where(eq(acknowledgments.employeeId, s.employee.id)),
    ).toHaveLength(1);
  });
});

describe("training quiz (graded server-side)", () => {
  it("9 of 12 fails and stores nothing; retake works immediately; 10 of 12 passes and stores the score", async () => {
    const s = await seedSession(db, A.company.id);
    const fail = await quiz(s.sessionToken, answers(3));
    const failBody = await fail.json();
    expect(failBody).toMatchObject({
      passed: false,
      correct: 9,
      total: 12,
      score: 75,
    });
    expect(
      await db
        .select()
        .from(trainingCompletions)
        .where(eq(trainingCompletions.employeeId, s.employee.id)),
    ).toHaveLength(0);
    const pass = await (await quiz(s.sessionToken, answers(2))).json();
    expect(pass).toMatchObject({ passed: true, correct: 10, score: 83 });
    const rows = await db
      .select()
      .from(trainingCompletions)
      .where(eq(trainingCompletions.employeeId, s.employee.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      moduleId: "anticorruption-pt-BR-v1",
      score: 83,
      companyId: A.company.id,
    });
  });

  it("a second pass is idempotent: still one row, the first score stays", async () => {
    const s = await seedSession(db, A.company.id);
    await quiz(s.sessionToken, answers(2));
    await Promise.all([
      quiz(s.sessionToken, answers(0)),
      quiz(s.sessionToken, answers(0)),
    ]);
    const rows = await db
      .select()
      .from(trainingCompletions)
      .where(eq(trainingCompletions.employeeId, s.employee.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].score).toBe(83);
  });

  it("the served lessons and quiz page never contain the correct answers or the explanations", async () => {
    const s = await seedSession(db, A.company.id);
    jar.token = s.sessionToken;
    const html = await page("training/quiz/page");
    for (const q of QUESTIONS) {
      expect(html).toContain(
        q.prompt.replace(/&/g, "&amp;").replace(/"/g, "&quot;").slice(0, 25),
      );
      expect(html).not.toContain(q.explanation.slice(0, 40));
    }
    expect(html).not.toMatch(/"correct"|correctIndex|data-correct/);
    const lesson = await page("training/[n]/page", {
      params: Promise.resolve({ n: "1" }),
    });
    expect(lesson).toContain("Lição 1 de 6");
    for (const q of QUESTIONS)
      expect(lesson).not.toContain(q.explanation.slice(0, 40));
    await expect(
      page("training/[n]/page", { params: Promise.resolve({ n: "7" }) }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      page("training/[n]/page", { params: Promise.resolve({ n: "abc" }) }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("malformed bodies are rejected without storing anything", async () => {
    const s = await seedSession(db, A.company.id);
    const h = (await import(`${E}/api/training/route`)).POST;
    for (const body of [null, "x", [], { answers: null }, { answers: "x" }]) {
      const res = await h(
        new Request("http://localhost/x", {
          method: "POST",
          headers: {
            cookie: `employee_session=${s.sessionToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        }),
      );
      expect([400, 200]).toContain(res.status);
    }
    expect(
      await db
        .select()
        .from(trainingCompletions)
        .where(eq(trainingCompletions.employeeId, s.employee.id)),
    ).toHaveLength(0);
    const garbage = await h(
      new Request("http://localhost/x", {
        method: "POST",
        headers: { cookie: `employee_session=${s.sessionToken}` },
        body: "not json",
      }),
    );
    expect(garbage.status).toBe(400);
  });

  it("a company whose locale has no training (es-AR): the step is 'unavailable', excluded from completion, quiz refuses", async () => {
    const ar = await seedPortalCompany(db, `ar-${uid()}`, "ar");
    const s = await seedSession(db, ar.company.id, "Pessoa AR");
    const res = await quiz(s.sessionToken, answers(0));
    expect(res.status).toBe(404);
    expect(
      await db
        .select()
        .from(trainingCompletions)
        .where(eq(trainingCompletions.employeeId, s.employee.id)),
    ).toHaveLength(0);
    jar.token = s.sessionToken;
    const home = await page("page");
    expect(home).toContain("La capacitación aún no está disponible");
    expect(home).not.toContain("/employee/training/1");
    const quizPage = await page("training/quiz/page");
    expect(quizPage).toContain("La capacitación aún no está disponible");
    const roster = await getRoster(db, ar.company.id, "es-AR");
    expect(roster.trainingAvailable).toBe(false);
    expect(roster.rows[0].training).toBe("unavailable");
  });
});

describe("annual disclosure", () => {
  it("encrypts the content at rest, allows one per UTC year, and the second submit changes nothing", async () => {
    const s = await seedSession(db, A.company.id);
    const secret = "Meu cunhado é sócio de um fornecedor — segredo 4c9e";
    const r1 = await discl(s.sessionToken, { choice: "some", details: secret });
    expect(r1.headers.get("location")).toBe(
      "http://localhost:3000/employee/disclosure?result=submitted",
    );
    const [row] = await db
      .select()
      .from(disclosures)
      .where(eq(disclosures.employeeId, s.employee.id));
    expect(row.content).toMatch(/^v[A-Za-z0-9_-]+:/);
    expect(row.content).not.toContain("segredo");
    expect(row.content).not.toContain("cunhado");
    expect(JSON.stringify(row)).not.toContain("hasConflict");
    expect(row).toMatchObject({
      type: "conflict_of_interest_annual",
      periodYear: new Date().getUTCFullYear(),
      companyId: A.company.id,
    });
    expect(
      JSON.parse(
        decryptText(
          row.content,
          aadFor("disclosures", A.company.id, "content"),
        ),
      ),
    ).toEqual({ hasConflict: true, details: secret });
    // the same ciphertext does not decrypt under another company's AAD
    expect(() =>
      decryptText(row.content, aadFor("disclosures", B.company.id, "content")),
    ).toThrow();
    const r2 = await discl(s.sessionToken, { choice: "none" });
    expect(r2.headers.get("location")).toBe(
      "http://localhost:3000/employee/disclosure?result=already",
    );
    const rows = await db
      .select()
      .from(disclosures)
      .where(eq(disclosures.employeeId, s.employee.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].content).toBe(row.content);
    jar.token = s.sessionToken;
    const html = await page("disclosure/page", {
      searchParams: Promise.resolve({ result: "already" }),
    });
    expect(html).toContain("Você já enviou sua declaração");
    expect(html).not.toContain('action="/employee/api/disclosure"'); // no form once submitted
  });

  it("validates: 'some' needs details (<= 5000 chars); 'none' needs none; junk is rejected", async () => {
    const s = await seedSession(db, A.company.id);
    const loc = async (f: Record<string, string>) =>
      (await discl(s.sessionToken, f)).headers.get("location");
    expect(await loc({ choice: "some", details: "   " })).toMatch(
      /result=invalid/,
    );
    expect(await loc({ choice: "some" })).toMatch(/result=invalid/);
    expect(await loc({ choice: "some", details: "x".repeat(5001) })).toMatch(
      /result=invalid/,
    );
    expect(await loc({ choice: "maybe" })).toMatch(/result=invalid/);
    expect(await loc({})).toMatch(/result=invalid/);
    expect(
      await db
        .select()
        .from(disclosures)
        .where(eq(disclosures.employeeId, s.employee.id)),
    ).toHaveLength(0);
    expect(await loc({ choice: "some", details: "x".repeat(5000) })).toMatch(
      /result=submitted/,
    );
  });

  it("the period is the UTC calendar year: 31 Dec 23:59Z and 1 Jan 00:00Z are different years", async () => {
    const { submitDisclosure } = await import("@/lib/employee/disclosure");
    const s = await seedSession(db, A.company.id);
    const me = { companyId: A.company.id, employeeId: s.employee.id };
    const input = { hasConflict: false, details: "" };
    expect(
      await submitDisclosure(db, me, input, new Date("2026-12-31T23:59:59Z")),
    ).toBe("submitted");
    expect(
      await submitDisclosure(db, me, input, new Date("2026-12-31T00:00:00Z")),
    ).toBe("already");
    expect(
      await submitDisclosure(db, me, input, new Date("2027-01-01T00:00:00Z")),
    ).toBe("submitted");
    const years = (
      await db
        .select()
        .from(disclosures)
        .where(eq(disclosures.employeeId, s.employee.id))
    )
      .map((r) => r.periodYear)
      .sort();
    expect(years).toEqual([2026, 2027]);
  });
});

describe("migration 0005 constraints", () => {
  it("employees are unique per company by email, but the same email may exist in two companies", async () => {
    const email = `dup-${uid()}@example.test`;
    await db
      .insert(employees)
      .values({ companyId: A.company.id, name: "X", email });
    await expect(
      db
        .insert(employees)
        .values({ companyId: A.company.id, name: "Y", email }),
    ).rejects.toThrow();
    await db
      .insert(employees)
      .values({ companyId: B.company.id, name: "Z", email });
    const both = await db
      .select()
      .from(employees)
      .where(and(eq(employees.email, email)));
    expect(both).toHaveLength(2);
  });
});
