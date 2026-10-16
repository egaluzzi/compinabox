import { NextResponse } from "next/server";
import { requireTenantRoute } from "@/lib/auth/require-tenant";
import { getDb } from "@/lib/db/client";
import { getEmailSender } from "@/lib/email";
import { sendPending } from "@/lib/employee/invites";

export const runtime = "nodejs";

// POST /dashboard/employees/invite-pending — at most 50 per click, sequential.
export async function POST(request: Request) {
  const gate = await requireTenantRoute();
  if (!gate.ok) return gate.response;
  const { tenant, company } = gate.ctx;
  const origin = new URL(process.env.APP_URL || request.url).origin;
  let sender;
  try {
    sender = getEmailSender();
  } catch {
    return NextResponse.redirect(
      `${origin}/dashboard/employees?invite=notconfigured`,
      303,
    );
  }
  const r = await sendPending(
    getDb(),
    { id: tenant.companyId, name: company.name, country: company.country },
    new Date(),
    sender,
  );
  return NextResponse.redirect(
    `${origin}/dashboard/employees?batch=${r.sent}.${r.failed}.${r.remaining}`,
    303,
  );
}
