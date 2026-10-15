import { requireTenantRoute } from "@/lib/auth/require-tenant";
import { getDb } from "@/lib/db/client";
import { isUuid } from "@/lib/http";
import { readEvidenceFile } from "@/lib/whistleblower/evidence";
import { getEvidence } from "@/lib/whistleblower/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The ONLY way an evidence file leaves the server: tenant from the session, 404 across tenants,
// decrypted on the fly, sent as an attachment with the type we sniffed at upload.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; evidenceId: string }> },
) {
  const gate = await requireTenantRoute();
  if (!gate.ok) return gate.response;
  const { tenant } = gate.ctx;
  const { id, evidenceId } = await ctx.params;
  if (!isUuid(id) || !isUuid(evidenceId))
    return new Response("Not Found", { status: 404 });
  const row = await getEvidence(getDb(), tenant.companyId, id, evidenceId);
  if (!row) return new Response("Not Found", { status: 404 });
  let bytes: Buffer | null = null;
  try {
    bytes = await readEvidenceFile(tenant.companyId, row.id, row.fileName);
  } catch {
    return new Response("Cannot decrypt", { status: 500 });
  }
  if (!bytes) return new Response("Not Found", { status: 404 });
  const ext = row.contentType === "image/png" ? "png" : "jpg";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": row.contentType,
      "Content-Disposition": `attachment; filename="evidence-${row.id.slice(0, 8)}.${ext}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
