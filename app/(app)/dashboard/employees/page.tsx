import Link from "next/link";
import { requireTenant } from "@/lib/auth/require-tenant";
import { formatDate } from "@/lib/dashboard/format";
import { getDb } from "@/lib/db/client";
import { DOCUMENT_TYPES } from "@/lib/documents/types";
import { MAX_REPORTED_INVALID } from "@/lib/employee/constants";
import { exportRows, type Cell } from "@/lib/employee/export";
import { countPending } from "@/lib/employee/invites";
import { TYPE_KEY } from "@/lib/employee/labels";
import { computeCompletion, getRoster } from "@/lib/employee/roster";

const REASONS = [
  "columns",
  "name_empty",
  "name_long",
  "email_invalid",
] as const;
type Reason = (typeof REASONS)[number];
const FILE_ERRORS = [
  "too_large",
  "too_many_rows",
  "not_text",
  "empty",
  "bad_header",
  "unterminated_quote",
  "no_file",
] as const;
type FileError = (typeof FILE_ERRORS)[number];

type SP = {
  show?: string;
  imported?: string; // created.reactivated.skipped.invalid
  bad?: string; // line:reason,line:reason (no personal data)
  fileError?: string;
  invite?: string; // sent | failed | notconfigured
  batch?: string; // sent.failed.remaining
};

const nums = (v: string | undefined, n: number) => {
  const p = (v ?? "").split(".").map((x) => Number(x));
  return p.length === n && p.every((x) => Number.isInteger(x) && x >= 0)
    ? p
    : null;
};

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const { tenant, locale, t } = await requireTenant();
  const sp = await searchParams;
  const db = getDb();
  const showAll = sp.show === "deactivated";
  const roster = await getRoster(db, tenant.companyId, locale, {
    includeDeactivated: showAll,
  });
  const done = computeCompletion(roster); // deactivated employees never count
  const pending = await countPending(db, tenant.companyId);
  const rows = exportRows(roster);
  const imported = nums(sp.imported, 4);
  const batch = nums(sp.batch, 3);
  const bad = (sp.bad ?? "")
    .split(",")
    .slice(0, MAX_REPORTED_INVALID)
    .flatMap((x) => {
      const [line, reason] = x.split(":");
      return /^\d{1,6}$/.test(line ?? "") && REASONS.includes(reason as Reason)
        ? [{ line: Number(line), reason: reason as Reason }]
        : [];
    });
  const fileError = FILE_ERRORS.includes(sp.fileError as FileError)
    ? (sp.fileError as FileError)
    : null;

  const mark = (c: Cell) =>
    c.kind === "done"
      ? t("dashboard.employees.markDone", { date: formatDate(c.at!, locale) })
      : c.kind === "outdated"
        ? t("dashboard.employees.markOutdated")
        : c.kind === "unavailable"
          ? t("dashboard.employees.markUnavailable")
          : t("dashboard.employees.markPending");
  const btn = "rounded border border-slate-400 px-3 py-1 text-sm";
  const th = "px-2 py-2 text-left align-bottom font-medium";
  const td = "px-2 py-2 align-top";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("dashboard.nav.employees")}</h1>

      <section
        aria-labelledby="imp-h"
        className="space-y-2 rounded border border-slate-200 p-4"
      >
        <h2 id="imp-h" className="text-lg font-semibold">
          {t("dashboard.employees.importTitle")}
        </h2>
        <p className="text-sm text-slate-700">
          {t("dashboard.employees.importHelp")}
        </p>
        <form
          method="post"
          action="/dashboard/employees/import"
          encType="multipart/form-data"
          className="flex flex-wrap items-end gap-3"
        >
          <label className="text-sm font-medium">
            {t("dashboard.employees.importFile")}
            <input
              type="file"
              name="file"
              accept=".csv,text/csv,text/plain"
              required
              className="mt-1 block text-sm font-normal"
            />
          </label>
          <button className={btn}>
            {t("dashboard.employees.importButton")}
          </button>
        </form>
        {fileError && (
          <p role="alert" className="text-red-700">
            {t(`dashboard.employees.fileError.${fileError}`)}
          </p>
        )}
        {imported && (
          <div role="status" className="space-y-1">
            <p className="font-medium">
              {t("dashboard.employees.importResult", {
                created: imported[0],
                reactivated: imported[1],
                skipped: imported[2],
                invalid: imported[3],
              })}
            </p>
            {bad.length > 0 && (
              <ul className="list-disc pl-5 text-sm">
                {bad.map((b) => (
                  <li key={`${b.line}-${b.reason}`}>
                    {t("dashboard.employees.invalidLine", {
                      line: b.line,
                      reason: t(`dashboard.employees.reason.${b.reason}`),
                    })}
                  </li>
                ))}
                {imported[3] > bad.length && (
                  <li>
                    {t("dashboard.employees.invalidMore", {
                      count: imported[3] - bad.length,
                    })}
                  </li>
                )}
              </ul>
            )}
          </div>
        )}
      </section>

      {sp.invite === "sent" && (
        <p role="status">{t("dashboard.employees.inviteSent")}</p>
      )}
      {sp.invite === "failed" && (
        <p role="alert" className="text-red-700">
          {t("dashboard.employees.inviteFailed")}
        </p>
      )}
      {sp.invite === "notconfigured" && (
        <p role="alert" className="text-red-700">
          {t("dashboard.employees.emailNotConfigured")}
        </p>
      )}
      {batch && (
        <p role="status">
          {t("dashboard.employees.batchResult", {
            sent: batch[0],
            failed: batch[1],
            remaining: batch[2],
          })}
        </p>
      )}

      {rows.length === 0 ? (
        <div className="space-y-2 rounded border border-dashed border-slate-300 p-6">
          <p>{t("dashboard.employees.empty")}</p>
          {!showAll && (
            <Link
              className="text-sm underline"
              href="/dashboard/employees?show=deactivated"
            >
              {t("dashboard.employees.showDeactivated")}
            </Link>
          )}
        </div>
      ) : (
        <>
          <p className="font-medium" role="status">
            {done.percent === null
              ? t("dashboard.employees.summaryNone")
              : t("dashboard.employees.summary", {
                  percent: done.percent,
                  full: done.fullyComplete,
                  active: done.activeEmployees,
                })}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <form method="post" action="/dashboard/employees/invite-pending">
              <button className={btn} disabled={pending === 0}>
                {t("dashboard.employees.sendPending", { count: pending })}
              </button>
            </form>
            <Link
              className="text-sm underline"
              href={
                showAll
                  ? "/dashboard/employees"
                  : "/dashboard/employees?show=deactivated"
              }
            >
              {showAll
                ? t("dashboard.employees.hideDeactivated")
                : t("dashboard.employees.showDeactivated")}
            </Link>
            <a
              className="text-sm underline"
              href={`/dashboard/employees/export.csv${showAll ? "?show=deactivated" : ""}`}
            >
              {t("dashboard.employees.exportCsv")}
            </a>
            <a
              className="text-sm underline"
              href={`/dashboard/employees/export.pdf${showAll ? "?show=deactivated" : ""}`}
            >
              {t("dashboard.employees.exportPdf")}
            </a>
          </div>
          <p className="text-xs text-slate-600">
            {t("dashboard.employees.sendPendingHint")}
          </p>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className={th}>{t("dashboard.employees.colName")}</th>
                  <th className={th}>
                    {t("dashboard.employees.colInvitation")}
                  </th>
                  {DOCUMENT_TYPES.map((d) => (
                    <th
                      key={d}
                      className={th}
                      title={t(`documents.types.${TYPE_KEY[d]}`)}
                    >
                      {t(`dashboard.employees.docShort.${TYPE_KEY[d]}`)}
                    </th>
                  ))}
                  <th className={th}>{t("dashboard.employees.colTraining")}</th>
                  <th className={th}>
                    {t("dashboard.employees.colDisclosure")}
                  </th>
                  <th className={th}>{t("dashboard.employees.colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-200">
                    <td className={td}>
                      <Link
                        className="font-medium underline"
                        href={`/dashboard/employees/${r.id}`}
                      >
                        {r.name}
                      </Link>
                      <div className="text-xs text-slate-600">{r.email}</div>
                    </td>
                    <td className={td}>
                      {r.deactivated
                        ? t("dashboard.employees.deactivated")
                        : t(`dashboard.employees.invite.${r.invite}`)}
                    </td>
                    {r.docs.map((c, i) => (
                      <td key={i} className={td}>
                        {mark(c)}
                      </td>
                    ))}
                    <td className={td}>{mark(r.training)}</td>
                    <td className={td}>{mark(r.disclosure)}</td>
                    <td className={`${td} space-y-1`}>
                      {r.deactivated ? (
                        <form
                          method="post"
                          action={`/dashboard/employees/${r.id}/reactivate`}
                        >
                          <button className={btn}>
                            {t("dashboard.employees.reactivate")}
                          </button>
                        </form>
                      ) : (
                        <>
                          <form
                            method="post"
                            action={`/dashboard/employees/${r.id}/invite`}
                          >
                            <button className={btn}>
                              {r.invite === "not_invited"
                                ? t("dashboard.employees.sendInvite")
                                : t("dashboard.employees.resendInvite")}
                            </button>
                          </form>
                          <form
                            method="post"
                            action={`/dashboard/employees/${r.id}/deactivate`}
                          >
                            <button className={btn}>
                              {t("dashboard.employees.deactivate")}
                            </button>
                          </form>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
