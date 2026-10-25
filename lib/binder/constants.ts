// Phase 8 binder (dossier) numbers and vocabularies — one place, so a change is one edit.

/** A rendered file above this fails with `too_large` (the bytes are stored in Postgres). */
export const BINDER_MAX_BYTES = 25 * 1024 * 1024;
/** Process-wide cap on simultaneous renders (one Node process under systemd, no queue service). */
export const BINDER_CONCURRENCY = 2;
/** A queued/running job older than this is marked `failed: interrupted` when someone looks. */
export const BINDER_STUCK_MS = 10 * 60 * 1000;
/** Pause after a job finishes (ready or failed) before the same company can start another. */
export const BINDER_COOLDOWN_MS = 30 * 1000;
/** Jobs a company may start per UTC day. Failures count. */
export const BINDER_DAILY_CAP = 20;

export const BINDER_STATUSES = [
  "queued",
  "running",
  "ready",
  "failed",
] as const;
export type BinderStatus = (typeof BINDER_STATUSES)[number];

/** Fixed error vocabulary: stored and shown as a code, never as a message (no data in errors). */
export const BINDER_ERROR_CODES = [
  "too_large",
  "snapshot_failed",
  "render_failed",
  "interrupted",
] as const;
export type BinderErrorCode = (typeof BINDER_ERROR_CODES)[number];

export const isBinderStatus = (v: string): v is BinderStatus =>
  (BINDER_STATUSES as readonly string[]).includes(v);

/** Display and "as of" time zone: the company's (Brazil). */
export const BINDER_TZ = "America/Sao_Paulo";

/** The dossier text exists in pt-BR only (the one language the documents are generated in). */
export const binderAvailable = (locale: string) => locale === "pt-BR";
