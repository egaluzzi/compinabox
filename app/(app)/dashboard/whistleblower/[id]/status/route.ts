import { NextResponse } from "next/server";
import { requireTenantRoute } from "@/lib/auth/require-tenant";
import { getDb } from "@/lib/db/client";
import { isUuid } from "@/lib/http";
import { isStatus } from "@/lib/whistleblower/constants";
import { changeStatus } from "@/lib/whistleblower/queries";

export const runtime = "nodejs";

// POST /dashboard/whistleblower/<id>/status (form: status). The company is the session's; the
// report id is only a lookup key combined with it. Another company's id is a 404.
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireTenantRoute();
  if (!gate.ok) return gate.response;
  const { tenant } = gate.ctx;
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not Found", { status: 404 });
  const to = (await request.formData()).get("status");
  const origin = new URL(process.env.APP_URL || request.url).origin;
  if (!isStatus(to))
    return NextResponse.redirect(
      `${origin}/dashboard/whistleblower/${id}?error=1`,
      303,
    );
  const result = await changeStatus(getDb(), tenant, id, to);
  if (result === null) return new Response("Not Found", { status: 404 });
  return NextResponse.redirect(`${origin}/dashboard/whistleblower/${id}`, 303);
}
