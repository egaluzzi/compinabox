import type { ReactNode } from "react";
import type { EmployeeContext } from "@/lib/employee/require-employee";

/** Page chrome for the signed-in portal: company, who is signed in, sign out (a POST). */
export function PortalShell({
  ctx,
  children,
}: {
  ctx: EmployeeContext;
  children: ReactNode;
}) {
  const { company, me, t } = ctx;
  return (
    <div className="min-h-screen text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
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
            <span className="truncate text-slate-700">{me.name}</span>
            <form method="post" action="/employee/api/sign-out">
              <button className="rounded border border-slate-400 px-3 py-1">
                {t("employee.signOut")}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        {children}
      </main>
      <footer className="mx-auto max-w-3xl px-4 pb-8 text-xs text-slate-600">
        {t("footer.disclaimer")}
      </footer>
    </div>
  );
}
