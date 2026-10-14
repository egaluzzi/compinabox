import { NextResponse } from "next/server";
import { getTenant } from "@/lib/auth/tenant";
import { getDb } from "@/lib/db/client";
import { updateCompanyProfile } from "@/lib/db/tenant";
import { isIndustry } from "@/lib/industries";
import { saveLogo } from "@/lib/uploads";

function back(request: Request, to: string) {
  const origin = new URL(process.env.APP_URL || request.url).origin;
  return NextResponse.redirect(`${origin}${to}`, 303);
}

// POST /api/onboarding (multipart). The company is ALWAYS the session's company: any
// company id in the form is ignored because none is read.
export async function POST(request: Request) {
  const tenant = await getTenant();
  if (!tenant) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData();
  const name = String(form.get("companyName") ?? "").trim();
  const industry = form.get("industry");
  if (name.length < 2 || name.length > 120 || !isIndustry(industry))
    return back(request, "/onboarding?error=1");

  let logoFile: string | undefined;
  const logo = form.get("logo");
  if (logo instanceof File && logo.size > 0) {
    const saved = await saveLogo(new Uint8Array(await logo.arrayBuffer()));
    if (!saved.ok) return back(request, "/onboarding?error=logo");
    logoFile = saved.file;
  }

  await updateCompanyProfile(getDb(), tenant.companyId, {
    name,
    industry,
    logoFile,
  });
  return back(request, "/dashboard");
}
