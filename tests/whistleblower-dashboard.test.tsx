// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  whistleblowerEvidence,
  whistleblowerNotes,
  whistleblowerReports,
} from "@/lib/db/schema";
import { countOpenReports } from "@/lib/db/tenant";
import { aadFor, decryptBytes } from "@/lib/whistleblower/crypto";
import { evidenceDir } from "@/lib/whistleblower/evidence";
import { storeReport } from "@/lib/whistleblower/intake";
import { addNote, changeStatus } from "@/lib/whistleblower/queries";
import { stripPng } from "@/lib/whistleblower/image-strip";
import { uid, useTestDb } from "./helpers/db";
import { pngWithMarker, seedOnboarded } from "./helpers/whistleblower";

// Only the session -> {userId, companyId} lookup and next/navigation are mocked; the gate,
// queries, crypto, files and rendering are real, on a real Postgres.
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
  usePathname: () => "/dashboard/whistleblower",
}));

let db: ReturnType<typeof useTestDb>;
type Seeded = Awaited<ReturnType<typeof seedOnboarded>>;
let A: Seeded;
let B: Seeded;
let aReport: string;
let aEvidence: string;
let bReport: string;
const SECRET_A = "Segredo da empresa A 91c2";
const SECRET_B = "Segredo da empresa B 5d7e";
const as = (s: Seeded | null) => {
  session.current = s && { userId: s.user.id, companyId: s.company.id };
};
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const ctxOf = (params: Record<string, string>) => ({
  params: Promise.resolve(params),
});
const post = (url: string, fields: Record<string, string>) =>
  new Request(url, { method: "POST", body: form(fields) });

/** Stored through the same core the intake uses; evidence is stripped first, as parseSubmission does. */
async function seedReport(
  s: Seeded,
  description: string,
  withEvidence = false,
) {
  const code = await storeReport(db, s.company.id, {
    category: "corruption_bribery",
    description,
    contact: withEvidence ? "contato@example.test" : null,
    images: withEvidence
      ? [
          {
            bytes: stripPng(pngWithMarker("GPS-LATITUDE-MARKER"))!,
            contentType: "image/png",
          },
        ]
      : [],
  });
  const [r] = await db
    .select()
    .from(whistleblowerReports)
    .where(eq(whistleblowerReports.trackingCode, code));
  return r.id;
}

beforeAll(async () => {
  db = useTestDb();
  vi.stubEnv("APP_URL", "https://app.example.test");
  A = await seedOnboarded(db, `da-${uid()}`);
  B = await seedOnboarded(db, `db-${uid()}`);
  aReport = await seedReport(A, SECRET_A, true);
  const [ev] = await db
    .select()
    .from(whistleblowerEvidence)
    .where(eq(whistleblowerEvidence.reportId, aReport));
  aEvidence = ev.id;
  bReport = await seedReport(B, SECRET_B);
});
beforeEach(() => as(A));

const D = "@/app/(app)/dashboard/whistleblower";
async function renderPage(mod: string, props: Record<string, unknown> = {}) {
  const page = (await import(/* @vite-ignore */ mod)).default;
  return renderToStaticMarkup(
    createElement("div", null, (await page(props)) as ReactNode),
  );
}
const detail = (id: string, error?: string) =>
  renderPage(`${D}/[id]/page`, {
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve({ error }),
  });
const status = async (id: string, to: string) =>
  (await import(`${D}/[id]/status/route`)).POST(
    post(`http://localhost/s`, { status: to }),
    ctxOf({ id }),
  );
const note = async (id: string, body: string) =>
  (await import(`${D}/[id]/note/route`)).POST(
    post(`http://localhost/n`, { body }),
    ctxOf({ id }),
  );
const download = async (id: string, evidenceId: string) =>
  (await import(`${D}/[id]/evidence/[evidenceId]/route`)).GET(
    new Request("http://localhost/e"),
    ctxOf({ id, evidenceId }),
  );

describe("list and detail", () => {
  it("the list shows the channel URL, date, category and status — and no description text", async () => {
    const html = await renderPage(`${D}/page`);
    expect(html).toContain(`https://app.example.test/report/${A.company.slug}`);
    expect(html).toContain(`/dashboard/whistleblower/${aReport}`);
    expect(html).toContain("Corrupção / suborno");
    expect(html).toContain("Recebida");
    expect(html).not.toContain(SECRET_A);
  });

  it("the detail decrypts the description and contact and lists the evidence", async () => {
    const html = await detail(aReport);
    expect(html).toContain(SECRET_A);
    expect(html).toContain("contato@example.test");
    expect(html).toContain(
      `/dashboard/whistleblower/${aReport}/evidence/${aEvidence}`,
    );
  });

  it("an anonymous report says so", async () => {
    const id = await seedReport(A, "anon one");
    const html = await detail(id);
    expect(html).toContain("Anônima");
    expect(html).toContain("anon one");
  });

  it("a report that cannot be decrypted shows a clear state and never breaks the list", async () => {
    const id = await seedReport(A, "will be unreadable");
    const original = process.env.REPORT_ENCRYPTION_KEYS;
    process.env.REPORT_ENCRYPTION_KEYS = `other:${Buffer.alloc(32, 7).toString("base64")}`;
    try {
      const html = await detail(id);
      expect(html).toContain("Não foi possível descriptografar");
      expect(html).not.toContain("will be unreadable");
      expect(await renderPage(`${D}/page`)).toContain(
        `/dashboard/whistleblower/${id}`,
      );
    } finally {
      process.env.REPORT_ENCRYPTION_KEYS = original;
    }
  });

  it("malformed ids are 404", async () => {
    await expect(detail("not-a-uuid")).rejects.toThrow("NOT_FOUND");
    expect((await status("not-a-uuid", "closed")).status).toBe(404);
    expect((await note("not-a-uuid", "x")).status).toBe(404);
  });
});

describe("evidence download", () => {
  it("decrypts to the stored image, as an attachment with nosniff and private no-store", async () => {
    const res = await download(aReport, aEvidence);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="evidence-[a-f0-9]{8}\.png"$/,
    );
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(
      bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
    ).toBe(true);
    expect(bytes.toString("latin1")).not.toContain("MARKER");
    // and it really is what is encrypted on disk
    const [ev] = await db
      .select()
      .from(whistleblowerEvidence)
      .where(eq(whistleblowerEvidence.id, aEvidence));
    const disk = readFileSync(path.join(evidenceDir(), ev.fileName), "utf8");
    expect(
      decryptBytes(
        disk,
        aadFor("whistleblower_evidence", A.company.id, `file:${aEvidence}`),
      ).equals(bytes),
    ).toBe(true);
  });

  it("no session -> 401; a wrong report id for a real evidence id -> 404", async () => {
    as(null);
    expect((await download(aReport, aEvidence)).status).toBe(401);
    as(A);
    expect((await download(bReport, aEvidence)).status).toBe(404);
    expect(
      (await download(aReport, "00000000-0000-4000-8000-000000000000")).status,
    ).toBe(404);
  });
});

describe("cross-tenant isolation", () => {
  it("company B gets 404 for A's report detail, evidence, status change and note — and nothing changes", async () => {
    as(B);
    await expect(detail(aReport)).rejects.toThrow("NOT_FOUND");
    expect((await download(aReport, aEvidence)).status).toBe(404);
    expect((await download(bReport, aEvidence)).status).toBe(404); // A's evidence id under B's own report
    const notesBefore = await db
      .select()
      .from(whistleblowerNotes)
      .where(eq(whistleblowerNotes.reportId, aReport));
    expect((await status(aReport, "closed")).status).toBe(404);
    expect((await note(aReport, "intruder note")).status).toBe(404);
    const [r] = await db
      .select()
      .from(whistleblowerReports)
      .where(eq(whistleblowerReports.id, aReport));
    expect(r.status).toBe("new");
    expect(r.resolvedAt).toBeNull();
    const notesAfter = await db
      .select()
      .from(whistleblowerNotes)
      .where(eq(whistleblowerNotes.reportId, aReport));
    expect(notesAfter).toHaveLength(notesBefore.length);
    // a forged company id in the form is ignored: the session's company decides
    const forged = await (
      await import(`${D}/[id]/note/route`)
    ).POST(
      post("http://localhost/n", {
        body: "forged",
        companyId: A.company.id,
        company_id: A.company.id,
      }),
      ctxOf({ id: aReport }),
    );
    expect(forged.status).toBe(404);
  });

  it("each company's list shows only its own reports", async () => {
    as(B);
    const html = await renderPage(`${D}/page`);
    expect(html).toContain(`/dashboard/whistleblower/${bReport}`);
    expect(html).not.toContain(`/dashboard/whistleblower/${aReport}`);
    expect(html).not.toContain(A.company.slug);
    expect(html).toContain(`/report/${B.company.slug}`);
    expect(await detail(bReport)).toContain(SECRET_B);
    as(A);
    const htmlA = await renderPage(`${D}/page`);
    expect(htmlA).not.toContain(`/dashboard/whistleblower/${bReport}`);
  });

  it("without a session the routes answer 401 and the pages redirect to /login", async () => {
    as(null);
    expect((await status(aReport, "closed")).status).toBe(401);
    expect((await note(aReport, "x")).status).toBe(401);
    await expect(detail(aReport)).rejects.toThrow("REDIRECT /login");
  });
});

describe("statuses and the case log", () => {
  const rowOf = async (id: string) =>
    (
      await db
        .select()
        .from(whistleblowerReports)
        .where(eq(whistleblowerReports.id, id))
    )[0];
  const logOf = (id: string) =>
    db
      .select()
      .from(whistleblowerNotes)
      .where(eq(whistleblowerNotes.reportId, id))
      .orderBy(whistleblowerNotes.createdAt);

  it("every transition among new / under_review / closed works; resolved_at is set on close and cleared on reopen", async () => {
    const id = await seedReport(A, "lifecycle");
    expect((await rowOf(id)).resolvedAt).toBeNull();
    const t0 = (await rowOf(id)).statusChangedAt;

    expect((await status(id, "under_review")).status).toBe(303);
    let r = await rowOf(id);
    expect([r.status, r.resolvedAt]).toEqual(["under_review", null]);
    expect(r.statusChangedAt.getTime()).toBeGreaterThanOrEqual(t0.getTime());

    await status(id, "closed");
    r = await rowOf(id);
    expect(r.status).toBe("closed");
    expect(r.resolvedAt).toBeInstanceOf(Date);
    expect(r.resolvedAt!.getTime()).toBe(r.statusChangedAt.getTime());

    await status(id, "new"); // reopen
    r = await rowOf(id);
    expect([r.status, r.resolvedAt]).toEqual(["new", null]);

    await status(id, "closed"); // closed straight from new
    expect((await rowOf(id)).resolvedAt).toBeInstanceOf(Date);
    await status(id, "under_review"); // and back
    expect((await rowOf(id)).resolvedAt).toBeNull();

    const log = await logOf(id);
    expect(log.map((l) => [l.kind, l.fromStatus, l.toStatus, l.body])).toEqual([
      ["status_change", "new", "under_review", null],
      ["status_change", "under_review", "closed", null],
      ["status_change", "closed", "new", null],
      ["status_change", "new", "closed", null],
      ["status_change", "closed", "under_review", null],
    ]);
    expect(
      log.every(
        (l) => l.authorUserId === A.user.id && l.companyId === A.company.id,
      ),
    ).toBe(true);
  });

  it("a no-op change writes no log row; an invalid status changes nothing", async () => {
    const id = await seedReport(A, "noop");
    await status(id, "under_review");
    expect(
      await changeStatus(
        db,
        { companyId: A.company.id, userId: A.user.id },
        id,
        "under_review",
      ),
    ).toBe("unchanged");
    expect(await logOf(id)).toHaveLength(1);
    const bad = await status(id, "received");
    expect(bad.status).toBe(303);
    expect(bad.headers.get("location")).toContain(
      `/dashboard/whistleblower/${id}?error=1`,
    );
    expect((await rowOf(id)).status).toBe("under_review");
    expect(await logOf(id)).toHaveLength(1);
  });

  it("notes are stored encrypted, shown decrypted, and interleave with status changes oldest first", async () => {
    const id = await seedReport(A, "notes");
    expect((await note(id, "Primeira anotação confidencial")).status).toBe(303);
    await status(id, "under_review");
    await note(id, "Segunda anotação");
    const log = await logOf(id);
    expect(log.map((l) => l.kind)).toEqual(["note", "status_change", "note"]);
    expect(log[0].body).toMatch(/^vt1:/);
    expect(log[0].body).not.toContain("confidencial");
    const html = await detail(id);
    const i1 = html.indexOf("Primeira anotação confidencial");
    const i2 = html.indexOf("Recebida → Em análise");
    const i3 = html.indexOf("Segunda anotação");
    expect(i1).toBeGreaterThan(-1);
    expect(i1).toBeLessThan(i2);
    expect(i2).toBeLessThan(i3);
    expect(html).toContain(A.user.email);
  });

  it("empty and oversize notes are refused back to the form", async () => {
    const id = await seedReport(A, "badnotes");
    for (const body of ["", "   ", "x".repeat(10_001)]) {
      const res = await note(id, body);
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toContain("?error=1");
    }
    expect(await logOf(id)).toHaveLength(0);
    expect(
      await addNote(
        db,
        { companyId: A.company.id, userId: A.user.id },
        id,
        "x".repeat(10_000),
      ),
    ).toBe(true);
  });

  it("the log is append-only in the database: UPDATE, DELETE and TRUNCATE are rejected", async () => {
    const id = await seedReport(A, "append only");
    await note(id, "keep me");
    const [n] = await logOf(id);
    const rejected = async (p: Promise<unknown>) => {
      const err = await p.then(
        () => null,
        (e: unknown) => e as Error & { cause?: Error },
      );
      expect(err).not.toBeNull();
      expect(`${err!.message} ${err!.cause?.message ?? ""}`).toMatch(
        /append-only/,
      );
    };
    await rejected(
      db
        .update(whistleblowerNotes)
        .set({ body: "tampered" })
        .where(eq(whistleblowerNotes.id, n.id)),
    );
    await rejected(
      db.delete(whistleblowerNotes).where(eq(whistleblowerNotes.id, n.id)),
    );
    await rejected(db.execute(sql`truncate table whistleblower_notes`));
    expect((await logOf(id))[0].body).toBe(n.body);
  });

  it("countOpenReports counts new + under_review only", async () => {
    const C = await seedOnboarded(db, `dc-${uid()}`);
    const actor = { companyId: C.company.id, userId: C.user.id };
    const ids = [
      await seedReport(C, "1"),
      await seedReport(C, "2"),
      await seedReport(C, "3"),
    ];
    expect(await countOpenReports(db, C.company.id)).toBe(3);
    await changeStatus(db, actor, ids[1], "under_review");
    expect(await countOpenReports(db, C.company.id)).toBe(3);
    await changeStatus(db, actor, ids[2], "closed");
    expect(await countOpenReports(db, C.company.id)).toBe(2);
    await changeStatus(db, actor, ids[0], "closed");
    await changeStatus(db, actor, ids[1], "closed");
    expect(await countOpenReports(db, C.company.id)).toBe(0);
    expect(await countOpenReports(db, A.company.id)).toBeGreaterThan(0); // another tenant is not mixed in
  });

  it("the database refuses any status outside the three (the old 'received' is gone)", async () => {
    const id = await seedReport(A, "check constraint");
    await expect(
      db
        .update(whistleblowerReports)
        .set({ status: "received" })
        .where(and(eq(whistleblowerReports.id, id))),
    ).rejects.toThrow();
  });
});
