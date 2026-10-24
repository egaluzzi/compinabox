import { createHash } from "node:crypto";
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  or,
  lt,
} from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { binders, type BinderOptions } from "@/lib/db/schema";
import { loadLogo } from "@/lib/documents/pdf";
import {
  BINDER_COOLDOWN_MS,
  BINDER_CONCURRENCY,
  BINDER_DAILY_CAP,
  BINDER_MAX_BYTES,
  BINDER_STUCK_MS,
  type BinderErrorCode,
} from "./constants";
import { renderBinderPdf } from "./pdf";
import { binderMetaColumns, getActiveBinder, type BinderMeta } from "./queries";
import { takeSnapshot, type SnapshotHooks } from "./snapshot";

// Asynchronous generation without queue infrastructure: one Node process under systemd.
//   click -> a `queued` row (a partial unique index allows one queued/running job per company) ->
//   the response returns at once -> the work runs in this process, not awaited by the request,
//   behind a process-wide semaphore -> `ready` (or `failed` with a fixed error code).
// A job whose process died is never revived: whoever looks (the page, the poll, a new request)
// marks queued/running rows older than BINDER_STUCK_MS as `failed: interrupted`.

export type JobHooks = {
  snapshot?: SnapshotHooks;
  /** Test seam: runs between the snapshot and the render. */
  beforeRender?: () => Promise<void>;
  /** Test seam: replaces the renderer (e.g. to return an oversized file). */
  render?: typeof renderBinderPdf;
};

class Semaphore {
  private active = 0;
  private waiting: (() => void)[] = [];
  constructor(private readonly limit: number) {}
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit)
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    else this.active++;
    try {
      return await fn();
    } finally {
      const next = this.waiting.shift();
      if (next)
        next(); // hand the slot over
      else this.active--;
    }
  }
}

// One semaphore per process even if a bundler duplicates this module (same trick as the db client).
const g = globalThis as unknown as { __binderSemaphore?: Semaphore };
const semaphore = () =>
  (g.__binderSemaphore ??= new Semaphore(BINDER_CONCURRENCY));

const startOfUtcDay = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Marks this company's stuck queued/running jobs as failed (interrupted). Returns how many. */
export async function recoverStuck(
  db: Db,
  companyId: string,
  now = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - BINDER_STUCK_MS);
  const rows = await db
    .update(binders)
    .set({ status: "failed", errorCode: "interrupted", finishedAt: now })
    .where(
      and(
        eq(binders.companyId, companyId),
        or(
          and(eq(binders.status, "running"), lt(binders.startedAt, cutoff)),
          and(eq(binders.status, "queued"), lt(binders.createdAt, cutoff)),
        ),
      ),
    )
    .returning({ id: binders.id });
  return rows.length;
}

export type RequestResult =
  | { kind: "started" | "existing"; binder: BinderMeta }
  | { kind: "cooldown"; retryAfterMs: number }
  | { kind: "cap" };

const isActiveJobConflict = (err: unknown) => {
  for (
    let e = err as { code?: string; cause?: unknown } | undefined;
    e;
    e = e.cause as typeof e
  ) {
    if (e.code === "23505") return true;
  }
  return false;
};

/**
 * The click. In order: recover stuck jobs; an active job is returned as it is (a double click
 * never starts a second one); the daily cap; the cooldown; then insert the queued row and start it.
 */
export async function requestBinder(
  db: Db,
  input: { companyId: string; userId: string; options: BinderOptions },
  deps: { now?: Date; start?: (db: Db, binderId: string) => void } = {},
): Promise<RequestResult> {
  const now = deps.now ?? new Date();
  const { companyId } = input;
  await recoverStuck(db, companyId, now);

  const active = await getActiveBinder(db, companyId);
  if (active) return { kind: "existing", binder: active };

  const [{ n }] = await db
    .select({ n: count() })
    .from(binders)
    .where(
      and(
        eq(binders.companyId, companyId),
        gte(binders.createdAt, startOfUtcDay(now)),
      ),
    );
  if (n >= BINDER_DAILY_CAP) return { kind: "cap" };

  const [last] = await db
    .select({ finishedAt: binders.finishedAt })
    .from(binders)
    .where(and(eq(binders.companyId, companyId), isNotNull(binders.finishedAt)))
    .orderBy(desc(binders.finishedAt))
    .limit(1);
  if (last?.finishedAt) {
    const wait =
      BINDER_COOLDOWN_MS - (now.getTime() - last.finishedAt.getTime());
    if (wait > 0) return { kind: "cooldown", retryAfterMs: wait };
  }

  let row: BinderMeta;
  try {
    [row] = await db
      .insert(binders)
      .values({
        companyId,
        requestedByUserId: input.userId,
        options: input.options,
      })
      .returning(binderMetaColumns);
  } catch (err) {
    // Lost the race against a concurrent click: the unique index says one active job per company.
    if (!isActiveJobConflict(err)) throw err;
    const existing = await getActiveBinder(db, companyId);
    if (!existing) throw err;
    return { kind: "existing", binder: existing };
  }
  (deps.start ?? scheduleBinderJob)(db, row.id);
  return { kind: "started", binder: row };
}

/** Starts the job in the background; never throws into the caller. */
export function scheduleBinderJob(db: Db, binderId: string, hooks?: JobHooks) {
  void semaphore()
    .run(() => runBinderJob(db, binderId, hooks))
    .catch(() => {
      // runBinderJob records its own failures; nothing may escape into the request that started it
    });
}

async function fail(db: Db, binderId: string, code: BinderErrorCode) {
  await db
    .update(binders)
    .set({ status: "failed", errorCode: code, finishedAt: new Date() })
    .where(
      and(
        eq(binders.id, binderId),
        inArray(binders.status, ["queued", "running"]),
      ),
    );
}

/**
 * Runs one job: claim it (queued -> running; if recovery already failed it, do nothing), read the
 * snapshot, render, store. The final update only applies to a row that is still `running`.
 */
export async function runBinderJob(
  db: Db,
  binderId: string,
  hooks: JobHooks = {},
) {
  const [claimed] = await db
    .update(binders)
    .set({ status: "running", startedAt: new Date() })
    .where(and(eq(binders.id, binderId), eq(binders.status, "queued")))
    .returning({ companyId: binders.companyId, options: binders.options });
  if (!claimed) return;

  let snap;
  try {
    snap = await takeSnapshot(
      db,
      { binderId, companyId: claimed.companyId, options: claimed.options },
      hooks.snapshot,
    );
  } catch {
    return fail(db, binderId, "snapshot_failed");
  }

  let out;
  try {
    if (hooks.beforeRender) await hooks.beforeRender();
    const logo = await loadLogo(snap.company.logoFile);
    out = await (hooks.render ?? renderBinderPdf)(snap, logo);
  } catch {
    return fail(db, binderId, "render_failed");
  }

  if (out.buffer.length > BINDER_MAX_BYTES)
    return fail(db, binderId, "too_large");

  await db
    .update(binders)
    .set({
      status: "ready",
      asOf: snap.asOf,
      finishedAt: new Date(),
      sizeBytes: out.buffer.length,
      pageCount: out.pageCount,
      sha256: createHash("sha256").update(out.buffer).digest("hex"),
      pdf: out.buffer,
    })
    .where(and(eq(binders.id, binderId), eq(binders.status, "running")));
}
