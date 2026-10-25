import { requireTenantRoute } from "@/lib/auth/require-tenant";
import { recoverStuck } from "@/lib/binder/jobs";
import { getBinderMeta } from "@/lib/binder/queries";
import { getDb } from "@/lib/db/client";
import { isUuid, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /dashboard/binder/status?id=<binder id> — what the page polls. Another company's id is a 404.
export async function GET(request: Request) {
  const gate = await requireTenantRoute();
  if (!gate.ok) return gate.response;
  const companyId = gate.ctx.tenant.companyId;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!isUuid(id)) return new Response("Not Found", { status: 404 });
  const db = getDb();
  await recoverStuck(db, companyId);
  const b = await getBinderMeta(db, companyId, id);
  if (!b) return new Response("Not Found", { status: 404 });
  return json({
    id: b.id,
    status: b.status,
    errorCode: b.errorCode,
    sizeBytes: b.sizeBytes,
    pageCount: b.pageCount,
    sha256: b.sha256,
    asOf: b.asOf,
    finishedAt: b.finishedAt,
  });
}
