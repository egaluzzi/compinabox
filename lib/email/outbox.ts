import { createHash, timingSafeEqual } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { appEnv } from "@/lib/env";

// The staging-only viewer for the e-mail sink (FileSink in ./index.ts). It exists so a tester can
// click through every flow (sign-in links, welcome, employee and vendor links) without a mail
// provider. Everything here is a pure function of its inputs or reads only the sink directory.

type Env = Record<string, string | undefined>;

export const OUTBOX_USER = "outbox";
export const OUTBOX_LIMIT = 50;
/** Files FileSink writes: `<Date.now()>-<uuid>.json`. Nothing else in the directory is read. */
const SINK_FILE =
  /^(\d{10,16})-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/;

/** Only on staging, with the sink on and a password set; any other combination is a 404. */
export function outboxEnabled(env: Env = process.env): boolean {
  return (
    (env.APP_ENV ?? "").trim().toLowerCase() === "staging" &&
    appEnv(env) === "staging" &&
    env.EMAIL_DEV_SINK === "true" &&
    (env.DEV_OUTBOX_PASSWORD ?? "").length > 0
  );
}

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();

/** Constant-time compare of the Basic credentials against user "outbox" + the password. */
export function basicAuthOk(header: string | null, password: string): boolean {
  if (!header || !/^basic /i.test(header)) return false;
  let decoded: string;
  try {
    decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
  } catch {
    return false;
  }
  const i = decoded.indexOf(":");
  if (i < 0) return false;
  const userOk = timingSafeEqual(
    digest(decoded.slice(0, i)),
    digest(OUTBOX_USER),
  );
  const passOk = timingSafeEqual(
    digest(decoded.slice(i + 1)),
    digest(password),
  );
  return userOk && passOk;
}

// Failed-attempt limiter. In-process and global: the app reads no client address (the repo's
// invariants forbid it outside two places), so after MAX_FAILS failures in WINDOW_MS everything
// is refused with 429 until the window passes. On staging, locking the viewer out under attack is
// the intended trade.
const MAX_FAILS = 10;
const WINDOW_MS = 60_000;
let fails: number[] = [];
export function outboxLocked(now = Date.now()): boolean {
  fails = fails.filter((t) => now - t < WINDOW_MS);
  return fails.length >= MAX_FAILS;
}
export function recordOutboxFailure(now = Date.now()) {
  fails.push(now);
}
export function resetOutboxLimiter() {
  fails = [];
}

export type OutboxMessage = {
  file: string;
  at: Date;
  to: string;
  subject: string;
  text: string;
};

/** Newest first. Reads only regular files with the sink's own naming pattern inside `dir`. */
export async function listOutbox(
  dir: string,
  limit = OUTBOX_LIMIT,
): Promise<OutboxMessage[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const picked = names
    .filter((n) => SINK_FILE.test(n))
    .sort()
    .reverse()
    .slice(0, limit);
  const out: OutboxMessage[] = [];
  for (const file of picked) {
    const full = path.join(dir, file);
    try {
      if (!(await lstat(full)).isFile()) continue;
      const j = JSON.parse(await readFile(full, "utf8")) as Record<
        string,
        unknown
      >;
      out.push({
        file,
        at: new Date(Number(SINK_FILE.exec(file)![1])),
        to: typeof j.to === "string" ? j.to : "",
        subject: typeof j.subject === "string" ? j.subject : "",
        text: typeof j.text === "string" ? j.text : "",
      });
    } catch {
      continue;
    }
  }
  return out;
}

export const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const URL_RE = /https?:\/\/[^\s<>"']+/g;

/** Escaped text with every http(s) URL turned into an anchor (and nothing else). */
export function linkify(text: string): string {
  let html = "";
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0].replace(/[).,;:!?]+$/, "");
    html += escapeHtml(text.slice(last, m.index));
    html += `<a href="${escapeHtml(url)}" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
    last = m.index + url.length;
  }
  return html + escapeHtml(text.slice(last));
}

export function renderOutbox(messages: OutboxMessage[]): string {
  const items = messages
    .map(
      (m) => `<article>
<h2>${escapeHtml(m.subject || "(no subject)")}</h2>
<p class="meta">To: ${escapeHtml(m.to)} · ${escapeHtml(m.at.toISOString())}</p>
<pre>${linkify(m.text)}</pre>
</article>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Dev outbox</title>
<style>body{font:15px/1.5 system-ui,sans-serif;max-width:46rem;margin:0 auto;padding:1rem}
.banner{background:#fbbf24;padding:.5rem 1rem;text-align:center;font-weight:600;margin:0 -1rem 1rem}
article{border:1px solid #cbd5e1;border-radius:6px;padding:.75rem 1rem;margin:1rem 0}
h2{font-size:1.05rem;margin:0}.meta{color:#475569;margin:.25rem 0}pre{white-space:pre-wrap;word-break:break-word;margin:.5rem 0 0}</style>
</head><body>
<div class="banner">Staging — fictitious data. Messages written by the e-mail sink (newest first, at most ${OUTBOX_LIMIT}).</div>
<h1>Dev outbox</h1>
${items || "<p>No messages yet.</p>"}
</body></html>`;
}
