import { NextResponse } from "next/server";
import { requireTenantRoute } from "@/lib/auth/require-tenant";
import { getDb } from "@/lib/db/client";
import { updateCompanySettings } from "@/lib/db/tenant";
import { isIndustry } from "@/lib/industries";
import { saveLogo } from "@/lib/uploads";

export const runtime = "nodejs";

function back(request: Request, query: string) {
  const origin = new URL(process.env.APP_URL || request.url).origin;
  return NextResponse.redirect(`${origin}/dashboard/settings${query}`, 303);
}

// POST /dashboard/settings/save (multipart: companyName, industry, logo?). The company is the
// session's company; no company id is read from the request. Does NOT regenerate documents and
// does not touch onboarding_completed_at.
export async function POST(request: Request) {
  const gate = await requireTenantRoute();
  if (!gate.ok) return gate.response;
  const { tenant } = gate.ctx;

  const form = await request.formData();
  const name = String(form.get("companyName") ?? "").trim();
  const industry = form.get("industry");
  if (name.length < 2 || name.length > 120 || !isIndustry(industry))
    return back(request, "?error=1");

  let logoFile: string | undefined;
  const logo = form.get("logo");
  if (logo instanceof File && logo.size > 0) {
    const saved = await saveLogo(new Uint8Array(await logo.arrayBuffer()));
    if (!saved.ok) return back(request, "?error=logo");
    logoFile = saved.file;
  }
  await updateCompanySettings(getDb(), tenant.companyId, {
    name,
    industry,
    logoFile,
  });
  return back(request, "?saved=1");
}
