import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { appEnv, checkEnvironment, isInvalidAppEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

const DB_TIMEOUT_MS = 2000;

async function dbUp(): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      getDb().execute(sql`select 1`),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), DB_TIMEOUT_MS);
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Liveness + readiness for the deploy check and monitoring. No auth, nothing secret: the version
 * (git SHA set by the deploy), whether the database answers, the environment name, and — only
 * when the environment guard is violated — the violation CODES (never values).
 */
export async function GET() {
  const violations = checkEnvironment();
  const db = await dbUp();
  const ok = db && violations.length === 0;
  const body: Record<string, unknown> = {
    ok,
    version: (process.env.APP_VERSION ?? "unknown").slice(0, 64),
    db,
    env: isInvalidAppEnv() ? "invalid" : appEnv(),
  };
  if (violations.length > 0) body.violations = violations;
  return Response.json(body, {
    status: ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
