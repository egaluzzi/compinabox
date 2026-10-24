import { requireTenant } from "@/lib/auth/require-tenant";
import { BinderPoller } from "@/components/BinderPoller";
import {
  BINDER_DAILY_CAP,
  BINDER_ERROR_CODES,
  binderAvailable,
  type BinderErrorCode,
} from "@/lib/binder/constants";
import { recoverStuck } from "@/lib/binder/jobs";
import { listBinders } from "@/lib/binder/queries";
import { DISPLAY_TZ } from "@/lib/dashboard/format";
import { getDb } from "@/lib/db/client";

const FLASH = [
  "started",
  "existing",
  "cooldown",
  "cap",
  "unavailable",
] as const;

const fmtSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default async function BinderPage({
  searchParams,
}: {
  searchParams: Promise<{ generate?: string }>;
}) {
  const { tenant, locale, t } = await requireTenant();
  const sp = await searchParams;
  const db = getDb();
  await recoverStuck(db, tenant.companyId);
  const rows = await listBinders(db, tenant.companyId);
  const active = rows.find(
    (r) => r.status === "queued" || r.status === "running",
  );
  const flash = FLASH.find((f) => f === sp.generate);
  const available = binderAvailable(locale);
  const when = (d: Date) =>
    d.toLocaleString(locale, {
      timeZone: DISPLAY_TZ,
      dateStyle: "short",
      timeStyle: "short",
    });
  const errorText = (code: string | null) =>
    BINDER_ERROR_CODES.includes(code as BinderErrorCode)
      ? t(`dashboard.binder.error.${code as BinderErrorCode}`)
      : null;
  const th = "px-2 py-2 text-left align-bottom font-medium";
  const td = "px-2 py-2 align-top";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("dashboard.binder.title")}</h1>
      <p className="text-slate-700">{t("dashboard.binder.intro")}</p>

      {flash && (
        <p role="status" className="font-medium">
          {flash === "cap"
            ? t("dashboard.binder.flash.cap", { cap: BINDER_DAILY_CAP })
            : t(`dashboard.binder.flash.${flash}`)}
        </p>
      )}

      {!available ? (
        <p className="rounded border border-dashed border-slate-300 p-6">
          {t("dashboard.binder.unavailable")}
        </p>
      ) : active ? (
        <section
          aria-labelledby="current-h"
          className="space-y-2 rounded border border-slate-200 p-4"
        >
          <h2 id="current-h" className="text-lg font-semibold">
            {t("dashboard.binder.current")}
          </h2>
          <p role="status" className="font-medium">
            {t(
              `dashboard.binder.status.${active.status as "queued" | "running"}`,
            )}{" "}
            · {when(active.createdAt)}
          </p>
          <p className="text-sm text-slate-700">
            {t("dashboard.binder.refreshHint")}
          </p>
          <a className="text-sm underline" href="/dashboard/binder">
            {t("dashboard.binder.refresh")}
          </a>
          <BinderPoller id={active.id} />
        </section>
      ) : (
        <form
          method="post"
          action="/dashboard/binder/generate"
          className="space-y-3 rounded border border-slate-200 p-4"
        >
          <p className="font-medium">{t("dashboard.binder.notice")}</p>
          <p className="text-sm text-slate-700">
            {t("dashboard.binder.excluded")}
          </p>
          <p className="text-sm font-semibold text-amber-800">
            {t("dashboard.binder.draftWarning")}
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="stats" className="mt-1" />
            <span>{t("dashboard.binder.statsLabel")}</span>
          </label>
          <button className="rounded border border-slate-400 px-3 py-1 text-sm">
            {t("dashboard.binder.generate")}
          </button>
        </form>
      )}

      <section aria-labelledby="prev-h" className="space-y-2">
        <h2 id="prev-h" className="text-lg font-semibold">
          {t("dashboard.binder.previous")}
        </h2>
        {rows.length === 0 ? (
          <p>{t("dashboard.binder.empty")}</p>
        ) : (
          <>
            <p className="text-sm text-slate-700">
              {t("dashboard.binder.hashHelp")}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className={th}>{t("dashboard.binder.colDate")}</th>
                    <th className={th}>{t("dashboard.binder.colStatus")}</th>
                    <th className={th}>{t("dashboard.binder.colSize")}</th>
                    <th className={th}>{t("dashboard.binder.colPages")}</th>
                    <th className={th}>{t("dashboard.binder.colHash")}</th>
                    <th className={th}>{t("dashboard.binder.colDownload")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <tr key={b.id} className="border-b border-slate-200">
                      <td className={td}>
                        {when(b.asOf ?? b.createdAt)}
                        {b.options.includeChannelStats && (
                          <span className="block text-xs text-slate-600">
                            {t("dashboard.binder.withStats")}
                          </span>
                        )}
                      </td>
                      <td className={td}>
                        {t(
                          `dashboard.binder.status.${b.status as "queued" | "running" | "ready" | "failed"}`,
                        )}
                        {b.status === "failed" && errorText(b.errorCode) && (
                          <span className="block text-xs text-slate-600">
                            {errorText(b.errorCode)}
                          </span>
                        )}
                      </td>
                      <td className={td}>
                        {b.sizeBytes ? fmtSize(b.sizeBytes) : "—"}
                      </td>
                      <td className={td}>{b.pageCount ?? "—"}</td>
                      <td
                        className={`${td} max-w-[16rem] break-all font-mono text-xs`}
                      >
                        {b.sha256 ?? "—"}
                      </td>
                      <td className={td}>
                        {b.status === "ready" ? (
                          <a
                            className="underline"
                            href={`/dashboard/binder/${b.id}/pdf`}
                          >
                            {t("dashboard.binder.download")}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
