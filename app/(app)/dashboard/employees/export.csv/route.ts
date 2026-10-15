import { requireTenantRoute } from "@/lib/auth/require-tenant";
import { getDb } from "@/lib/db/client";
import { rosterCsv } from "@/lib/employee/export";
import { getRoster } from "@/lib/employee/roster";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /dashboard/employees/export.csv[?show=deactivated] — the roster status, the same rows and
// marks as the grid. No IP address and no disclosure content. Formula-injection safe.
export async function GET(request: Request) {
  const gate = await requireTenantRoute();
  if (!gate.ok) return gate.response;
  const { tenant, locale } = gate.ctx;
  const all = new URL(request.url).searchParams.get("show") === "deactivated";
  const roster = await getRoster(getDb(), tenant.companyId, locale, {
    includeDeactivated: all,
  });
  return new Response("﻿" + rosterCsv(roster, locale), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="employees-status.csv"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
