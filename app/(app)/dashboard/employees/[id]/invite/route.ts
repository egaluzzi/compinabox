import { NextResponse } from "next/server";
import { requireTenantRoute } from "@/lib/auth/require-tenant";
import { getDb } from "@/lib/db/client";
import { getEmailSender } from "@/lib/email";
import { sendInvite } from "@/lib/employee/invites";
import { isUuid } from "@/lib/http";

export const runtime = "nodejs";

// POST /dashboard/employees/<id>/invite — send or resend. Always a NEW link (the previous one
// dies). The employee id is only a lookup key combined with the session's company (404 otherwise).
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireTenantRoute();
  if (!gate.ok) return gate.response;
  const { tenant, company } = gate.ctx;
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not Found", { status: 404 });
  const origin = new URL(process.env.APP_URL || request.url).origin;
  const back = (q: string) =>
    NextResponse.redirect(`${origin}/dashboard/employees?invite=${q}`, 303);
  let sender;
  try {
    sender = getEmailSender();
  } catch {
    return back("notconfigured");
  }
  const result = await sendInvite(
    getDb(),
    { id: tenant.companyId, name: company.name, country: company.country },
    id,
    sender,
  );
  if (result === "not_found") return new Response("Not Found", { status: 404 });
  return back(result);
}
