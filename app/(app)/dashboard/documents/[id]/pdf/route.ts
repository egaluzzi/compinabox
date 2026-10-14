import { requireTenantRoute } from "@/lib/auth/require-tenant";
import { getDb } from "@/lib/db/client";
import { loadLogo, pdfFilename, renderDocumentPdf } from "@/lib/documents/pdf";
import { getDocument } from "@/lib/documents/store";
import { isUuid } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tenant from the session only; another company's document id is a 404, not a 403.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireTenantRoute();
  if (!gate.ok) return gate.response;
  const { tenant, company } = gate.ctx;
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not Found", { status: 404 });
  const doc = await getDocument(getDb(), tenant.companyId, id);
  if (!doc) return new Response("Not Found", { status: 404 });

  const pdf = await renderDocumentPdf(doc.content, {
    version: doc.version,
    generatedAt: doc.generatedAt,
    logo: await loadLogo(company.logoFile),
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdfFilename(doc.type, doc.version)}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
