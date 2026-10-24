import { NextResponse } from "next/server";
import { requireTenantRoute } from "@/lib/auth/require-tenant";
import { getDb } from "@/lib/db/client";
import { isUuid } from "@/lib/http";
import { getScreeningProvider } from "@/lib/screening";
import { screenVendor } from "@/lib/vendors/screen";

export const runtime = "nodejs";

// POST /dashboard/vendors/<id>/screen — the explicit admin click (each run may cost money: there
// is no bulk, scheduled or automatic screening anywhere). Company and user are the session's.
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireTenantRoute();
  if (!gate.ok) return gate.response;
  const { tenant } = gate.ctx;
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not Found", { status: 404 });
  const result = await screenVendor(
    getDb(),
    tenant.companyId,
    tenant.userId,
    id,
    getScreeningProvider(),
  );
  if (result.state === "not_found")
    return new Response("Not Found", { status: 404 });
  const origin = new URL(process.env.APP_URL || request.url).origin;
  const code = result.state === "done" ? result.status : result.state;
  return NextResponse.redirect(
    `${origin}/dashboard/vendors/${id}?screen=${code}`,
    303,
  );
}
