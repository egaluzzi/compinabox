import { getTenant } from "@/lib/auth/tenant";
import { getDb } from "@/lib/db/client";
import { getCompany } from "@/lib/db/tenant";
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
  const tenant = await getTenant();
  if (!tenant) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not Found", { status: 404 });
  const db = getDb();
  const doc = await getDocument(db, tenant.companyId, id);
  const company = await getCompany(db, tenant.companyId);
  if (!doc || !company) return new Response("Not Found", { status: 404 });

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
