"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export type QuizQuestion = {
  id: string;
  lesson: number;
  prompt: string;
  options: string[];
};
type Labels = {
  submit: string;
  unanswered: string;
  error: string;
  correct: string;
  incorrect: string;
  retry: string;
  back: string;
  /** contain {score} {correct} {total} placeholders, filled here */
  passed: string;
  failed: string;
};
type Result = {
  passed: boolean;
  score: number;
  correct: number;
  total: number;
  perQuestion: { id: string; correct: boolean; explanation: string }[];
};

const fill = (s: string, r: Result) =>
  s
    .replace("{score}", String(r.score))
    .replace("{correct}", String(r.correct))
    .replace("{total}", String(r.total));

// One form. The browser only ever receives prompts and options; the verdict, the per-question
// result and the explanations come back from the server after submission.
export function Quiz({
  questions,
  labels,
}: {
  questions: QuizQuestion[];
  labels: Labels;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "error"; message: string }
    | { kind: "result"; result: Result }
  >({ kind: "idle" });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (questions.some((q) => answers[q.id] === undefined))
      return setState({ kind: "error", message: labels.unanswered });
    setState({ kind: "sending" });
    try {
      const res = await fetch("/employee/api/training", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error("bad status");
      setState({ kind: "result", result: (await res.json()) as Result });
    } catch {
      setState({ kind: "error", message: labels.error });
    }
  }

  if (state.kind === "result") {
    const r = state.result;
    const byId = new Map(r.perQuestion.map((p) => [p.id, p]));
    return (
      <div className="space-y-5">
        <p
          role="status"
          className={`text-lg font-semibold ${r.passed ? "text-green-800" : "text-red-700"}`}
        >
          {fill(r.passed ? labels.passed : labels.failed, r)}
        </p>
        <ol className="space-y-4">
          {questions.map((q, i) => {
            const p = byId.get(q.id);
            return (
              <li key={q.id} className="rounded border border-slate-200 p-3">
                <p className="font-medium">
                  {i + 1}. {q.prompt}
                </p>
                <p className="text-sm">
                  <strong>
                    {p?.correct ? labels.correct : labels.incorrect}
                  </strong>{" "}
                  — {p?.explanation}
                </p>
              </li>
            );
          })}
        </ol>
        {r.passed ? (
          <Link className="underline" href="/employee">
            {labels.back}
          </Link>
        ) : (
          <button
            type="button"
            className="rounded border border-slate-700 px-4 py-2"
            onClick={() => {
              setAnswers({});
              setState({ kind: "idle" });
            }}
          >
            {labels.retry}
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {questions.map((q, i) => (
        <fieldset key={q.id} className="space-y-2">
          <legend className="font-medium">
            {i + 1}. {q.prompt}
          </legend>
          {q.options.map((o, j) => (
            <label key={j} className="flex items-start gap-2">
              <input
                type="radio"
                name={q.id}
                value={j}
                checked={answers[q.id] === j}
                onChange={() => setAnswers((a) => ({ ...a, [q.id]: j }))}
                className="mt-1"
              />
              <span>{o}</span>
            </label>
          ))}
        </fieldset>
      ))}
      {state.kind === "error" && (
        <p role="alert" className="text-red-700">
          {state.message}
        </p>
      )}
      <button
        disabled={state.kind === "sending"}
        className="rounded bg-slate-900 px-4 py-2 font-medium text-white"
      >
        {labels.submit}
      </button>
    </form>
  );
}
