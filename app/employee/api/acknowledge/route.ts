import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { acknowledge } from "@/lib/employee/acknowledge";
import { clientIp } from "@/lib/employee/client-ip";
import {
  PORTAL_HEADERS,
  requireEmployeeRoute,
} from "@/lib/employee/require-employee";
import { isUuid } from "@/lib/http";

export const runtime = "nodejs";

// POST /employee/api/acknowledge (form: documentId). Employee and company come from the session;
// the document id is only a lookup key combined with that company (another company's id -> 404).
// Idempotent. The client IP (Cloudflare header, lib/employee/client-ip.ts) is stored on the
// acknowledgment row and nowhere else.
export async function POST(request: Request) {
  const gate = await requireEmployeeRoute(request);
  if (!gate.ok) return gate.response;
  const { me } = gate.ctx;
  let documentId = "";
  try {
    const v = (await request.formData()).get("documentId");
    if (typeof v === "string") documentId = v;
  } catch {
    return new Response("Bad Request", {
      status: 400,
      headers: PORTAL_HEADERS,
    });
  }
  if (!isUuid(documentId))
    return new Response("Not Found", { status: 404, headers: PORTAL_HEADERS });
  const result = await acknowledge(getDb(), me, documentId, clientIp(request));
  if (result === "not_found")
    return new Response("Not Found", { status: 404, headers: PORTAL_HEADERS });
  const origin = new URL(process.env.APP_URL || request.url).origin;
  const to =
    result === "outdated" ? `/employee/documents/${documentId}` : "/employee";
  return NextResponse.redirect(`${origin}${to}`, {
    status: 303,
    headers: PORTAL_HEADERS,
  });
}
