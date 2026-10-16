// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import nextConfig from "@/next.config";
import type { EmailMessage, EmailSender } from "@/lib/email";
import { sha256 } from "@/lib/employee/session";
import { vendorResponses, vendors } from "@/lib/db/schema";
import { decryptAnswers } from "@/lib/vendors/answers";
import { VENDOR_INVITE_TTL_MS } from "@/lib/vendors/constants";
import { questionnaireEmail, sendQuestionnaire } from "@/lib/vendors/invites";
import { findOpenLink, submitQuestionnaire } from "@/lib/vendors/submit";
import { parseAnswers } from "@/lib/vendors/answers";
import { uid, useTestDb } from "./helpers/db";
import { seedPortalCompany } from "./helpers/employee";

let db: ReturnType<typeof useTestDb>;
type Seeded = Awaited<ReturnType<typeof seedPortalCompany>>;
beforeAll(() => {
  db = useTestDb();
  vi.stubEnv("APP_URL", "http://localhost:3000");
});

function sink() {
  const sent: EmailMessage[] = [];
  let fail = false;
  const sender: EmailSender = {
    send: async (m) => {
      if (fail) throw new Error("smtp down");
      sent.push(m);
    },
  };
  return {
    sender,
    sent,
    failNext: (v = true) => (fail = v),
    token: () => /\/vendor\/([A-Za-z0-9_-]{43})/.exec(sent.at(-1)!.text)![1],
  };
}
const co = (s: Seeded) => ({
  id: s.company.id,
  name: s.company.name,
  country: s.company.country,
});
async function vendor(
  s: Seeded,
  over: Partial<typeof vendors.$inferInsert> = {},
) {
  const [v] = await db
    .insert(vendors)
    .values({
      companyId: s.company.id,
      name: `V ${uid()}`,
      contactEmail: `v-${uid()}@vendor.test`,
      contactName: "Contato",
      ...over,
    })
    .returning();
  return v;
}
const get = async (id: string) =>
  (await db.select().from(vendors).where(eq(vendors.id, id)))[0];
const responses = (id: string) =>
  db.select().from(vendorResponses).where(eq(vendorResponses.vendorId, id));

const GOOD = {
  respondentName: "Maria Silva",
  respondentRole: "Diretora Financeira",
  ownershipText: "Controlada por Holding Exemplo SA (100%).",
  pep: "no",
  pepDetails: "",
  sanctions: "no",
  sanctionsDetails: "",
  antibribery: "yes",
};
const OK = (
  parseAnswers(GOOD) as {
    ok: true;
    answers: Parameters<typeof submitQuestionnaire>[2];
  }
).answers;

async function post(fields: Record<string, string>) {
  const { POST } = await import("@/app/vendor/api/submit/route");
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return POST(
    new Request("http://localhost/vendor/api/submit", {
      method: "POST",
      body: f,
    }),
  );
}
async function page(token: string, retry?: string) {
  const Page = (await import("@/app/vendor/[token]/page")).default;
  const el = await Page({
    params: Promise.resolve({ token }),
    searchParams: Promise.resolve(retry ? { retry } : {}),
  });
  return renderToStaticMarkup(createElement("div", null, el));
}

describe("sending the questionnaire", () => {
  it("emails first, then stores only the hash, a 30-day expiry and status 'sent'", async () => {
    const s = await seedPortalCompany(db);
    const v = await vendor(s);
    const m = sink();
    const t0 = new Date("2026-10-16T12:00:00Z");
    expect(await sendQuestionnaire(db, co(s), v.id, m.sender, t0)).toBe("sent");
    const token = m.token();
    const row = await get(v.id);
    expect(row.inviteTokenHash).toBe(sha256(token));
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row.questionnaireStatus).toBe("sent");
    expect(row.invitedAt).toEqual(t0);
    expect(row.inviteExpiresAt!.getTime() - t0.getTime()).toBe(
      VENDOR_INVITE_TTL_MS,
    );
    expect(VENDOR_INVITE_TTL_MS / 86_400_000).toBe(30);
    expect(m.sent[0].to).toBe(v.contactEmail);
    expect(m.sent[0].text).toContain(`http://localhost:3000/vendor/${token}`);
  });

  it("the email is a neutral request from the company in the company's language: no accusation, no answers, no document text", async () => {
    const s = await seedPortalCompany(db);
    const v = await vendor(s);
    const m = sink();
    await sendQuestionnaire(db, co(s), v.id, m.sender);
    const mail = m.sent[0];
    expect(mail.subject).toBe(
      `${s.company.name} pede que você preencha um breve questionário de integridade`,
    );
    expect(mail.text).toContain(s.company.name);
    expect(mail.text).toContain("não é uma determinação legal");
    expect(mail.text).not.toMatch(/sanç|suspeit|investig|corrup|fraude/i);
    const en = questionnaireEmail(
      { name: "Acme", country: "xx" },
      "a@b.test",
      null,
      "http://x/vendor/t",
    );
    expect(en.subject).toBe(
      "Acme asks you to complete a short integrity questionnaire",
    );
    const mx = questionnaireEmail(
      { name: "Acme", country: "mx" },
      "a@b.test",
      null,
      "http://x/vendor/t",
    );
    const ar = questionnaireEmail(
      { name: "Acme", country: "ar" },
      "a@b.test",
      null,
      "http://x/vendor/t",
    );
    expect(mx.subject).toContain("cuestionario de integridad");
    expect(ar.subject).toBe(mx.subject);
  });

  it("a resend issues a new link and kills the old one", async () => {
    const s = await seedPortalCompany(db);
    const v = await vendor(s);
    const m = sink();
    await sendQuestionnaire(db, co(s), v.id, m.sender);
    const first = m.token();
    await sendQuestionnaire(db, co(s), v.id, m.sender);
    const second = m.token();
    expect(second).not.toBe(first);
    expect(await findOpenLink(db, first)).toBeNull();
    expect(await findOpenLink(db, second)).not.toBeNull();
    expect(await submitQuestionnaire(db, first, OK)).toBe("invalid");
    expect(await responses(v.id)).toHaveLength(0);
  });

  it("a failed email leaves everything as it was (the old link keeps working)", async () => {
    const s = await seedPortalCompany(db);
    const v = await vendor(s);
    const m = sink();
    const t0 = new Date("2026-10-16T12:00:00Z");
    await sendQuestionnaire(db, co(s), v.id, m.sender, t0);
    const old = m.token();
    const before = await get(v.id);
    m.failNext();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      await sendQuestionnaire(
        db,
        co(s),
        v.id,
        m.sender,
        new Date(t0.getTime() + 1000),
      ),
    ).toBe("failed");
    expect(err.mock.calls).toEqual([["vendor questionnaire email failed"]]); // a fixed string only
    err.mockRestore();
    expect(await get(v.id)).toEqual(before);
    expect(await findOpenLink(db, old)).not.toBeNull();
    // and a first send that fails leaves the vendor un-sent
    const v2 = await vendor(s);
    m.failNext();
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendQuestionnaire(db, co(s), v2.id, m.sender)).toBe("failed");
    vi.restoreAllMocks();
    expect(await get(v2.id)).toMatchObject({
      questionnaireStatus: "not_sent",
      inviteTokenHash: null,
      invitedAt: null,
    });
  });

  it("needs a contact email; archived and foreign vendors are refused", async () => {
    const s = await seedPortalCompany(db);
    const other = await seedPortalCompany(db);
    const m = sink();
    expect(
      await sendQuestionnaire(
        db,
        co(s),
        (await vendor(s, { contactEmail: null })).id,
        m.sender,
      ),
    ).toBe("no_email");
    expect(
      await sendQuestionnaire(
        db,
        co(s),
        (await vendor(s, { archivedAt: new Date() })).id,
        m.sender,
      ),
    ).toBe("archived");
    expect(
      await sendQuestionnaire(db, co(s), (await vendor(other)).id, m.sender),
    ).toBe("not_found");
    expect(m.sent).toHaveLength(0);
  });
});

describe("the public form and submit", () => {
  async function sent(over: Partial<typeof vendors.$inferInsert> = {}) {
    const s = await seedPortalCompany(db);
    const v = await vendor(s, over);
    const m = sink();
    await sendQuestionnaire(db, co(s), v.id, m.sender);
    return { s, v, token: m.token() };
  }

  it("GET renders the company's form and consumes nothing", async () => {
    const { s, v, token } = await sent();
    const html = await page(token);
    expect(html).toContain(s.company.name);
    expect(html).toContain("não é uma determinação legal");
    expect(html).toContain('action="/vendor/api/submit"');
    await page(token);
    await page(token);
    expect((await get(v.id)).inviteTokenHash).toBe(sha256(token));
    expect(await findOpenLink(db, token)).not.toBeNull();
  });

  it("submit consumes the link once and stores encrypted answers (JSON mode and no-JS mode)", async () => {
    const { s, v, token } = await sent();
    const res = await post({
      token,
      via: "js",
      ...GOOD,
      pep: "yes",
      pepDetails: "Primo é prefeito 7q",
    });
    expect(await res.json()).toEqual({ ok: true });
    const rows = await responses(v.id);
    expect(rows).toHaveLength(1);
    const after = await get(v.id);
    expect(after).toMatchObject({
      inviteTokenHash: null,
      questionnaireStatus: "submitted",
    });
    expect(after.submittedAt).not.toBeNull();
    // ciphertext at rest: no plaintext anywhere in the row
    const dump = JSON.stringify(rows[0]);
    for (const p of [
      "Maria Silva",
      "Diretora",
      "Holding Exemplo",
      "Primo é prefeito",
    ])
      expect(dump).not.toContain(p);
    expect(rows[0].respondentName).toMatch(/^vt1:/);
    expect(rows[0]).toMatchObject({
      pepExposure: true,
      priorSanctions: false,
      antibriberyPolicy: true,
      companyId: s.company.id,
    });
    expect(decryptAnswers(s.company.id, rows[0])).toMatchObject({
      respondentName: "Maria Silva",
      ownershipText: GOOD.ownershipText,
      pepDetails: "Primo é prefeito 7q",
      sanctionsDetails: "",
    });
    // a ciphertext copied to another tenant does not decrypt there (AAD)
    const other = await seedPortalCompany(db);
    expect(decryptAnswers(other.company.id, rows[0])).toBeNull();
    // the same link again: used
    const again = await post({ token, via: "js", ...GOOD });
    expect(await again.json()).toEqual({ invalid: true });
    expect(await responses(v.id)).toHaveLength(1);
  });

  it("without JavaScript the browser gets redirects: thanks on success, the friendly page on a dead link, ?retry=1 on an error", async () => {
    const { token } = await sent();
    const bad = await post({ token, ...GOOD, respondentName: "" });
    expect(bad.status).toBe(303);
    expect(bad.headers.get("location")).toBe(
      `http://localhost:3000/vendor/${token}?retry=1`,
    );
    expect(await page(token, "1")).toContain("Revise os campos indicados");
    const ok = await post({ token, ...GOOD });
    expect(ok.status).toBe(303);
    expect(ok.headers.get("location")).toBe(
      "http://localhost:3000/vendor/thanks",
    );
    const dead = await post({ token, ...GOOD });
    expect(dead.headers.get("location")).toBe(
      "http://localhost:3000/vendor/link-invalid",
    );
  });

  it("two concurrent submits with one token produce exactly one response", async () => {
    const { v, token } = await sent();
    const out = await Promise.all(
      Array.from({ length: 4 }, () =>
        post({ token, via: "js", ...GOOD }).then((r) => r.json()),
      ),
    );
    expect(out.filter((o) => o.ok)).toHaveLength(1);
    expect(out.filter((o) => o.invalid)).toHaveLength(3);
    expect(await responses(v.id)).toHaveLength(1);
  });

  it("unknown, used, expired, replaced and archived links show the identical friendly page and answer identically", async () => {
    const used = await sent();
    await submitQuestionnaire(db, used.token, OK);
    const expired = await sent();
    await db
      .update(vendors)
      .set({ inviteExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(vendors.id, expired.v.id));
    const archived = await sent();
    await db
      .update(vendors)
      .set({ archivedAt: new Date() })
      .where(eq(vendors.id, archived.v.id));
    const replaced = await sent();
    const m = sink();
    await sendQuestionnaire(db, co(replaced.s), replaced.v.id, m.sender);
    const tokens = [
      "x".repeat(43),
      "",
      "a".repeat(300),
      used.token,
      expired.token,
      archived.token,
      replaced.token,
    ];
    const pages = new Set<string>();
    for (const token of tokens) {
      pages.add(await page(token));
      const j = await post({ token, via: "js", ...GOOD });
      expect(j.status).toBe(200);
      expect(await j.json()).toEqual({ invalid: true });
      const n = await post({ token, ...GOOD });
      expect(n.headers.get("location")).toBe(
        "http://localhost:3000/vendor/link-invalid",
      );
    }
    expect(pages.size).toBe(1);
    const html = [...pages][0];
    expect(html).toContain("Este link não é mais válido");
    expect(html).not.toMatch(/expir.*usado|archiv/i);
    expect(await responses(archived.v.id)).toHaveLength(0);
    expect(await responses(expired.v.id)).toHaveLength(0);
  });

  it("validation errors keep the link alive and say which fields; limits are enforced", async () => {
    const { v, token } = await sent();
    const cases: [Record<string, string>, Record<string, string>][] = [
      [{ respondentName: " " }, { respondentName: "required" }],
      [{ respondentRole: "r".repeat(201) }, { respondentRole: "too_long" }],
      [{ ownershipText: "o".repeat(4001) }, { ownershipText: "too_long" }],
      [{ pep: "" }, { pep: "choice" }],
      [{ sanctions: "maybe" }, { sanctions: "choice" }],
      [{ antibribery: "" }, { antibribery: "choice" }],
      [{ pep: "yes", pepDetails: "" }, { pepDetails: "required" }],
      [
        { sanctions: "yes", sanctionsDetails: "  " },
        { sanctionsDetails: "required" },
      ],
      [
        { pep: "yes", pepDetails: "d".repeat(4001) },
        { pepDetails: "too_long" },
      ],
    ];
    for (const [over, errors] of cases) {
      const res = await post({ token, via: "js", ...GOOD, ...over });
      expect(await res.json()).toEqual({ errors });
    }
    expect(await responses(v.id)).toHaveLength(0);
    expect(await findOpenLink(db, token)).not.toBeNull();
    // exact limits are accepted; details are dropped when the answer is no
    const ok = await post({
      token,
      via: "js",
      ...GOOD,
      respondentName: "n".repeat(200),
      ownershipText: "o".repeat(4000),
      pepDetails: "ignored because no",
    });
    expect(await ok.json()).toEqual({ ok: true });
    const [row] = await responses(v.id);
    expect(row.pepDetails).toBeNull();
  });

  it("the form keeps typed answers across an error (state lives in the component, not the server)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(
      path.resolve(__dirname, "../components/vendor/VendorForm.tsx"),
      "utf8",
    );
    expect(src).toContain("useState<Fields>(EMPTY)");
    expect(src).toContain("e.preventDefault()");
    expect(src).toMatch(/setErrors\(json\.errors/);
    expect(src).not.toMatch(/setV\(EMPTY\)|setV\(\{/); // errors never reset the answers
  });

  it("a resubmission after a resend is a new row; the newest is the answer and the first stays", async () => {
    const { s, v, token } = await sent();
    await submitQuestionnaire(db, token, OK, new Date("2026-10-16T10:00:00Z"));
    const m = sink();
    await sendQuestionnaire(db, co(s), v.id, m.sender);
    expect((await get(v.id)).questionnaireStatus).toBe("sent");
    await submitQuestionnaire(
      db,
      m.token(),
      { ...OK, respondentRole: "Novo cargo" },
      new Date("2026-10-17T10:00:00Z"),
    );
    const rows = (await responses(v.id)).sort(
      (a, b) => b.submittedAt.getTime() - a.submittedAt.getTime(),
    );
    expect(rows).toHaveLength(2);
    expect(decryptAnswers(s.company.id, rows[0])!.respondentRole).toBe(
      "Novo cargo",
    );
    expect(decryptAnswers(s.company.id, rows[1])!.respondentRole).toBe(
      "Diretora Financeira",
    );
  });

  it("vendor_responses is append-only (UPDATE, DELETE rejected)", async () => {
    const { v, token } = await sent();
    await submitQuestionnaire(db, token, OK);
    await expect(
      db
        .update(vendorResponses)
        .set({ pepExposure: true })
        .where(eq(vendorResponses.vendorId, v.id)),
    ).rejects.toThrow();
    await expect(
      db.delete(vendorResponses).where(eq(vendorResponses.vendorId, v.id)),
    ).rejects.toThrow();
    expect(await responses(v.id)).toHaveLength(1);
  });

  it("an encryption failure (no key) consumes nothing", async () => {
    const { v, token } = await sent();
    const keys = process.env.REPORT_ENCRYPTION_KEYS;
    vi.stubEnv("REPORT_ENCRYPTION_KEYS", "");
    await expect(submitQuestionnaire(db, token, OK)).rejects.toThrow();
    vi.stubEnv("REPORT_ENCRYPTION_KEYS", keys!);
    expect((await get(v.id)).inviteTokenHash).toBe(sha256(token));
    expect(await responses(v.id)).toHaveLength(0);
  });
});

describe("headers and what the public paths read", () => {
  it("handler responses are private/no-store, no-referrer, frame-denied, noindex and set no cookie", async () => {
    for (const res of [
      await post({ token: "nope", via: "js", ...GOOD }),
      await post({ token: "nope", ...GOOD }),
      await post({ token: "nope", via: "js" }),
    ]) {
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(res.headers.get("referrer-policy")).toBe("no-referrer");
      expect(res.headers.get("x-frame-options")).toBe("DENY");
      expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(res.headers.get("set-cookie")).toBeNull();
    }
  });

  it("next.config applies the same headers to /vendor pages", async () => {
    const rules = (await nextConfig.headers!()).filter((r) =>
      r.source.startsWith("/vendor"),
    );
    expect(rules.map((r) => r.source)).toEqual(["/vendor/:path*"]);
    const h = Object.fromEntries(rules[0].headers.map((x) => [x.key, x.value]));
    expect(h).toMatchObject({
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
      "X-Robots-Tag": "noindex, nofollow",
    });
  });

  it("check-vendor-privacy.sh passes on the repo and fails on a planted header read / log line", () => {
    const root = path.resolve(__dirname, "..");
    const run = (env: Record<string, string> = {}) => {
      try {
        return {
          code: 0,
          out: execFileSync("scripts/check-vendor-privacy.sh", {
            cwd: root,
            env: { ...process.env, ...env },
            encoding: "utf8",
          }),
        };
      } catch (e) {
        const x = e as { status: number; stdout: string };
        return { code: x.status, out: x.stdout };
      }
    };
    expect(run().code).toBe(0);
    const dir = mkdtempSync(path.join(tmpdir(), "planted-"));
    for (const [name, line] of [
      [
        "a.ts",
        'export const ip = (r: Request) => r.headers.get("x-forwarded-for");',
      ],
      ["b.ts", 'console.log("vendor submitted");'],
      ["c.ts", "// reads the user-agent"],
    ]) {
      writeFileSync(path.join(dir, name), line);
      const r = run({ VENDOR_PATHS: path.join(dir, name) });
      expect(r.code, name).toBe(1);
      expect(r.out).toContain("FAIL");
    }
    expect(run({ VENDOR_PATHS: "does/not/exist" }).code).toBe(1);
  });
});
