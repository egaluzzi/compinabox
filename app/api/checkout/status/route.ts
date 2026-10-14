import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { buildSessionCookie } from "@/lib/auth/session";
import { RETURN_COOKIE, readReturnState } from "@/lib/checkout/return";
import { getDb } from "@/lib/db/client";
import { checkoutAttempt } from "@/lib/db/schema";
import { json, requestCookie } from "@/lib/http";

// GET /api/checkout/status?attempt=<id> — polled by /checkout/return. Read-only with respect to
// provisioning; may issue the session once for the browser that holds the return token.
export async function GET(request: Request) {
  const attemptId = new URL(request.url).searchParams.get("attempt") ?? "";
  const db = getDb();
  const state = await readReturnState(
    db,
    attemptId,
    requestCookie(request, RETURN_COOKIE),
  );
  if (state.status === "unknown") return json({ status: "unknown" }, 404);

  const [row] = await db
    .select({ country: checkoutAttempt.country })
    .from(checkoutAttempt)
    .where(eq(checkoutAttempt.id, attemptId));
  const response = NextResponse.json(
    { status: state.status, country: row?.country, signedIn: !!state.user },
    { headers: { "Cache-Control": "no-store" } },
  );
  if (state.user) {
    const c = await buildSessionCookie(state.user);
    response.cookies.set(c.name, c.value, c.options);
    response.cookies.set(RETURN_COOKIE, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
    });
  }
  return response;
}
