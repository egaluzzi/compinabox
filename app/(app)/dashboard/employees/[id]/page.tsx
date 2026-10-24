import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth/require-tenant";
import { getDb } from "@/lib/db/client";
import { getEmployeeRecord } from "@/lib/employee/detail";
import { TYPE_KEY } from "@/lib/employee/labels";
import { isDocumentType } from "@/lib/documents/types";
import { isUuid } from "@/lib/http";

export default async function EmployeeDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenant, locale, t } = await requireTenant();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  // Another company's employee is indistinguishable from a missing one: 404, not 403.
  const rec = await getEmployeeRecord(getDb(), tenant.companyId, id);
  if (!rec) notFound();
  const dt = (d: Date) =>
    d.toLocaleString(locale, { timeZone: "America/Sao_Paulo" });
  const h2 = "text-lg font-semibold";
  return (
    <div className="space-y-6">
      <Link href="/dashboard/employees" className="text-sm underline">
        {t("dashboard.employees.back")}
      </Link>
      <h1 className="text-3xl font-bold">{rec.employee.name}</h1>
      <p className="text-slate-700">
        {rec.employee.email}
        {rec.employee.deactivatedAt &&
          ` · ${t("dashboard.employees.deactivated")}`}
      </p>

      <section className="space-y-2">
        <h2 className={h2}>{t("dashboard.employees.acksHeading")}</h2>
        {rec.acks.length === 0 ? (
          <p>{t("dashboard.employees.noAcks")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-left">
                  <th className="px-2 py-2">
                    {t("dashboard.employees.colDocument")}
                  </th>
                  <th className="px-2 py-2">
                    {t("dashboard.employees.colAccepted")}
                  </th>
                  <th className="px-2 py-2">
                    {t("dashboard.employees.colIp")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rec.acks.map((a) => (
                  <tr key={a.id} className="border-b border-slate-200">
                    <td className="px-2 py-2">
                      {isDocumentType(a.type)
                        ? t(`documents.types.${TYPE_KEY[a.type]}`)
                        : a.type}{" "}
                      · {t("documents.version", { n: a.version })}
                    </td>
                    <td className="px-2 py-2">{dt(a.acceptedAt)}</td>
                    <td className="px-2 py-2">
                      {a.ipAddress ?? t("dashboard.employees.noIp")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className={h2}>{t("dashboard.employees.trainingHeading")}</h2>
        <p>
          {rec.training
            ? t("dashboard.employees.trainingResult", {
                score: rec.training.score ?? 0,
                date: dt(rec.training.completedAt),
              })
            : t("dashboard.employees.trainingNone")}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>{t("dashboard.employees.disclosureHeading")}</h2>
        {rec.disclosures.length === 0 ? (
          <p>{t("dashboard.employees.disclosureNone")}</p>
        ) : (
          <ul className="space-y-3">
            {rec.disclosures.map((d) => (
              <li key={d.year} className="rounded border border-slate-200 p-3">
                <p className="text-sm font-medium">
                  {t("dashboard.employees.disclosureEntry", {
                    year: d.year,
                    date: dt(d.submittedAt),
                  })}
                </p>
                {d.content === null ? (
                  <p role="alert" className="text-red-700">
                    {t("dashboard.whistleblower.cannotDecrypt")}
                  </p>
                ) : d.content.hasConflict ? (
                  <>
                    <p className="font-medium">
                      {t("dashboard.employees.disclosureSomething")}
                    </p>
                    <p className="whitespace-pre-wrap">{d.content.details}</p>
                  </>
                ) : (
                  <p>{t("dashboard.employees.disclosureNothing")}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
