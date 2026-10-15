import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { isHttpsApp } from "@/lib/http";
import { SESSION_COOKIE, SESSION_COOKIE_PATH } from "@/lib/employee/constants";
import {
  LINK_INVALID_PATH,
  PORTAL_HEADERS,
  requireEmployeeRoute,
} from "@/lib/employee/require-employee";
import { endSession } from "@/lib/employee/session";

export const runtime = "nodejs";

// POST /employee/api/sign-out: deletes the session row (so a copied cookie dies too) and clears
// the cookie. The session id comes from the session itself.
export async function POST(request: Request) {
  const gate = await requireEmployeeRoute(request);
  if (!gate.ok) return gate.response;
  await endSession(getDb(), gate.ctx.me);
  const res = NextResponse.redirect(
    `${new URL(process.env.APP_URL || request.url).origin}${LINK_INVALID_PATH}`,
    { status: 303, headers: PORTAL_HEADERS },
  );
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttpsApp(),
    path: SESSION_COOKIE_PATH,
    maxAge: 0,
  });
  return res;
}
