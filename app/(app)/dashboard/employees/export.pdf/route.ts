import { requireTenantRoute } from "@/lib/auth/require-tenant";
import { getDb } from "@/lib/db/client";
import { loadLogo } from "@/lib/documents/pdf";
import { computeCompletion, getRoster } from "@/lib/employee/roster";
import { renderRosterPdf } from "@/lib/employee/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /dashboard/employees/export.pdf[?show=deactivated] — same rows as the grid, in the style of
// the phase 3 documents. No IP address and no disclosure content.
export async function GET(request: Request) {
  const gate = await requireTenantRoute();
  if (!gate.ok) return gate.response;
  const { tenant, company, locale, t } = gate.ctx;
  const all = new URL(request.url).searchParams.get("show") === "deactivated";
  const roster = await getRoster(getDb(), tenant.companyId, locale, {
    includeDeactivated: all,
  });
  const c = computeCompletion(roster);
  const pdf = await renderRosterPdf(roster, locale, {
    companyName: company.name,
    generatedAt: new Date(),
    logo: await loadLogo(company.logoFile),
    summary:
      c.percent === null
        ? t("dashboard.employees.summaryNone")
        : t("dashboard.employees.summary", {
            percent: c.percent,
            full: c.fullyComplete,
            active: c.activeEmployees,
          }),
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="employees-status.pdf"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
