import Link from "next/link";
import { formatDate } from "@/lib/dashboard/format";
import { getDb } from "@/lib/db/client";
import { getCompletion } from "@/lib/employee/training";
import { TYPE_KEY } from "@/lib/employee/labels";
import { requireEmployee } from "@/lib/employee/require-employee";
import { getRoster, stepsOf } from "@/lib/employee/roster";
import { totalMinutes } from "@/lib/training/grading";
import { LESSONS } from "@/lib/training/content";
import { PortalShell } from "@/components/employee/PortalShell";

export default async function EmployeeHome() {
  const ctx = await requireEmployee();
  const { me, locale, t } = ctx;
  const roster = await getRoster(getDb(), me.companyId, locale);
  const row = roster.rows.find((r) => r.id === me.employeeId);
  if (!row) throw new Error("employee missing from roster");
  const steps = stepsOf(row, roster);
  const completion =
    row.training !== "unavailable" && row.training.state === "done"
      ? await getCompletion(getDb(), me)
      : null;
  const done = steps.filter((s) => s.state === "done").length;
  const card = "rounded border border-slate-200 p-4";
  const link = "inline-block rounded border border-slate-700 px-3 py-1 text-sm";

  return (
    <PortalShell ctx={ctx}>
      <h1 className="text-3xl font-bold">{t("employee.title")}</h1>
      <p className="text-slate-700">{t("employee.hello", { name: me.name })}</p>
      <p role="status" className="font-medium">
        {t("employee.progress", { done, total: steps.length })}
      </p>
      {done === steps.length && (
        <p className="text-green-800">{t("employee.allDone")}</p>
      )}

      <section aria-labelledby="docs-h" className="space-y-3">
        <h2 id="docs-h" className="text-xl font-semibold">
          {t("employee.documentsHeading")}
        </h2>
        <ul className="space-y-2">
          {roster.currentDocs.map((d) => {
            const step = row.docs[d.type];
            return (
              <li
                key={d.id}
                className={`${card} flex flex-wrap items-center justify-between gap-3`}
              >
                <div>
                  <p className="font-medium">
                    {t(`documents.types.${TYPE_KEY[d.type]}`)}
                  </p>
                  <p className="text-sm text-slate-700">
                    {step.state === "done"
                      ? t("employee.docAccepted", {
                          date: formatDate(step.at, locale),
                        })
                      : step.state === "outdated"
                        ? t("employee.docOutdated")
                        : t("employee.docPending")}
                  </p>
                </div>
                {step.state !== "done" && (
                  <Link className={link} href={`/employee/documents/${d.id}`}>
                    {t("employee.docOpen")}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="train-h" className="space-y-3">
        <h2 id="train-h" className="text-xl font-semibold">
          {t("employee.trainingHeading")}
        </h2>
        <div className={card}>
          {row.training === "unavailable" ? (
            <p>{t("employee.trainingUnavailable")}</p>
          ) : row.training.state === "done" ? (
            <p>
              {t("employee.trainingDone", {
                date: formatDate(row.training.at, locale),
                score: completion?.score ?? 0,
              })}
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p>
                {t("employee.trainingPending", {
                  minutes: totalMinutes(),
                  lessons: LESSONS.length,
                })}
              </p>
              <Link className={link} href="/employee/training/1">
                {t("employee.trainingStart")}
              </Link>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="disc-h" className="space-y-3">
        <h2 id="disc-h" className="text-xl font-semibold">
          {t("employee.disclosureHeading", { year: roster.year })}
        </h2>
        <div
          className={`${card} flex flex-wrap items-center justify-between gap-3`}
        >
          {row.disclosure.state === "done" ? (
            <p>
              {t("employee.disclosureDone", {
                date: formatDate(row.disclosure.at, locale),
              })}
            </p>
          ) : (
            <>
              <p>{t("employee.docPending")}</p>
              <Link className={link} href="/employee/disclosure">
                {t("employee.disclosureOpen")}
              </Link>
            </>
          )}
        </div>
      </section>
    </PortalShell>
  );
}
