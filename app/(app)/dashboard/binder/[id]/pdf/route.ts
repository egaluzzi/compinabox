import { requireTenantRoute } from "@/lib/auth/require-tenant";
import { binderFilename, getBinderFile } from "@/lib/binder/queries";
import { getDb } from "@/lib/db/client";
import { isUuid } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /dashboard/binder/<id>/pdf — authenticated download of a READY binder. Tenant from the
// session only; another company's id (or one that is not ready) is a 404, not a 403.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireTenantRoute();
  if (!gate.ok) return gate.response;
  const { tenant, company } = gate.ctx;
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not Found", { status: 404 });
  const file = await getBinderFile(getDb(), tenant.companyId, id);
  if (!file) return new Response("Not Found", { status: 404 });
  return new Response(new Uint8Array(file.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(file.pdf.length),
      "Content-Disposition": `attachment; filename="${binderFilename(company.slug, file.asOf)}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
