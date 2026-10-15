import { getDb } from "@/lib/db/client";
import { findCompanyBySlug } from "@/lib/whistleblower/company-slug";
import { notFound, reply } from "@/lib/whistleblower/http";
import { lookupStatus } from "@/lib/whistleblower/status-lookup";
import { statusLimiter } from "@/lib/whistleblower/rate-limit";
import { normalizeTrackingCode } from "@/lib/whistleblower/tracking-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/report/<slug>/status  {"code": "XXXX-XXXX-XXXX"}  (POST so the code never lands in
// a URL, history or referrer). Like the intake it reads nothing about the request but its body.
// Unknown company, malformed code and wrong code all get the identical 404 body.
export async function POST(
  request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const db = getDb();
  const company = await findCompanyBySlug(db, slug).catch(() => null);
  // Unknown slugs share one bucket so the limiter cannot be used to probe which slugs exist.
  if (!statusLimiter.hit(company ? slug : "?"))
    return reply({ error: "rate_limited" }, 429, { "Retry-After": "60" });
  if (!company) return notFound();

  let code: string | null = null;
  try {
    const body = await request.json();
    code = normalizeTrackingCode((body as { code?: unknown } | null)?.code);
  } catch {
    code = null;
  }
  if (!code) return notFound();
  try {
    const found = await lookupStatus(db, company, code);
    return found ? reply(found) : notFound();
  } catch {
    return reply({ error: "server_error" }, 500);
  }
}
