import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalShell } from "@/components/employee/PortalShell";
import { requireEmployee } from "@/lib/employee/require-employee";
import { LESSONS } from "@/lib/training/content";
import { trainingAvailable } from "@/lib/training/grading";

export default async function Lesson({
  params,
}: {
  params: Promise<{ n: string }>;
}) {
  const ctx = await requireEmployee();
  const { locale, t } = ctx;
  const { n: raw } = await params;
  const back = (
    <Link href="/employee" className="text-sm underline">
      {t("employee.back")}
    </Link>
  );
  if (!trainingAvailable(locale))
    return (
      <PortalShell ctx={ctx}>
        {back}
        <p>{t("employee.trainingUnavailable")}</p>
      </PortalShell>
    );
  const n = /^[1-9][0-9]?$/.test(raw) ? Number(raw) : 0;
  const lesson = LESSONS.find((l) => l.n === n);
  if (!lesson) notFound();
  const link = "rounded border border-slate-700 px-3 py-1 text-sm";
  return (
    <PortalShell ctx={ctx}>
      {back}
      <article lang="pt-BR" className="space-y-4">
        <p className="text-sm text-slate-700">
          {t("employee.lessonOf", { n: lesson.n, total: LESSONS.length })}
        </p>
        <h1 className="text-2xl font-bold">{lesson.title}</h1>
        {lesson.paragraphs.map((p, i) => (
          <p key={i} className="leading-relaxed">
            {p}
          </p>
        ))}
        <aside className="space-y-2 rounded border border-slate-300 bg-slate-50 p-4">
          <h2 className="font-semibold">
            {t("employee.scenario")}: {lesson.scenario.title}
          </h2>
          <p>{lesson.scenario.text}</p>
          <h3 className="font-semibold">{t("employee.whatToDo")}</h3>
          <ul className="list-disc space-y-1 pl-5">
            {lesson.scenario.whatToDo.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </aside>
      </article>
      <nav className="flex flex-wrap gap-3">
        {lesson.n > 1 && (
          <Link className={link} href={`/employee/training/${lesson.n - 1}`}>
            {t("employee.lessonPrev")}
          </Link>
        )}
        {lesson.n < LESSONS.length ? (
          <Link className={link} href={`/employee/training/${lesson.n + 1}`}>
            {t("employee.lessonNext")}
          </Link>
        ) : (
          <Link className={link} href="/employee/training/quiz">
            {t("employee.lessonQuiz")}
          </Link>
        )}
      </nav>
    </PortalShell>
  );
}
