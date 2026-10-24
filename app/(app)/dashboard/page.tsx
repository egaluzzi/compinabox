import Link from "next/link";
import { requireTenant } from "@/lib/auth/require-tenant";
import { listBinders } from "@/lib/binder/queries";
import { companyCompletion } from "@/lib/dashboard/completion";
import { formatDate } from "@/lib/dashboard/format";
import { getDb } from "@/lib/db/client";
import { countEmployees, countOpenReports } from "@/lib/db/tenant";
import { parseDocument } from "@/lib/documents/generate";
import { listDocuments } from "@/lib/documents/store";
import { DOCUMENT_TYPES } from "@/lib/documents/types";

const SECTION_LINKS = [
  "documents",
  "employees",
  "training",
  "whistleblower",
  "vendors",
  "billing",
  "settings",
] as const;

export default async function Overview() {
  const { tenant, locale, t } = await requireTenant();
  const db = getDb();
  const [rows, employees, openCases] = await Promise.all([
    listDocuments(db, tenant.companyId),
    countEmployees(db, tenant.companyId),
    countOpenReports(db, tenant.companyId),
  ]);
  // Rows are ordered newest version first within a type: the first row per type is current.
  const current = DOCUMENT_TYPES.flatMap((type) => {
    const row = rows.find((r) => r.type === type);
    return row ? [row] : [];
  });
  const drafts = current.filter(
    (r) => parseDocument(r.content).reviewStatus === "draft",
  ).length;
  const completionInfo = await companyCompletion(db, tenant.companyId, locale);
  // latest binder state for the card (the PDF bytes are never loaded here)
  const binders = await listBinders(db, tenant.companyId, 10);
  const binder = {
    active: binders.some(
      (b) => b.status === "queued" || b.status === "running",
    ),
    ready: binders.find((b) => b.status === "ready"),
    failedLast: binders[0]?.status === "failed",
  };
  const completion = completionInfo.percent;

  const card = "rounded border border-slate-200 p-4";
  const label = "text-sm font-medium text-slate-700";
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("dashboard.overview.title")}</h1>
      <p className="text-slate-700">{t("dashboard.overview.intro")}</p>
      <ul className="grid gap-4 sm:grid-cols-2">
        <li className={card}>
          <h2 className={label}>{t("dashboard.overview.documents")}</h2>
          <p className="mt-1 text-2xl font-semibold">
            {t("dashboard.overview.documentsCount", {
              count: current.length,
              total: DOCUMENT_TYPES.length,
            })}
          </p>
          {drafts > 0 && (
            <p className="mt-1 text-sm font-semibold text-amber-800">
              {t("dashboard.overview.documentsDraft", { count: drafts })}
            </p>
          )}
        </li>
        <li className={card}>
          <h2 className={label}>{t("dashboard.overview.employees")}</h2>
          <p className="mt-1 text-2xl font-semibold">
            {t("dashboard.overview.employeesCount", { count: employees })}
          </p>
        </li>
        <li className={card}>
          <h2 className={label}>{t("dashboard.overview.openCases")}</h2>
          <p className="mt-1 text-2xl font-semibold">
            {t("dashboard.overview.openCasesCount", { count: openCases })}
          </p>
        </li>
        <li className={card}>
          <h2 className={label}>{t("dashboard.overview.completion")}</h2>
          <p className="mt-1 text-2xl font-semibold">
            {completion === null ? "—" : `${completion}%`}
          </p>
          {completion === null ? (
            <p className="mt-1 text-sm text-slate-600">
              {t("dashboard.overview.completionNote")}
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-600">
              {t("dashboard.overview.completionDetail", {
                full: completionInfo.fullyComplete,
                active: completionInfo.activeEmployees,
              })}
            </p>
          )}
        </li>
        <li className={`${card} sm:col-span-2`}>
          <h2 className={label}>{t("dashboard.overview.binder")}</h2>
          <p className="mt-1 text-sm text-slate-700">
            {binder.active
              ? t("dashboard.overview.binderActive")
              : binder.ready
                ? t("dashboard.overview.binderReady", {
                    date: formatDate(
                      binder.ready.asOf ?? binder.ready.createdAt,
                      locale,
                    ),
                  })
                : binder.failedLast
                  ? t("dashboard.overview.binderFailed")
                  : t("dashboard.overview.binderNone")}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <Link className="underline" href="/dashboard/binder">
              {t("dashboard.overview.binderOpen")}
            </Link>
            {binder.ready && (
              <a
                className="underline"
                href={`/dashboard/binder/${binder.ready.id}/pdf`}
              >
                {t("dashboard.overview.binderDownload")}
              </a>
            )}
          </div>
        </li>
      </ul>
      <section aria-labelledby="sections-h" className="space-y-2">
        <h2 id="sections-h" className="text-lg font-semibold">
          {t("dashboard.overview.sections")}
        </h2>
        <ul className="flex flex-wrap gap-x-5 gap-y-1">
          {SECTION_LINKS.map((key) => (
            <li key={key}>
              <Link className="underline" href={`/dashboard/${key}`}>
                {t(`dashboard.nav.${key}`)}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
