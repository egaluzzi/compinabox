import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth/require-tenant";
import { formatDate } from "@/lib/dashboard/format";
import { getDb } from "@/lib/db/client";
import { isUuid } from "@/lib/http";
import {
  isCategory,
  isStatus,
  MAX_NOTE,
  REPORT_STATUSES,
} from "@/lib/whistleblower/constants";
import {
  getReport,
  listEvidence,
  listTimeline,
} from "@/lib/whistleblower/queries";

export default async function ReportDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { tenant, locale, t } = await requireTenant();
  const { id } = await params;
  const { error } = await searchParams;
  if (!isUuid(id)) notFound();
  const db = getDb();
  // Another company's report is indistinguishable from a missing one: 404, not 403.
  const report = await getReport(db, tenant.companyId, id);
  if (!report) notFound();
  const [evidence, timeline] = await Promise.all([
    listEvidence(db, tenant.companyId, id),
    listTimeline(db, tenant.companyId, id),
  ]);
  const status = (s: string | null) =>
    s && isStatus(s) ? t(`report.statuses.${s}`) : (s ?? "");
  const dt = (d: Date) =>
    d.toLocaleString(locale, { timeZone: "America/Sao_Paulo" });
  const cannot = t("dashboard.whistleblower.cannotDecrypt");

  return (
    <div className="space-y-6">
      <Link href="/dashboard/whistleblower" className="text-sm underline">
        {t("dashboard.whistleblower.back")}
      </Link>
      <h1 className="text-3xl font-bold">
        {isCategory(report.category)
          ? t(`report.categories.${report.category}`)
          : report.category}
      </h1>
      {error && (
        <p role="alert" className="text-red-700">
          {t("dashboard.whistleblower.error")}
        </p>
      )}
      <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium">
            {t("dashboard.whistleblower.colReceived")}
          </dt>
          <dd>{formatDate(report.createdAt, locale)}</dd>
        </div>
        <div>
          <dt className="font-medium">
            {t("dashboard.whistleblower.colStatus")}
          </dt>
          <dd>{status(report.status)}</dd>
        </div>
        <div>
          <dt className="font-medium">
            {t("dashboard.whistleblower.resolvedOn")}
          </dt>
          <dd>
            {report.resolvedAt ? formatDate(report.resolvedAt, locale) : "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium">
            {t("dashboard.whistleblower.contact")}
          </dt>
          <dd>
            {!report.hasContact
              ? t("dashboard.whistleblower.anonymous")
              : (report.contact ?? cannot)}
          </dd>
        </div>
      </dl>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">
          {t("dashboard.whistleblower.description")}
        </h2>
        {report.description === null ? (
          <p role="alert" className="text-red-700">
            {cannot}
          </p>
        ) : (
          <p className="whitespace-pre-wrap rounded border border-slate-200 p-4">
            {report.description}
          </p>
        )}
      </section>

      <form
        method="post"
        action={`/dashboard/whistleblower/${id}/status`}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="text-sm font-medium">
          {t("dashboard.whistleblower.changeStatus")}
          <select
            name="status"
            defaultValue={report.status}
            className="mt-1 block rounded border border-slate-400 px-3 py-2 font-normal"
          >
            {REPORT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`report.statuses.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded border border-slate-400 px-4 py-2 text-sm">
          {t("dashboard.whistleblower.apply")}
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">
          {t("dashboard.whistleblower.evidence")}
        </h2>
        {evidence.length === 0 ? (
          <p className="text-sm text-slate-700">
            {t("dashboard.whistleblower.evidenceNone")}
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {evidence.map((e, i) => (
              <li key={e.id}>
                <a
                  className="underline"
                  href={`/dashboard/whistleblower/${id}/evidence/${e.id}`}
                >
                  {t("dashboard.whistleblower.download", { n: i + 1 })}
                </a>{" "}
                <span className="text-slate-600">
                  ({e.contentType === "image/png" ? "PNG" : "JPEG"},{" "}
                  {Math.ceil(e.sizeBytes / 1024)} KB)
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          {t("dashboard.whistleblower.timeline")}
        </h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-slate-700">
            {t("dashboard.whistleblower.noNotes")}
          </p>
        ) : (
          <ol className="space-y-3">
            {timeline.map((n) => (
              <li
                key={n.id}
                className="rounded border border-slate-200 p-3 text-sm"
              >
                <p className="text-xs text-slate-600">
                  {dt(n.createdAt)}
                  {n.authorEmail ? ` · ${n.authorEmail}` : ""}
                </p>
                {n.kind === "status_change" ? (
                  <p>
                    {t("dashboard.whistleblower.statusMoved", {
                      from: status(n.fromStatus),
                      to: status(n.toStatus),
                    })}
                  </p>
                ) : n.body === null ? (
                  <p className="text-red-700">{cannot}</p>
                ) : (
                  <p className="whitespace-pre-wrap">{n.body}</p>
                )}
              </li>
            ))}
          </ol>
        )}
        <form
          method="post"
          action={`/dashboard/whistleblower/${id}/note`}
          className="space-y-2"
        >
          <label className="block text-sm font-medium">
            {t("dashboard.whistleblower.noteLabel")}
            <textarea
              name="body"
              required
              rows={4}
              maxLength={MAX_NOTE}
              className="mt-1 w-full rounded border border-slate-400 px-3 py-2 font-normal"
            />
          </label>
          <button className="rounded border border-slate-400 px-4 py-2 text-sm">
            {t("dashboard.whistleblower.addNote")}
          </button>
        </form>
      </section>
    </div>
  );
}
