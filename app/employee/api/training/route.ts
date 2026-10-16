import { getDb } from "@/lib/db/client";
import {
  PORTAL_HEADERS,
  requireEmployeeRoute,
} from "@/lib/employee/require-employee";
import { recordPass } from "@/lib/employee/training";
import { grade, trainingAvailable } from "@/lib/training/grading";

export const runtime = "nodejs";

const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: PORTAL_HEADERS });

// POST /employee/api/training (JSON: { answers: { q1: 0..3, ... } }). Graded HERE, server-side.
// A fail stores nothing and can be retaken immediately; a pass stores one row (idempotent).
export async function POST(request: Request) {
  const gate = await requireEmployeeRoute(request);
  if (!gate.ok) return gate.response;
  const { me, locale } = gate.ctx;
  if (!trainingAvailable(locale)) return reply({ error: "unavailable" }, 404);
  let answers: Record<string, unknown>;
  try {
    const body = await request.json();
    if (!body || typeof body.answers !== "object" || body.answers === null)
      throw new Error("shape");
    answers = body.answers;
  } catch {
    return reply({ error: "bad_request" }, 400);
  }
  const result = grade(answers);
  if (result.passed) await recordPass(getDb(), me, result.score);
  return reply(result);
}
