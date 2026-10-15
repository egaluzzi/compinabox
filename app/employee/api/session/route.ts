import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { isHttpsApp } from "@/lib/http";
import {
  LINK_INVALID_PATH,
  PORTAL_HEADERS,
} from "@/lib/employee/require-employee";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_PATH,
  SESSION_TTL_MS,
} from "@/lib/employee/constants";
import { startSession } from "@/lib/employee/session";

export const runtime = "nodejs";

const origin = (request: Request) =>
  new URL(process.env.APP_URL || request.url).origin;

// POST /employee/api/session (form: token) — the Start button. The ONLY handler under
// app/employee that does not use the portal session gate: it is how a session is obtained. The
// link is consumed by one atomic UPDATE ... RETURNING (lib/employee/session.ts), so two
// concurrent POSTs cannot both win. Every failure is the same 303 to the same friendly page.
export async function POST(request: Request) {
  let token = "";
  try {
    const v = (await request.formData()).get("token");
    if (typeof v === "string") token = v;
  } catch {
    // not a form: treated as an empty token below
  }
  const started = await startSession(getDb(), token);
  if (!started)
    return NextResponse.redirect(`${origin(request)}${LINK_INVALID_PATH}`, {
      status: 303,
      headers: PORTAL_HEADERS,
    });
  const res = NextResponse.redirect(`${origin(request)}/employee`, {
    status: 303,
    headers: PORTAL_HEADERS,
  });
  res.cookies.set(SESSION_COOKIE, started.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttpsApp(),
    path: SESSION_COOKIE_PATH,
    maxAge: SESSION_TTL_MS / 1000,
  });
  return res;
}
