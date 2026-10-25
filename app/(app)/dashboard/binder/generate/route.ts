import { NextResponse } from "next/server";
import { binderAvailable } from "@/lib/binder/constants";
import { requestBinder } from "@/lib/binder/jobs";
import { requireTenantRoute } from "@/lib/auth/require-tenant";
import { getDb } from "@/lib/db/client";

export const runtime = "nodejs";

// POST /dashboard/binder/generate — the click. Company and user come from the session. Returns at
// once: the job runs in this process and the page polls. A second click while one is active lands
// on the same job.
export async function POST(request: Request) {
  const gate = await requireTenantRoute();
  if (!gate.ok) return gate.response;
  const { tenant, locale } = gate.ctx;
  const origin = new URL(process.env.APP_URL || request.url).origin;
  const back = (flag: string) =>
    NextResponse.redirect(`${origin}/dashboard/binder?generate=${flag}`, 303);
  if (!binderAvailable(locale)) return back("unavailable");

  let includeChannelStats = false;
  try {
    includeChannelStats = (await request.formData()).get("stats") === "on";
  } catch {
    // no form body: defaults
  }
  const r = await requestBinder(getDb(), {
    companyId: tenant.companyId,
    userId: tenant.userId,
    options: { includeChannelStats },
  });
  return back(r.kind);
}
