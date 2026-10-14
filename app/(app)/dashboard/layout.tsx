import type { ReactNode } from "react";
import { signOut } from "@/auth";
import { DashboardNav } from "@/components/DashboardNav";
import { requireTenant } from "@/lib/auth/require-tenant";
import { revokeSessions } from "@/lib/auth/tenant";
import { getDb } from "@/lib/db/client";
import { getTenantUser } from "@/lib/db/tenant";

async function signOutAction() {
  "use server";
  // Revoke server-side first: a copied cookie must stop working, not just this browser's. A
  // failed write throws, so sign-out never silently falls back to clearing only the cookie.
  // User and company come from the session (requireTenant), never from the request.
  const { tenant } = await requireTenant();
  await revokeSessions(getDb(), tenant);
  await signOut({ redirectTo: "/login" });
}

const SECTIONS = [
  ["", "overview"],
  ["/documents", "documents"],
  ["/employees", "employees"],
  ["/training", "training"],
  ["/whistleblower", "whistleblower"],
  ["/vendors", "vendors"],
  ["/billing", "billing"],
  ["/settings", "settings"],
] as const;

// The shell only. It is NOT the gate: Next does not re-run layouts on client navigation, so
// every page.tsx / route.ts under here calls requireTenant() itself.
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { tenant, company, t } = await requireTenant();
  const user = await getTenantUser(getDb(), tenant.companyId, tenant.userId);
  const items = SECTIONS.map(([path, key]) => ({
    href: `/dashboard${path}`,
    label: t(`dashboard.nav.${key}`),
  }));
  return (
    <div className="min-h-screen text-slate-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow"
      >
        {t("dashboard.skipToContent")}
      </a>
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {company.logoFile && (
              // eslint-disable-next-line @next/next/no-img-element -- served by our own /uploads route
              <img
                src={`/uploads/${company.logoFile}`}
                alt={t("dashboard.logoAlt", { name: company.name })}
                className="h-8 w-auto max-w-[8rem] object-contain"
              />
            )}
            <span className="truncate font-semibold">{company.name}</span>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {user && (
              <span className="truncate text-slate-700">
                {t("dashboard.signedInAs", { email: user.email })}
              </span>
            )}
            <form action={signOutAction}>
              <button className="rounded border border-slate-400 px-3 py-1">
                {t("dashboard.signOut")}
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row">
        <div className="md:w-52 md:shrink-0">
          <DashboardNav items={items} label={t("dashboard.navLabel")} />
        </div>
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
