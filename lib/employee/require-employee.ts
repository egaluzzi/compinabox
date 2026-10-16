import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Country } from "@/lib/countries";
import { getDb } from "@/lib/db/client";
import { requestCookie } from "@/lib/http";
import { COUNTRY_LOCALE, getT, type Locale, type T } from "@/lib/i18n";
import { SESSION_COOKIE } from "./constants";
import {
  getPortalCompany,
  getPortalEmployee,
  type PortalEmployee,
} from "./session";

export type EmployeeContext = {
  me: PortalEmployee;
  company: NonNullable<Awaited<ReturnType<typeof getPortalCompany>>>;
  locale: Locale;
  t: T;
};

async function resolve(
  sessionToken: string | undefined,
): Promise<EmployeeContext | null> {
  const db = getDb();
  const me = await getPortalEmployee(db, sessionToken);
  if (!me) return null;
  const company = await getPortalCompany(db, me.companyId);
  if (!company) return null;
  const locale = COUNTRY_LOCALE[company.country as Country] ?? "en";
  return { me, company, locale, t: getT(locale) };
}

const loadFromCookies = cache(async () =>
  resolve((await cookies()).get(SESSION_COOKIE)?.value),
);

/** Locale for the root layout: the session's company when there is one (no gating), else null. */
export async function employeeLocale(): Promise<Locale | null> {
  return (await loadFromCookies())?.locale ?? null;
}

/** The friendly page every invalid/expired/signed-out situation lands on. */
export const LINK_INVALID_PATH = "/employee/link-invalid";

/**
 * THE gate for every page under app/employee (except the token-entry page and the friendly
 * page): a valid portal session or a redirect. Employee and company come from the session row
 * only — never from the URL, query or body. tests/employee-gate.test.ts fails if a page skips it.
 */
export async function requireEmployee(): Promise<EmployeeContext> {
  const ctx = await loadFromCookies();
  if (!ctx) redirect(LINK_INVALID_PATH);
  return ctx;
}

/** The same gate for route handlers under app/employee/api: 401 instead of a redirect. */
export async function requireEmployeeRoute(
  request: Request,
): Promise<
  { ok: true; ctx: EmployeeContext } | { ok: false; response: Response }
> {
  const ctx = await resolve(requestCookie(request, SESSION_COOKIE));
  if (!ctx)
    return {
      ok: false,
      response: new Response("Unauthorized", {
        status: 401,
        headers: PORTAL_HEADERS,
      }),
    };
  return { ok: true, ctx };
}

/** Same set next.config.ts applies to /employee pages; handlers set it themselves. */
export const PORTAL_HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
} as const;
