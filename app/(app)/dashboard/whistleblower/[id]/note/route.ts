import { NextResponse } from "next/server";
import { requireTenantRoute } from "@/lib/auth/require-tenant";
import { getDb } from "@/lib/db/client";
import { isUuid } from "@/lib/http";
import { MAX_NOTE } from "@/lib/whistleblower/constants";
import { addNote } from "@/lib/whistleblower/queries";

export const runtime = "nodejs";

// POST /dashboard/whistleblower/<id>/note (form: body). Appends an encrypted note.
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireTenantRoute();
  if (!gate.ok) return gate.response;
  const { tenant } = gate.ctx;
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not Found", { status: 404 });
  const body = String((await request.formData()).get("body") ?? "");
  const origin = new URL(process.env.APP_URL || request.url).origin;
  const ok = await addNote(getDb(), tenant, id, body);
  if (!ok) {
    // A foreign/unknown report is a 404; an empty or oversize note goes back to the form.
    const valid = body.trim().length > 0 && body.trim().length <= MAX_NOTE;
    if (valid) return new Response("Not Found", { status: 404 });
    return NextResponse.redirect(
      `${origin}/dashboard/whistleblower/${id}?error=1`,
      303,
    );
  }
  return NextResponse.redirect(`${origin}/dashboard/whistleblower/${id}`, 303);
}
