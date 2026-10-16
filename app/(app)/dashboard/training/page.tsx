import { requireTenant } from "@/lib/auth/require-tenant";
import { formatDate } from "@/lib/dashboard/format";
import { getDb } from "@/lib/db/client";
import { getTrainingResults } from "@/lib/employee/training";
import { getRoster } from "@/lib/employee/roster";
import { LESSONS, PASS_FRACTION, QUESTIONS } from "@/lib/training/content";
import { totalMinutes, trainingAvailable } from "@/lib/training/grading";

export default async function TrainingPage() {
  const { tenant, locale, t } = await requireTenant();
  const db = getDb();
  const available = trainingAvailable(locale);
  const roster = await getRoster(db, tenant.companyId, locale);
  const results = available
    ? await getTrainingResults(db, tenant.companyId)
    : new Map();
  const passed = roster.rows.filter((r) => results.has(r.id)).length;
  const percent = roster.rows.length
    ? Math.floor((passed * 100) / roster.rows.length)
    : 0;
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("dashboard.training.title")}</h1>
      {!available ? (
        <p className="rounded border border-dashed border-slate-300 p-6">
          {t("dashboard.training.unavailable")}
        </p>
      ) : (
        <>
          <section className="space-y-2 rounded border border-slate-200 p-4">
            <p className="font-medium">
              {t("dashboard.training.moduleLine", {
                lessons: LESSONS.length,
                questions: QUESTIONS.length,
                pass: Math.round(PASS_FRACTION * 100),
                minutes: totalMinutes(),
              })}
            </p>
            <p className="text-sm font-semibold text-amber-800">
              {t("dashboard.training.draft")}
            </p>
            <h2 className="pt-2 text-lg font-semibold">
              {t("dashboard.training.lessonsHeading")}
            </h2>
            <ol lang="pt-BR" className="list-decimal space-y-1 pl-5 text-sm">
              {LESSONS.map((l) => (
                <li key={l.n}>{l.title}</li>
              ))}
            </ol>
          </section>
          {roster.rows.length === 0 ? (
            <p>{t("dashboard.training.empty")}</p>
          ) : (
            <section className="space-y-2">
              <p className="font-medium" role="status">
                {t("dashboard.training.rate", {
                  done: passed,
                  total: roster.rows.length,
                  percent,
                })}
              </p>
              <h2 className="text-lg font-semibold">
                {t("dashboard.training.resultsHeading")}
              </h2>
              <ul className="divide-y divide-slate-200 rounded border border-slate-200">
                {roster.rows.map((r) => {
                  const res = results.get(r.id);
                  return (
                    <li
                      key={r.id}
                      className="flex flex-wrap justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <span>{r.name}</span>
                      <span>
                        {res
                          ? t("dashboard.training.passed", {
                              score: res.score ?? 0,
                              date: formatDate(res.completedAt, locale),
                            })
                          : t("dashboard.training.notStarted")}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-slate-600">
                {t("dashboard.training.attemptsNote")}
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
