import Link from "next/link";
import { PortalShell } from "@/components/employee/PortalShell";
import { Quiz } from "@/components/employee/Quiz";
import { requireEmployee } from "@/lib/employee/require-employee";
import { PASS_FRACTION } from "@/lib/training/content";
import { publicQuestions, trainingAvailable } from "@/lib/training/grading";

export default async function QuizPage() {
  const ctx = await requireEmployee();
  const { locale, t } = ctx;
  if (!trainingAvailable(locale))
    return (
      <PortalShell ctx={ctx}>
        <Link href="/employee" className="text-sm underline">
          {t("employee.back")}
        </Link>
        <p>{t("employee.trainingUnavailable")}</p>
      </PortalShell>
    );
  // The questions go to the browser WITHOUT the correct answers or explanations (grading is
  // server-side: POST /employee/api/training).
  const questions = publicQuestions();
  const pass = Math.round(PASS_FRACTION * 100);
  return (
    <PortalShell ctx={ctx}>
      <Link href="/employee" className="text-sm underline">
        {t("employee.back")}
      </Link>
      <h1 className="text-2xl font-bold">{t("employee.quizTitle")}</h1>
      <p>{t("employee.quizIntro", { count: questions.length, pass })}</p>
      <Quiz
        questions={questions}
        labels={{
          submit: t("employee.quizSubmit"),
          unanswered: t("employee.quizUnanswered"),
          error: t("employee.quizError"),
          correct: t("employee.quizCorrect"),
          incorrect: t("employee.quizIncorrect"),
          retry: t("employee.quizRetry"),
          back: t("employee.back"),
          passed: t("employee.quizPassed", {
            score: "{score}",
            correct: "{correct}",
            total: "{total}",
          }),
          failed: t("employee.quizFailed", {
            score: "{score}",
            correct: "{correct}",
            total: "{total}",
            pass,
          }),
        }}
      />
    </PortalShell>
  );
}
