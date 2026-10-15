import { getDb } from "@/lib/db/client";
import { notifyAdminsOfNewReport } from "@/lib/email/report-notice";
import { findCompanyBySlug } from "@/lib/whistleblower/company-slug";
import { notFound, reply } from "@/lib/whistleblower/http";
import {
  isHoneypot,
  parseSubmission,
  storeReport,
} from "@/lib/whistleblower/intake";
import { submitLimiter } from "@/lib/whistleblower/rate-limit";
import {
  formatTrackingCode,
  generateTrackingCode,
} from "@/lib/whistleblower/tracking-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/report/<slug> (multipart). ANONYMOUS BY DEFAULT: this handler reads the multipart
// body and the slug from the URL, and nothing else about the request — no address, no browser
// details, no cookies, no header of any kind — and logs nothing (scripts/check-anonymity.sh
// fails the build otherwise). Errors are fixed codes; the page turns them into messages.
export async function POST(
  request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const db = getDb();
  const company = await findCompanyBySlug(db, slug).catch(() => null);
  if (!company) return notFound();
  // Per-company ceiling (no client address is read); per-IP limiting is a Cloudflare rule (phase 9).
  if (!submitLimiter.hit(slug))
    return reply({ error: "rate_limited" }, 429, { "Retry-After": "3600" });

  try {
    const form = await request.formData();
    if (isHoneypot(form)) {
      // A bot: same answer as a real submission, nothing stored.
      return reply(
        { ok: true, code: formatTrackingCode(generateTrackingCode()) },
        201,
      );
    }
    const parsed = await parseSubmission(form);
    if (!parsed.ok) return reply({ error: parsed.error }, 422);
    const code = await storeReport(db, company.id, parsed.value);
    // After commit. Never throws: a report is not lost because email is down.
    await notifyAdminsOfNewReport(db, company.id);
    return reply({ ok: true, code: formatTrackingCode(code) }, 201);
  } catch {
    return reply({ error: "server_error" }, 500);
  }
}
