// @vitest-environment node
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BINDER_COOLDOWN_MS,
  BINDER_CONCURRENCY,
  BINDER_DAILY_CAP,
  BINDER_MAX_BYTES,
  BINDER_STUCK_MS,
} from "@/lib/binder/constants";
import {
  recoverStuck,
  requestBinder,
  runBinderJob,
  scheduleBinderJob,
} from "@/lib/binder/jobs";
import {
  getBinderFile,
  getBinderMeta,
  listBinders,
} from "@/lib/binder/queries";
import { binders } from "@/lib/db/schema";
import { useScratchTestDb } from "./helpers/db";
import { makeBinder, seedBinderCompany } from "./helpers/binder";

let db: Awaited<ReturnType<typeof useScratchTestDb>>["db"];
let dropDb: () => Promise<void>;
type Seeded = Awaited<ReturnType<typeof seedBinderCompany>>;
const OPTS = { includeChannelStats: false };
const fresh = () => seedBinderCompany(db, { employees: 2, vendors: 1 });
const none = { start: () => {} }; // enqueue without running anything
const input = (s: Seeded) => ({
  companyId: s.company.id,
  userId: s.user.id,
  options: OPTS,
});
// drizzle wraps driver errors ("Failed query: ..."); the trigger's message is on the cause
const rejectsImmutable = async (p: PromiseLike<unknown>) => {
  const err = await Promise.resolve(p).then(
    () => null,
    (e: { message: string; cause?: { message: string } }) => e,
  );
  expect(err, "expected the statement to be rejected").not.toBeNull();
  expect(`${err!.message} ${err!.cause?.message}`).toMatch(/immutable/);
};
const row = async (id: string) =>
  (await db.select().from(binders).where(eq(binders.id, id)))[0];
const insertRow = (s: Seeded, over: Partial<typeof binders.$inferInsert>) =>
  db
    .insert(binders)
    .values({ companyId: s.company.id, options: OPTS, ...over })
    .returning();

beforeAll(async () => {
  process.env.APP_URL = "http://localhost:3000";
  ({ db, drop: dropDb } = await useScratchTestDb());
});
afterAll(async () => {
  await dropDb();
});

describe("one active job per company", () => {
  it("a double click returns the same job; exactly one row exists", async () => {
    const s = await fresh();
    const [a, b] = await Promise.all([
      requestBinder(db, input(s), none),
      requestBinder(db, input(s), none),
    ]);
    expect([a.kind, b.kind].sort()).toEqual(["existing", "started"]);
    const ids = new Set([a, b].map((r) => ("binder" in r ? r.binder.id : "")));
    expect(ids.size).toBe(1);
    expect((await listBinders(db, s.company.id)).length).toBe(1);
  });

  it("many parallel clicks still yield one job (the partial unique index is the backstop)", async () => {
    const s = await fresh();
    const rs = await Promise.all(
      Array.from({ length: 8 }, () => requestBinder(db, input(s), none)),
    );
    expect(rs.filter((r) => r.kind === "started").length).toBe(1);
    expect(rs.filter((r) => r.kind === "existing").length).toBe(7);
    expect((await listBinders(db, s.company.id)).length).toBe(1);
  });

  it("the database refuses a second queued/running row directly", async () => {
    const s = await fresh();
    await insertRow(s, { status: "running" });
    await expect(insertRow(s, { status: "queued" })).rejects.toThrow();
    // failed / ready rows are not active: any number may exist
    await insertRow(s, { status: "failed", errorCode: "interrupted" });
    await insertRow(s, { status: "failed", errorCode: "interrupted" });
  });

  it("companies do not block each other", async () => {
    const a = await fresh();
    const b = await fresh();
    expect((await requestBinder(db, input(a), none)).kind).toBe("started");
    expect((await requestBinder(db, input(b), none)).kind).toBe("started");
  });
});

describe("the job", () => {
  it("queued -> running -> ready; the stored hash is the SHA-256 of the stored bytes", async () => {
    const s = await fresh();
    const r = await requestBinder(db, input(s), none);
    expect(r.kind).toBe("started");
    const id = (r as { binder: { id: string } }).binder.id;
    expect((await row(id)).status).toBe("queued");
    await runBinderJob(db, id);
    const done = await row(id);
    expect(done.status).toBe("ready");
    expect(done.errorCode).toBeNull();
    expect(done.startedAt).toBeInstanceOf(Date);
    expect(done.finishedAt).toBeInstanceOf(Date);
    expect(done.asOf).toBeInstanceOf(Date);
    expect(done.pdf!.subarray(0, 5).toString()).toBe("%PDF-");
    expect(done.sizeBytes).toBe(done.pdf!.length);
    expect(done.sha256).toBe(
      createHash("sha256").update(done.pdf!).digest("hex"),
    );
    expect(done.pageCount).toBeGreaterThan(10);
    // the same file comes back through the tenant-scoped reader
    const f = await getBinderFile(db, s.company.id, id);
    expect(f?.pdf.equals(done.pdf!)).toBe(true);
  }, 60_000);

  it("running a job twice does nothing the second time (the claim is atomic)", async () => {
    const s = await fresh();
    const done = await makeBinder(db, s);
    const before = done.sha256;
    await runBinderJob(db, done.id);
    expect((await row(done.id)).sha256).toBe(before);
  }, 60_000);

  it("a render failure is recorded as render_failed with no message and no PDF", async () => {
    const s = await fresh();
    const b = await makeBinder(db, s, OPTS, {
      render: async () => {
        throw new Error("boom with Colaborador 001 inside");
      },
    });
    expect(b.status).toBe("failed");
    expect(b.errorCode).toBe("render_failed");
    expect(b.pdf).toBeNull();
    expect(JSON.stringify(b)).not.toContain("boom");
    // a failed job frees the slot
    expect(
      (
        await requestBinder(db, input(s), {
          ...none,
          now: new Date(Date.now() + 60_000),
        })
      ).kind,
    ).toBe("started");
  });

  it("a snapshot failure is recorded as snapshot_failed", async () => {
    const s = await fresh();
    const b = await makeBinder(db, s, OPTS, {
      snapshot: {
        afterFirstRead: async () => {
          throw new Error("db went away");
        },
      },
    });
    expect(b.status).toBe("failed");
    expect(b.errorCode).toBe("snapshot_failed");
  });

  it("a file over the size cap fails with too_large and is never stored", async () => {
    const s = await fresh();
    const b = await makeBinder(db, s, OPTS, {
      render: async () => ({
        buffer: Buffer.alloc(BINDER_MAX_BYTES + 1),
        pageCount: 1,
      }),
    });
    expect(b.status).toBe("failed");
    expect(b.errorCode).toBe("too_large");
    expect(b.pdf).toBeNull();
    expect(b.sizeBytes).toBeNull();
  }, 60_000);

  it("a file exactly at the cap is accepted", async () => {
    const s = await fresh();
    const b = await makeBinder(db, s, OPTS, {
      render: async () => ({
        buffer: Buffer.alloc(BINDER_MAX_BYTES),
        pageCount: 1,
      }),
    });
    expect(b.status).toBe("ready");
    expect(b.sizeBytes).toBe(BINDER_MAX_BYTES);
  }, 60_000);
});

describe("stuck-job recovery", () => {
  it("a running job older than the timeout becomes failed: interrupted; fresh ones are untouched", async () => {
    const s = await fresh();
    const old = new Date(Date.now() - BINDER_STUCK_MS - 1000);
    const [stuck] = await insertRow(s, {
      status: "running",
      startedAt: old,
      createdAt: old,
    });
    expect(await recoverStuck(db, s.company.id)).toBe(1);
    const r = await row(stuck.id);
    expect(r.status).toBe("failed");
    expect(r.errorCode).toBe("interrupted");
    expect(r.finishedAt).toBeInstanceOf(Date);

    const [fresh1] = await insertRow(s, {
      status: "running",
      startedAt: new Date(),
    });
    expect(await recoverStuck(db, s.company.id)).toBe(0);
    expect((await row(fresh1.id)).status).toBe("running");
  });

  it("a queued job that never started is recovered too", async () => {
    const s = await fresh();
    const old = new Date(Date.now() - BINDER_STUCK_MS - 1000);
    const [q] = await insertRow(s, { status: "queued", createdAt: old });
    await recoverStuck(db, s.company.id);
    expect((await row(q.id)).errorCode).toBe("interrupted");
  });

  it("a new request notices the stuck job, frees the slot and starts a new one (after the cooldown)", async () => {
    const s = await fresh();
    const old = new Date(Date.now() - 2 * BINDER_STUCK_MS);
    await insertRow(s, { status: "running", startedAt: old, createdAt: old });
    const r = await requestBinder(db, input(s), none);
    expect(r.kind).toBe("started");
  });

  it("a recovered job that wakes up later cannot overwrite the failure (it is no longer running)", async () => {
    const s = await fresh();
    const old = new Date(Date.now() - 2 * BINDER_STUCK_MS);
    const [q] = await insertRow(s, { status: "queued", createdAt: old });
    await recoverStuck(db, s.company.id);
    await runBinderJob(db, q.id); // the late worker: claim finds nothing
    const r = await row(q.id);
    expect(r.status).toBe("failed");
    expect(r.pdf).toBeNull();
  });

  it("recovery is scoped to the caller's company", async () => {
    const a = await fresh();
    const b = await fresh();
    const old = new Date(Date.now() - 2 * BINDER_STUCK_MS);
    const [bs] = await insertRow(b, {
      status: "running",
      startedAt: old,
      createdAt: old,
    });
    await recoverStuck(db, a.company.id);
    expect((await row(bs.id)).status).toBe("running");
  });
});

describe("rate limits", () => {
  it("cooldown: right after a finished job a new one is refused, with the wait; after it, accepted", async () => {
    const s = await fresh();
    const finished = new Date();
    await insertRow(s, {
      status: "failed",
      errorCode: "render_failed",
      finishedAt: finished,
    });
    const soon = await requestBinder(db, input(s), {
      ...none,
      now: new Date(finished.getTime() + 5_000),
    });
    expect(soon.kind).toBe("cooldown");
    expect((soon as { retryAfterMs: number }).retryAfterMs).toBe(
      BINDER_COOLDOWN_MS - 5_000,
    );
    expect((await listBinders(db, s.company.id)).length).toBe(1); // nothing inserted
    const later = await requestBinder(db, input(s), {
      ...none,
      now: new Date(finished.getTime() + BINDER_COOLDOWN_MS + 1),
    });
    expect(later.kind).toBe("started");
  });

  it("daily cap: BINDER_DAILY_CAP jobs per UTC day, failures count; another company is unaffected", async () => {
    const s = await fresh();
    const other = await fresh();
    const now = new Date();
    const longAgo = new Date(now.getTime() - 3600_000);
    await db.insert(binders).values(
      Array.from({ length: BINDER_DAILY_CAP }, () => ({
        companyId: s.company.id,
        options: OPTS,
        status: "failed",
        errorCode: "render_failed",
        createdAt: now,
        finishedAt: longAgo,
      })),
    );
    expect((await requestBinder(db, input(s), { ...none, now })).kind).toBe(
      "cap",
    );
    expect((await requestBinder(db, input(other), { ...none, now })).kind).toBe(
      "started",
    );
    // the next UTC day the count starts again
    const tomorrow = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0,
        5,
      ),
    );
    expect(
      (await requestBinder(db, input(s), { ...none, now: tomorrow })).kind,
    ).toBe("started");
  });

  it("an active job is returned even when the cap or cooldown would refuse a NEW one", async () => {
    const s = await fresh();
    await insertRow(s, { status: "running", startedAt: new Date() });
    const r = await requestBinder(db, input(s), none);
    expect(r.kind).toBe("existing");
  });
});

describe("immutability (trigger)", () => {
  it("a ready row cannot be updated, deleted or truncated — not even by the owner role", async () => {
    const s = await fresh();
    const b = await makeBinder(db, s);
    expect(b.status).toBe("ready");
    await rejectsImmutable(
      db.update(binders).set({ errorCode: "x" }).where(eq(binders.id, b.id)),
    );
    await rejectsImmutable(
      db.update(binders).set({ status: "failed" }).where(eq(binders.id, b.id)),
    );
    await rejectsImmutable(
      db
        .update(binders)
        .set({ pdf: Buffer.from("x") })
        .where(eq(binders.id, b.id)),
    );
    await rejectsImmutable(db.delete(binders).where(eq(binders.id, b.id)));
    await rejectsImmutable(db.execute(sql`truncate binders`));
    const after = await row(b.id);
    expect(after.sha256).toBe(b.sha256);
    expect(after.pdf!.equals(b.pdf!)).toBe(true);
  }, 60_000);

  it("rows that are not ready can change state (that is how a job progresses)", async () => {
    const s = await fresh();
    const [q] = await insertRow(s, { status: "queued" });
    await db
      .update(binders)
      .set({ status: "running" })
      .where(eq(binders.id, q.id));
    await db
      .update(binders)
      .set({ status: "failed", errorCode: "interrupted" })
      .where(eq(binders.id, q.id));
    expect((await row(q.id)).status).toBe("failed");
  });

  it("a ready row must be complete (hash, size, pages, as-of, bytes)", async () => {
    const s = await fresh();
    await expect(insertRow(s, { status: "ready" })).rejects.toThrow();
  });
});

describe("tenant scoping of the readers", () => {
  it("another company's binder id is invisible to list, meta and file", async () => {
    const a = await fresh();
    const b = await fresh();
    const mine = await makeBinder(db, a);
    expect(await getBinderMeta(db, b.company.id, mine.id)).toBeNull();
    expect(await getBinderFile(db, b.company.id, mine.id)).toBeNull();
    expect((await listBinders(db, b.company.id)).length).toBe(0);
    expect(await getBinderMeta(db, a.company.id, mine.id)).not.toBeNull();
  }, 60_000);

  it("lists and status reads never load the PDF bytes", async () => {
    const a = await fresh();
    await makeBinder(db, a);
    const [m] = await listBinders(db, a.company.id);
    expect("pdf" in m).toBe(false);
    const meta = await getBinderMeta(db, a.company.id, m.id);
    expect(meta && "pdf" in meta).toBe(false);
  }, 60_000);
});

describe("process-wide render concurrency", () => {
  it("never more than BINDER_CONCURRENCY renders at once; the rest wait as queued, then all finish", async () => {
    const cos = await Promise.all(Array.from({ length: 5 }, () => fresh()));
    let running = 0;
    let peak = 0;
    const render = async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 150));
      running--;
      return { buffer: Buffer.from("%PDF-1.3 stub"), pageCount: 1 };
    };
    const ids: string[] = [];
    for (const s of cos) {
      const [r] = await insertRow(s, { status: "queued" });
      ids.push(r.id);
      scheduleBinderJob(db, r.id, { render });
    }
    // right after scheduling, the ones beyond the cap are still queued
    await new Promise((r) => setTimeout(r, 60));
    const states = await Promise.all(
      ids.map(async (id) => (await row(id)).status),
    );
    expect(states.filter((x) => x === "queued").length).toBeGreaterThanOrEqual(
      5 - BINDER_CONCURRENCY - 1,
    );
    for (let i = 0; i < 100; i++) {
      const all = await Promise.all(
        ids.map(async (id) => (await row(id)).status),
      );
      if (all.every((x) => x === "ready")) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(
      (await Promise.all(ids.map(async (id) => (await row(id)).status))).every(
        (x) => x === "ready",
      ),
    ).toBe(true);
    expect(peak).toBe(BINDER_CONCURRENCY);
  }, 60_000);
});
