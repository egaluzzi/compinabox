// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getMessages } from "@/lib/i18n";
import {
  LESSONS,
  MODULE_ID,
  OPTIONS_PER_QUESTION,
  QUESTIONS,
  TOTAL_MINUTES,
} from "@/lib/training/content";
import {
  grade,
  publicQuestions,
  totalMinutes,
  trainingAvailable,
} from "@/lib/training/grading";

const answersWith = (wrong: number) => {
  const a: Record<string, number> = {};
  QUESTIONS.forEach((q, i) => {
    a[q.id] = i < wrong ? (q.correct + 1) % OPTIONS_PER_QUESTION : q.correct;
  });
  return a;
};

describe("training content shape (phase 6 scope)", () => {
  it("module id, 6 lessons, 12 questions, 2 per lesson, 4 options, one correct, an explanation each", () => {
    expect(MODULE_ID).toBe("anticorruption-pt-BR-v1");
    expect(LESSONS).toHaveLength(6);
    expect(QUESTIONS).toHaveLength(12);
    for (const l of LESSONS) {
      expect(QUESTIONS.filter((q) => q.lesson === l.n)).toHaveLength(2);
    }
    for (const q of QUESTIONS) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect([0, 1, 2, 3]).toContain(q.correct);
      expect(q.explanation.length).toBeGreaterThan(20);
      expect(q.explanation.split(/[.!?]\s/).length).toBeLessThanOrEqual(2); // one sentence
    }
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(12);
  });

  it("lessons are ~350-450 words, each with a scenario and what to do; total time 15-25 min", () => {
    for (const l of LESSONS) {
      const words = [...l.paragraphs, l.scenario.text, ...l.scenario.whatToDo]
        .join(" ")
        .split(/\s+/).length;
      expect(words, `lesson ${l.n}`).toBeGreaterThanOrEqual(330);
      expect(words, `lesson ${l.n}`).toBeLessThanOrEqual(480);
      expect(l.scenario.whatToDo.length).toBeGreaterThanOrEqual(2);
    }
    expect(totalMinutes()).toBeGreaterThanOrEqual(15);
    expect(totalMinutes()).toBeLessThanOrEqual(25);
    expect(TOTAL_MINUTES).toBeGreaterThan(0);
  });

  it("the correct answer is not always in the same position", () => {
    expect(
      new Set(QUESTIONS.map((q) => q.correct)).size,
    ).toBeGreaterThanOrEqual(3);
  });
});

describe("training content rules (CLAUDE.md §8)", () => {
  const text = JSON.stringify({ LESSONS, QUESTIONS });
  const portalMessages = (locale: Parameters<typeof getMessages>[0]) =>
    JSON.stringify({
      employee: getMessages(locale).employee,
      training: getMessages(locale).dashboard.training,
    });

  it("names no statute, article or decree", () => {
    expect(text).not.toMatch(
      /\bLei\b|\bart(\.|igo)\b|\bdecreto\b|\b\d{1,2}\.\d{3}\b|12\.846|14\.133|LGPD|\bCF\b|c[óo]digo penal/i,
    );
  });

  it("makes no compliance, certification or legal-coverage claim, and never says 'certificado'", () => {
    const banned =
      /certific|ISO ?3730|garant(e|imos|ia|ido)\b|em conformidade com a lei|est[aá] (protegid|amparad|coberto)|isen(ta|ção) de responsabilidade|livre de (responsabilidade|processo)|totalmente (protegid|em conformidade)|voc[êe] (est[aá]|ficará) em conformidade/i;
    expect(text).not.toMatch(banned);
    for (const l of ["pt-BR", "es-AR", "es-MX", "en"] as const)
      expect(portalMessages(l), l).not.toMatch(/certific|ISO ?3730/i);
  });

  it("completion copy says 'Treinamento concluído' (pt-BR), never a certificate", () => {
    const m = getMessages("pt-BR");
    expect(m.employee.quizPassed).toContain("Treinamento concluído");
  });

  it("REVIEW.md exists, marks every lesson and the quiz DRAFT, and addresses Esteban", () => {
    const md = readFileSync(
      path.resolve(__dirname, "../lib/training/REVIEW.md"),
      "utf8",
    );
    expect(md).toMatch(/DRAFT/);
    expect(md).toMatch(/Esteban/);
    for (const l of LESSONS) expect(md).toContain(l.title);
    for (const q of QUESTIONS) expect(md).toContain(q.prompt);
  });
});

describe("grading (server side)", () => {
  it("pass mark is 80%: 12/12, 11/12 and 10/12 pass; 9/12 fails", () => {
    expect(grade(answersWith(0))).toMatchObject({
      correct: 12,
      score: 100,
      passed: true,
    });
    expect(grade(answersWith(1))).toMatchObject({
      correct: 11,
      score: 91,
      passed: true,
    });
    expect(grade(answersWith(2))).toMatchObject({
      correct: 10,
      score: 83,
      passed: true,
    });
    expect(grade(answersWith(3))).toMatchObject({
      correct: 9,
      score: 75,
      passed: false,
    });
    expect(grade(answersWith(12))).toMatchObject({
      correct: 0,
      score: 0,
      passed: false,
    });
  });

  it("missing, malformed and out-of-range answers count as wrong (never a pass by omission)", () => {
    expect(grade({}).correct).toBe(0);
    const a: Record<string, unknown> = answersWith(0);
    a.q1 = "1";
    a.q2 = 99;
    a.q3 = -1;
    a.q4 = 1.5;
    a.q5 = null;
    expect(grade(a)).toMatchObject({ correct: 7, passed: false });
  });

  it("per-question result carries correct/incorrect and the explanation, not the right option", () => {
    const g = grade(answersWith(1));
    expect(g.perQuestion).toHaveLength(12);
    expect(g.perQuestion.filter((p) => !p.correct)).toHaveLength(1);
    for (const p of g.perQuestion) {
      expect(Object.keys(p).sort()).toEqual(["correct", "explanation", "id"]);
      expect(p.explanation.length).toBeGreaterThan(0);
    }
  });

  it("what the browser gets has no correct answer and no explanation", () => {
    const pub = publicQuestions();
    expect(pub).toHaveLength(12);
    const json = JSON.stringify(pub);
    expect(json).not.toContain("correct");
    expect(json).not.toContain("explanation");
    for (const q of QUESTIONS) expect(json).not.toContain(q.explanation);
  });

  it("training exists for pt-BR only", () => {
    expect(trainingAvailable("pt-BR")).toBe(true);
    for (const l of ["es-AR", "es-MX", "en"] as const)
      expect(trainingAvailable(l)).toBe(false);
  });
});
