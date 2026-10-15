import {
  LESSONS,
  MODULE_ID,
  OPTIONS_PER_QUESTION,
  PASS_FRACTION,
  QUESTIONS,
  QUIZ_MINUTES,
  TOTAL_MINUTES,
  TRAINING_LOCALE,
} from "./content";
import type { Locale } from "@/lib/i18n";

export { LESSONS, MODULE_ID };

/** Training exists for pt-BR companies only; every other locale shows "not yet available". */
export const trainingAvailable = (locale: Locale) => locale === TRAINING_LOCALE;

export const totalMinutes = () => TOTAL_MINUTES + QUIZ_MINUTES;

export type PublicQuestion = {
  id: string;
  lesson: number;
  prompt: string;
  options: string[];
};

/** What the browser receives: prompts and options only. Never `correct`, never `explanation`. */
export function publicQuestions(): PublicQuestion[] {
  return QUESTIONS.map((q) => ({
    id: q.id,
    lesson: q.lesson,
    prompt: q.prompt,
    options: [...q.options],
  }));
}

export type GradeResult = {
  total: number;
  correct: number;
  /** Integer percent, rounded down (never rounds a failing score up to a pass). */
  score: number;
  passed: boolean;
  perQuestion: {
    id: string;
    correct: boolean;
    explanation: string;
  }[];
};

/**
 * Server-side grading. `answers` maps question id -> chosen option index. A missing, malformed or
 * out-of-range answer counts as wrong. Pass mark: correct/total >= 0.8, compared in integers
 * (correct * 5 >= total * 4) so there is no floating-point edge at exactly 80%.
 */
export function grade(answers: Record<string, unknown>): GradeResult {
  const perQuestion = QUESTIONS.map((q) => {
    const a = answers[q.id];
    const ok =
      typeof a === "number" &&
      Number.isInteger(a) &&
      a >= 0 &&
      a < OPTIONS_PER_QUESTION &&
      a === q.correct;
    return {
      id: q.id,
      correct: ok,
      explanation: q.explanation,
    };
  });
  const total = QUESTIONS.length;
  const correct = perQuestion.filter((p) => p.correct).length;
  const passMark = Math.round(PASS_FRACTION * 100); // 80
  return {
    total,
    correct,
    score: Math.floor((correct * 100) / total),
    passed: correct * 100 >= total * passMark,
    perQuestion,
  };
}

export const lessonCount = () => LESSONS.length;
