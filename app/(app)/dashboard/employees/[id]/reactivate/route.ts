import { NextResponse } from "next/server";
import { requireTenantRoute } from "@/lib/auth/require-tenant";
import { getDb } from "@/lib/db/client";
import { reactivateEmployee } from "@/lib/employee/admin";
import { isUuid } from "@/lib/http";

export const runtime = "nodejs";

// POST /dashboard/employees/<id>/reactivate. The employee id is only a lookup key combined with the
// session's company: another company's employee is a 404.
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireTenantRoute();
  if (!gate.ok) return gate.response;
  const { tenant } = gate.ctx;
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not Found", { status: 404 });
  const ok = await reactivateEmployee(getDb(), tenant.companyId, id);
  if (!ok) return new Response("Not Found", { status: 404 });
  const origin = new URL(process.env.APP_URL || request.url).origin;
  return NextResponse.redirect(`${origin}/dashboard/employees`, 303);
}
