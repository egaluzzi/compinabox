import { cache } from "react";
import { redirect } from "next/navigation";
import { getTenant, type Tenant } from "@/lib/auth/tenant";
import type { Country } from "@/lib/countries";
import { getDb } from "@/lib/db/client";
import { getCompany } from "@/lib/db/tenant";
import { COUNTRY_LOCALE, getT, type Locale, type T } from "@/lib/i18n";

type Company = NonNullable<Awaited<ReturnType<typeof getCompany>>>;
export type TenantContext = {
  tenant: Tenant;
  company: Company;
  locale: Locale;
  t: T;
};

type Loaded =
  | { state: "anonymous" }
  | { state: "onboarding"; ctx: TenantContext }
  | { state: "ready"; ctx: TenantContext };

/**
 * Session -> company, once per request (React `cache`). company_id comes ONLY from the signed
 * session via getTenant(); nothing here reads a request parameter.
 */
const load = cache(async (): Promise<Loaded> => {
  const tenant = await getTenant();
  if (!tenant) return { state: "anonymous" };
  const company = await getCompany(getDb(), tenant.companyId);
  if (!company) return { state: "anonymous" };
  const locale = COUNTRY_LOCALE[company.country as Country] ?? "en";
  const ctx = { tenant, company, locale, t: getT(locale) };
  return company.onboardingCompletedAt
    ? { state: "ready", ctx }
    : { state: "onboarding", ctx };
});

/**
 * THE gate for every dashboard page: valid session and completed onboarding, or a redirect.
 * Layouts do not re-run on client navigation, so every page.tsx calls this itself
 * (tests/dashboard-gate.test.ts fails if one does not). The dashboard's language is the
 * company's country locale, never the cookie.
 */
export async function requireTenant(): Promise<TenantContext> {
  const r = await load();
  if (r.state === "anonymous") redirect("/login");
  if (r.state === "onboarding") redirect("/onboarding");
  return r.ctx;
}

/** The same gate for route handlers: a status code instead of a redirect. */
export async function requireTenantRoute(): Promise<
  { ok: true; ctx: TenantContext } | { ok: false; response: Response }
> {
  const r = await load();
  if (r.state === "anonymous")
    return {
      ok: false,
      response: new Response("Unauthorized", { status: 401 }),
    };
  if (r.state === "onboarding")
    return { ok: false, response: new Response("Forbidden", { status: 403 }) };
  return { ok: true, ctx: r.ctx };
}

/** Locale for chrome around an authenticated page, without gating (used by the root layout). */
export async function sessionLocale(): Promise<Locale | null> {
  const r = await load();
  return r.state === "anonymous" ? null : r.ctx.locale;
}
