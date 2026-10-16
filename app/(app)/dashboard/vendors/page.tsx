import Link from "next/link";
import { requireTenant } from "@/lib/auth/require-tenant";
import { formatDate } from "@/lib/dashboard/format";
import { getDb } from "@/lib/db/client";
import { getScreeningProvider } from "@/lib/screening";
import {
  latestScreenings,
  listVendors,
  questionnaireState,
  type VendorFormError,
} from "@/lib/vendors/queries";

const FORM_ERRORS: VendorFormError[] = [
  "name_required",
  "name_long",
  "country_invalid",
  "tax_id_long",
  "contact_name_long",
  "email_invalid",
];
const SEND = [
  "sent",
  "failed",
  "notconfigured",
  "no_email",
  "archived",
] as const;
const SCREEN = [
  "cooldown",
  "cap",
  "archived",
  "unavailable",
  "no_match",
  "possible_match",
  "error",
] as const;

type SP = {
  show?: string;
  added?: string;
  error?: string;
  send?: string;
  screen?: string;
};

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const { tenant, locale, t } = await requireTenant();
  const sp = await searchParams;
  const db = getDb();
  const showArchived = sp.show === "archived";
  const [rows, latest] = await Promise.all([
    listVendors(db, tenant.companyId, { includeArchived: showArchived }),
    latestScreenings(db, tenant.companyId),
  ]);
  const provider = getScreeningProvider();
  const now = new Date();
  const sendMsg = SEND.find((x) => x === sp.send);
  const screenMsg = SCREEN.find((x) => x === sp.screen);
  const formError = FORM_ERRORS.find((e) => e === sp.error);
  const btn = "rounded border border-slate-400 px-3 py-1 text-sm";
  const th = "px-2 py-2 text-left align-bottom font-medium";
  const td = "px-2 py-2 align-top";
  const input = "mt-1 block w-full rounded border border-slate-400 px-3 py-2";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("dashboard.nav.vendors")}</h1>
      <p className="text-slate-700">{t("dashboard.vendors.intro")}</p>
      {!provider.available && (
        <p role="status" className="rounded border border-amber-400 p-3">
          {t("dashboard.vendors.screenUnavailable")}
        </p>
      )}

      {sp.added === "1" && (
        <p role="status" className="font-medium">
          {t("dashboard.vendors.added")}
        </p>
      )}
      {sendMsg && (
        <p role="status" className="font-medium">
          {t(`dashboard.vendors.sendResult.${sendMsg}`)}
        </p>
      )}
      {screenMsg && (
        <p role="status" className="font-medium">
          {t(`dashboard.vendors.screenResult.${screenMsg}`)}
        </p>
      )}

      <section
        aria-labelledby="add-h"
        className="space-y-2 rounded border border-slate-200 p-4"
      >
        <h2 id="add-h" className="text-lg font-semibold">
          {t("dashboard.vendors.action")}
        </h2>
        {formError && (
          <p role="alert" className="text-red-700">
            {t(`dashboard.vendors.formError.${formError}`)}
          </p>
        )}
        <form
          method="post"
          action="/dashboard/vendors/add"
          className="grid gap-3 sm:grid-cols-2"
        >
          <label className="text-sm font-medium sm:col-span-2">
            {t("dashboard.vendors.name")}
            <input name="name" required maxLength={200} className={input} />
          </label>
          <label className="text-sm font-medium">
            {t("dashboard.vendors.country")}
            <input name="country" maxLength={2} className={input} />
          </label>
          <label className="text-sm font-medium">
            {t("dashboard.vendors.taxId")}
            <input name="taxId" maxLength={60} className={input} />
          </label>
          <label className="text-sm font-medium">
            {t("dashboard.vendors.contactName")}
            <input name="contactName" maxLength={200} className={input} />
          </label>
          <label className="text-sm font-medium">
            {t("dashboard.vendors.contactEmail")}
            <input
              name="contactEmail"
              type="email"
              maxLength={254}
              className={input}
            />
          </label>
          <div className="sm:col-span-2">
            <button className={btn}>{t("dashboard.vendors.addButton")}</button>
          </div>
        </form>
      </section>

      <div>
        <Link
          href={
            showArchived
              ? "/dashboard/vendors"
              : "/dashboard/vendors?show=archived"
          }
          className="text-sm underline"
        >
          {showArchived
            ? t("dashboard.vendors.hideArchived")
            : t("dashboard.vendors.showArchived")}
        </Link>
      </div>

      {rows.length === 0 ? (
        <p>{t("dashboard.vendors.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-slate-300">
                <th className={th}>{t("dashboard.vendors.colName")}</th>
                <th className={th}>{t("dashboard.vendors.colCountry")}</th>
                <th className={th}>
                  {t("dashboard.vendors.colQuestionnaire")}
                </th>
                <th className={th}>{t("dashboard.vendors.colScreening")}</th>
                <th className={th}>{t("dashboard.vendors.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => {
                const q = questionnaireState(v, now);
                const s = latest.get(v.id);
                return (
                  <tr key={v.id} className="border-b border-slate-200">
                    <td className={td}>
                      <Link
                        href={`/dashboard/vendors/${v.id}`}
                        className="font-medium underline"
                      >
                        {v.name}
                      </Link>
                      {v.archivedAt && (
                        <span className="ml-2 text-slate-600">
                          ({t("dashboard.vendors.archivedBadge")})
                        </span>
                      )}
                    </td>
                    <td className={td}>
                      {v.country ?? t("dashboard.vendors.none")}
                    </td>
                    <td className={td}>
                      {q === "submitted"
                        ? t("dashboard.vendors.qState.submitted", {
                            date: formatDate(v.submittedAt!, locale),
                          })
                        : t(`dashboard.vendors.qState.${q}`)}
                    </td>
                    <td className={td}>
                      {s ? (
                        s.status === "no_match" ? (
                          t("dashboard.vendors.screenState.no_match", {
                            date: formatDate(s.screenedAt, locale),
                          })
                        ) : (
                          <>
                            {t(
                              `dashboard.vendors.screenState.${s.status as "possible_match" | "error"}`,
                            )}{" "}
                            <span className="text-slate-600">
                              (
                              {t("dashboard.vendors.onDate", {
                                date: formatDate(s.screenedAt, locale),
                              })}
                              )
                            </span>
                          </>
                        )
                      ) : (
                        t("dashboard.vendors.screenState.never")
                      )}
                    </td>
                    <td className={td}>
                      <div className="flex flex-wrap gap-2">
                        {!v.archivedAt &&
                          (v.contactEmail ? (
                            <form
                              method="post"
                              action={`/dashboard/vendors/${v.id}/send`}
                            >
                              <button className={btn}>
                                {q === "not_sent"
                                  ? t("dashboard.vendors.send")
                                  : t("dashboard.vendors.resend")}
                              </button>
                            </form>
                          ) : (
                            <span className="text-slate-600">
                              {t("dashboard.vendors.noEmail")}
                            </span>
                          ))}
                        <form
                          method="post"
                          action={`/dashboard/vendors/${v.id}/${v.archivedAt ? "unarchive" : "archive"}`}
                        >
                          <button className={btn}>
                            {v.archivedAt
                              ? t("dashboard.vendors.unarchive")
                              : t("dashboard.vendors.archive")}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
