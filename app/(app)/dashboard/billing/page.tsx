import { requireTenant } from "@/lib/auth/require-tenant";
import { formatDate, formatMoney } from "@/lib/dashboard/format";
import { getDb } from "@/lib/db/client";
import { getBillingRecords } from "@/lib/db/tenant";

const KNOWN_SUBSCRIPTION = ["active"] as const;

export default async function Billing() {
  const { tenant, company, locale, t } = await requireTenant();
  const records = await getBillingRecords(getDb(), tenant.companyId);
  const status = (KNOWN_SUBSCRIPTION as readonly string[]).includes(
    company.subscriptionStatus,
  )
    ? t(
        `dashboard.billing.subscription.${company.subscriptionStatus as (typeof KNOWN_SUBSCRIPTION)[number]}`,
      )
    : company.subscriptionStatus;
  const th = "px-3 py-2 text-left font-medium";
  const td = "px-3 py-2";
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("dashboard.nav.billing")}</h1>
      <p>
        <span className="font-medium">
          {t("dashboard.billing.subscriptionLabel")}:
        </span>{" "}
        {status}
      </p>
      <section aria-labelledby="payments-h" className="space-y-2">
        <h2 id="payments-h" className="text-lg font-semibold">
          {t("dashboard.billing.history")}
        </h2>
        {records.length === 0 ? (
          <p className="text-slate-700">{t("dashboard.billing.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[20rem] text-sm">
              <thead className="border-b border-slate-300">
                <tr>
                  <th scope="col" className={th}>
                    {t("dashboard.billing.date")}
                  </th>
                  <th scope="col" className={th}>
                    {t("dashboard.billing.amount")}
                  </th>
                  <th scope="col" className={th}>
                    {t("dashboard.billing.status")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className={td}>{formatDate(r.paidAt, locale)}</td>
                    <td className={td}>
                      {formatMoney(r.amountCents, r.currency, locale)}
                    </td>
                    <td className={td}>{t("dashboard.billing.paid")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
