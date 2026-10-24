import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth/require-tenant";
import { getDb } from "@/lib/db/client";
import { isUuid } from "@/lib/http";
import { getScreeningProvider } from "@/lib/screening";
import { decryptAnswers } from "@/lib/vendors/answers";
import { getVendorDetail, questionnaireState } from "@/lib/vendors/queries";

const SCREEN = [
  "cooldown",
  "cap",
  "archived",
  "unavailable",
  "no_match",
  "possible_match",
  "error",
] as const;

export default async function VendorDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ screen?: string }>;
}) {
  const { tenant, locale, t } = await requireTenant();
  const { id } = await params;
  const sp = await searchParams;
  if (!isUuid(id)) notFound();
  // Another company's vendor is indistinguishable from a missing one: 404, not 403.
  const rec = await getVendorDetail(getDb(), tenant.companyId, id);
  if (!rec) notFound();
  const { vendor: v, responses, screenings } = rec;
  const provider = getScreeningProvider();
  const dt = (d: Date) =>
    d.toLocaleString(locale, { timeZone: "America/Sao_Paulo" });
  const day = (d: Date) =>
    d.toLocaleDateString(locale, { timeZone: "America/Sao_Paulo" });
  const q = questionnaireState(v);
  const screenMsg = SCREEN.find((x) => x === sp.screen);
  const h2 = "text-lg font-semibold";
  const yn = (b: boolean) =>
    t(b ? "dashboard.vendors.yes" : "dashboard.vendors.no");
  const btn = "rounded border border-slate-400 px-3 py-1 text-sm";
  const latest = screenings[0];

  const answer = (r: (typeof responses)[number]) => {
    const a = decryptAnswers(tenant.companyId, r);
    return (
      <div key={r.id} className="space-y-1 rounded border border-slate-200 p-3">
        <p className="text-sm text-slate-700">
          {t("dashboard.vendors.answeredOn", { date: dt(r.submittedAt) })}
        </p>
        {a ? (
          <dl className="space-y-2">
            <div>
              <dt className="font-medium">
                {t("dashboard.vendors.respondent")}
              </dt>
              <dd>
                {a.respondentName} — {a.respondentRole}
              </dd>
            </div>
            <div>
              <dt className="font-medium">
                {t("dashboard.vendors.ownership")}
              </dt>
              <dd className="whitespace-pre-wrap">{a.ownershipText}</dd>
            </div>
            <div>
              <dt className="font-medium">{t("dashboard.vendors.pep")}</dt>
              <dd>
                {yn(r.pepExposure)}
                {a.pepDetails && (
                  <span className="block whitespace-pre-wrap">
                    {a.pepDetails}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="font-medium">
                {t("dashboard.vendors.sanctions")}
              </dt>
              <dd>
                {yn(r.priorSanctions)}
                {a.sanctionsDetails && (
                  <span className="block whitespace-pre-wrap">
                    {a.sanctionsDetails}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="font-medium">
                {t("dashboard.vendors.antibribery")}
              </dt>
              <dd>{yn(r.antibriberyPolicy)}</dd>
            </div>
          </dl>
        ) : (
          <p role="alert" className="text-red-700">
            {t("dashboard.vendors.cannotDecrypt")}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Link href="/dashboard/vendors" className="text-sm underline">
        {t("dashboard.vendors.back")}
      </Link>
      <h1 className="text-3xl font-bold">
        {v.name}
        {v.archivedAt && (
          <span className="ml-2 text-base font-normal text-slate-600">
            ({t("dashboard.vendors.archivedBadge")})
          </span>
        )}
      </h1>
      {screenMsg && (
        <p role="status" className="font-medium">
          {t(`dashboard.vendors.screenResult.${screenMsg}`)}
        </p>
      )}

      <section className="space-y-1">
        <h2 className={h2}>{t("dashboard.vendors.profile")}</h2>
        <p>
          {t("dashboard.vendors.colCountry")}:{" "}
          {v.country ?? t("dashboard.vendors.none")}
        </p>
        <p>
          {t("dashboard.vendors.taxId")}:{" "}
          {v.taxId ?? t("dashboard.vendors.none")}
        </p>
        <p>
          {t("dashboard.vendors.contactName")}:{" "}
          {v.contactName ?? t("dashboard.vendors.none")}
        </p>
        <p>
          {t("dashboard.vendors.contactEmail")}:{" "}
          {v.contactEmail ?? t("dashboard.vendors.none")}
        </p>
        <p>
          {t("dashboard.vendors.colQuestionnaire")}:{" "}
          {q === "submitted"
            ? t("dashboard.vendors.qState.submitted", {
                date: day(v.submittedAt!),
              })
            : t(`dashboard.vendors.qState.${q}`)}
        </p>
        {!v.archivedAt && v.contactEmail && (
          <form method="post" action={`/dashboard/vendors/${v.id}/send`}>
            <button className={btn}>
              {q === "not_sent"
                ? t("dashboard.vendors.send")
                : t("dashboard.vendors.resend")}
            </button>
          </form>
        )}
      </section>

      <section className="space-y-2">
        <h2 className={h2}>{t("dashboard.vendors.answersHeading")}</h2>
        {responses.length === 0 ? (
          <p>{t("dashboard.vendors.noAnswers")}</p>
        ) : (
          <>
            <h3 className="font-medium">
              {t("dashboard.vendors.latestAnswer")}
            </h3>
            {answer(responses[0])}
            {responses.length > 1 && (
              <>
                <h3 className="font-medium">
                  {t("dashboard.vendors.olderAnswers")}
                </h3>
                {responses.slice(1).map(answer)}
              </>
            )}
          </>
        )}
      </section>

      <section className="space-y-2">
        <h2 className={h2}>{t("dashboard.vendors.screeningsHeading")}</h2>
        <p className="text-sm text-slate-700">
          {t("dashboard.vendors.disclaimer", {
            dataset: latest?.dataset ?? provider.dataset,
          })}
        </p>
        {!provider.available ? (
          <p role="status">{t("dashboard.vendors.screenUnavailable")}</p>
        ) : (
          !v.archivedAt && (
            <form method="post" action={`/dashboard/vendors/${v.id}/screen`}>
              <button className={btn}>
                {latest
                  ? t("dashboard.vendors.rescreen")
                  : t("dashboard.vendors.screen")}
              </button>
            </form>
          )
        )}
        {screenings.length === 0 ? (
          <p>{t("dashboard.vendors.noScreenings")}</p>
        ) : (
          <ul className="space-y-3">
            {screenings.map((s) => (
              <li
                key={s.id}
                className="space-y-1 rounded border border-slate-200 p-3"
              >
                <p className="text-sm text-slate-700">
                  {t("dashboard.vendors.screeningMeta", {
                    date: dt(s.screenedAt),
                    dataset: s.dataset,
                    name: s.nameScreened,
                  })}
                </p>
                <p className="font-medium">
                  {s.status === "no_match"
                    ? t("dashboard.vendors.screenState.no_match", {
                        date: day(s.screenedAt),
                      })
                    : t(
                        `dashboard.vendors.screenState.${s.status as "possible_match" | "error"}`,
                      )}
                </p>
                {s.status === "error" && s.errorCode && (
                  <p className="text-sm">
                    {t("dashboard.vendors.errorCode", { code: s.errorCode })}
                  </p>
                )}
                {s.matches.length > 0 && (
                  <>
                    <p className="text-sm text-slate-700">
                      {t("dashboard.vendors.matchesNote")}
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      {s.matches.map((m) => (
                        <li key={m.id}>
                          {t("dashboard.vendors.matchLine", {
                            caption: m.caption,
                            score: Math.round(m.score * 100),
                            datasets: m.datasets.join(", ") || "—",
                            topics: m.topics.join(", ") || "—",
                          })}
                          <br />
                          <span className="text-slate-600">
                            {t("dashboard.vendors.entityId", { id: m.id })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
