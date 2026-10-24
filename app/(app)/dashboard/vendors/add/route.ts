import { NextResponse } from "next/server";
import { requireTenantRoute } from "@/lib/auth/require-tenant";
import { getDb } from "@/lib/db/client";
import { createVendor, parseVendorForm } from "@/lib/vendors/queries";

export const runtime = "nodejs";

// POST /dashboard/vendors/add — the company is the session's, never a form field.
export async function POST(request: Request) {
  const gate = await requireTenantRoute();
  if (!gate.ok) return gate.response;
  const origin = new URL(process.env.APP_URL || request.url).origin;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  const parsed = parseVendorForm((k) => {
    const v = form.get(k);
    return typeof v === "string" ? v : "";
  });
  const back = (q: string) =>
    NextResponse.redirect(`${origin}/dashboard/vendors?${q}`, 303);
  if (!parsed.ok) return back(`error=${parsed.error}`);
  await createVendor(getDb(), gate.ctx.tenant.companyId, parsed.input);
  return back("added=1");
}
