import Link from "next/link";
import { CopyField } from "@/components/CopyField";
import { requireTenant } from "@/lib/auth/require-tenant";
import { formatDate } from "@/lib/dashboard/format";
import { getDb } from "@/lib/db/client";
import { OPEN_REPORT_STATUSES } from "@/lib/db/tenant";
import { isCategory, isStatus } from "@/lib/whistleblower/constants";
import { listReports } from "@/lib/whistleblower/queries";

export default async function Page() {
  const { tenant, company, locale, t } = await requireTenant();
  const rows = await listReports(getDb(), tenant.companyId);
  const base = new URL(process.env.APP_URL || "http://localhost:3000").origin;
  const channelUrl = `${base}/report/${company.slug}`;
  const open = (s: string) =>
    (OPEN_REPORT_STATUSES as readonly string[]).includes(s);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("dashboard.nav.whistleblower")}</h1>
      <section className="space-y-2 rounded border border-slate-200 p-4">
        <h2 className="text-lg font-semibold">
          {t("dashboard.whistleblower.channelTitle")}
        </h2>
        <p className="text-sm text-slate-700">
          {t("dashboard.whistleblower.channelHelp")}
        </p>
        <CopyField
          value={channelUrl}
          label={t("dashboard.whistleblower.channelLabel")}
          copy={t("dashboard.whistleblower.copy")}
          copied={t("dashboard.whistleblower.copied")}
        />
      </section>
      {rows.length === 0 ? (
        <p className="rounded border border-dashed border-slate-300 p-6 text-slate-800">
          {t("dashboard.whistleblower.empty")}
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-300">
              <th className="py-2 pr-4">
                {t("dashboard.whistleblower.colReceived")}
              </th>
              <th className="py-2 pr-4">
                {t("dashboard.whistleblower.colCategory")}
              </th>
              <th className="py-2 pr-4">
                {t("dashboard.whistleblower.colStatus")}
              </th>
              <th className="py-2">
                <span className="sr-only">
                  {t("dashboard.whistleblower.colAction")}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-200">
                <td className="py-2 pr-4">{formatDate(r.createdAt, locale)}</td>
                <td className="py-2 pr-4">
                  {isCategory(r.category)
                    ? t(`report.categories.${r.category}`)
                    : r.category}
                </td>
                <td
                  className={`py-2 pr-4 ${open(r.status) ? "font-bold" : "text-slate-600"}`}
                >
                  {isStatus(r.status)
                    ? t(`report.statuses.${r.status}`)
                    : r.status}
                </td>
                <td className="py-2">
                  <Link
                    className="underline"
                    href={`/dashboard/whistleblower/${r.id}`}
                  >
                    {t("dashboard.whistleblower.view")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
