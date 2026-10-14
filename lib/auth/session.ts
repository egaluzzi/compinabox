import { encode } from "next-auth/jwt";

export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days (admins log in rarely; whistleblower data)

/** Auth.js picks the `__Secure-` cookie name when the public URL is https. */
export function sessionCookieName(authUrl = process.env.AUTH_URL): string {
  const secure = !!authUrl && authUrl.startsWith("https:");
  return `${secure ? "__Secure-" : ""}authjs.session-token`;
}

export type SessionUser = { id: string; email: string; companyId: string };

/** Builds the same JWT session cookie Auth.js would, for flows that verify identity themselves. */
export async function buildSessionCookie(user: SessionUser) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  const name = sessionCookieName();
  const value = await encode({
    token: {
      sub: user.id,
      email: user.email,
      userId: user.id,
      companyId: user.companyId,
      sat: Date.now(), // session issue time in ms; getTenant() compares it to users.sessions_valid_after
    },
    secret,
    salt: name,
    maxAge: SESSION_MAX_AGE,
  });
  return {
    name,
    value,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: name.startsWith("__Secure-"),
      maxAge: SESSION_MAX_AGE,
    },
  };
}
