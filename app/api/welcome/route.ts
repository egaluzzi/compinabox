import { NextResponse } from "next/server";
import { consumeWelcomeToken } from "@/lib/auth/links";
import { buildSessionCookie } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

// GET /api/welcome?token=… — the welcome email's single-use link (24 h). Sets the session cookie.
export async function GET(request: Request) {
  const origin = new URL(process.env.APP_URL || request.url).origin;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const user = token ? await consumeWelcomeToken(getDb(), token) : null;
  if (!user) return NextResponse.redirect(`${origin}/login?error=1`, 303);
  const c = await buildSessionCookie(user);
  const response = NextResponse.redirect(`${origin}/onboarding`, 303);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(c.name, c.value, c.options);
  return response;
}
