import { NextResponse } from "next/server";
import { requireTenantRoute } from "@/lib/auth/require-tenant";
import { getDb } from "@/lib/db/client";
import { isUuid } from "@/lib/http";
import { setArchived } from "@/lib/vendors/queries";

export const runtime = "nodejs";

// POST /dashboard/vendors/<id>/unarchive — vendors are archived, never deleted. Another company's
// vendor is a 404.
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireTenantRoute();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not Found", { status: 404 });
  const ok = await setArchived(getDb(), gate.ctx.tenant.companyId, id, false);
  if (!ok) return new Response("Not Found", { status: 404 });
  const origin = new URL(process.env.APP_URL || request.url).origin;
  return NextResponse.redirect(`${origin}/dashboard/vendors`, 303);
}
