import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { parseDisclosure, submitDisclosure } from "@/lib/employee/disclosure";
import {
  PORTAL_HEADERS,
  requireEmployeeRoute,
} from "@/lib/employee/require-employee";

export const runtime = "nodejs";

// POST /employee/api/disclosure (form: choice none|some, details). One per employee per UTC
// calendar year; the content is encrypted before it is stored. Employee and company are the
// session's.
export async function POST(request: Request) {
  const gate = await requireEmployeeRoute(request);
  if (!gate.ok) return gate.response;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response("Bad Request", {
      status: 400,
      headers: PORTAL_HEADERS,
    });
  }
  const origin = new URL(process.env.APP_URL || request.url).origin;
  const back = (result: string) =>
    NextResponse.redirect(`${origin}/employee/disclosure?result=${result}`, {
      status: 303,
      headers: PORTAL_HEADERS,
    });
  const input = parseDisclosure(form.get("choice"), form.get("details"));
  if (!input) return back("invalid");
  const result = await submitDisclosure(getDb(), gate.ctx.me, input);
  return back(result);
}
