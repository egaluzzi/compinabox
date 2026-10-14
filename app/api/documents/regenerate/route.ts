import { NextResponse } from "next/server";
import { getTenant } from "@/lib/auth/tenant";
import { getDb } from "@/lib/db/client";
import { isDocumentType } from "@/lib/documents/types";
import { regenerateDocuments } from "@/lib/documents/store";

export const runtime = "nodejs";

function back(request: Request, query: string) {
  const origin = new URL(process.env.APP_URL || request.url).origin;
  return NextResponse.redirect(`${origin}/dashboard/documents${query}`, 303);
}

// POST /api/documents/regenerate (form: type=<document type> | all). The company is the
// session's company; nothing about the tenant is read from the request.
export async function POST(request: Request) {
  const tenant = await getTenant();
  if (!tenant) return new Response("Unauthorized", { status: 401 });
  const form = await request.formData();
  const type = form.get("type");
  if (type !== "all" && !isDocumentType(type))
    return new Response("Bad Request", { status: 400 });
  const types = type === "all" || !isDocumentType(type) ? undefined : [type];

  try {
    const results = await regenerateDocuments(getDb(), tenant.companyId, {
      types,
      userId: tenant.userId,
    });
    const created = results.filter((r) => r.created).length;
    return back(
      request,
      `?regenerated=${created > 0 ? "created" : "unchanged"}`,
    );
  } catch (err) {
    console.error("documents/regenerate failed:", err);
    return back(request, "?error=1");
  }
}
