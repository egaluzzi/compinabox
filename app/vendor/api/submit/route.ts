import { getDb } from "@/lib/db/client";
import { parseAnswers, type AnswerField } from "@/lib/vendors/answers";
import {
  INVALID_PATH,
  THANKS_PATH,
  VENDOR_HEADERS,
} from "@/lib/vendors/constants";
import { submitQuestionnaire } from "@/lib/vendors/submit";

export const runtime = "nodejs";

const FIELDS: AnswerField[] = [
  "respondentName",
  "respondentRole",
  "ownershipText",
  "pep",
  "pepDetails",
  "sanctions",
  "sanctionsDetails",
  "antibribery",
];

// POST /vendor/api/submit (form: token + the answers). Public: the token is the only credential.
// Validation first (the link is NOT consumed on an error, and the page keeps the typed answers);
// then ONE transaction consumes the link and stores the encrypted answers. Reads no request
// header, no client address, logs nothing. `via=js` (set by the form's script) selects a JSON
// reply; without JavaScript the browser gets redirects.
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response("Bad Request", {
      status: 400,
      headers: VENDOR_HEADERS,
    });
  }
  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : "";
  };
  const token = str("token");
  const json = str("via") === "js";
  const origin = new URL(process.env.APP_URL || request.url).origin;
  const go = (path: string) =>
    new Response(null, {
      status: 303,
      headers: { ...VENDOR_HEADERS, Location: `${origin}${path}` },
    });
  const reply = (body: object) =>
    Response.json(body, { status: 200, headers: VENDOR_HEADERS });

  const parsed = parseAnswers(
    Object.fromEntries(FIELDS.map((f) => [f, str(f)])),
  );
  if (!parsed.ok)
    return json
      ? reply({ errors: parsed.errors })
      : go(`/vendor/${encodeURIComponent(token)}?retry=1`);
  const result = await submitQuestionnaire(getDb(), token, parsed.answers);
  if (result === "invalid")
    return json ? reply({ invalid: true }) : go(INVALID_PATH);
  return json ? reply({ ok: true }) : go(THANKS_PATH);
}
