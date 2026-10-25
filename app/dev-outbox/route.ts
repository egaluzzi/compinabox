import {
  basicAuthOk,
  listOutbox,
  outboxEnabled,
  outboxLocked,
  recordOutboxFailure,
  renderOutbox,
} from "@/lib/email/outbox";

export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
};

/**
 * Staging only (APP_ENV=staging + EMAIL_DEV_SINK=true + DEV_OUTBOX_PASSWORD): HTTP Basic auth,
 * lists the newest messages the e-mail sink wrote. Any other configuration: 404, as if the route
 * did not exist.
 */
export async function GET(request: Request) {
  if (!outboxEnabled()) {
    return new Response("Not found", { status: 404, headers: HEADERS });
  }
  if (outboxLocked()) {
    return new Response("Too many failed attempts", {
      status: 429,
      headers: { ...HEADERS, "Retry-After": "60" },
    });
  }
  const password = process.env.DEV_OUTBOX_PASSWORD as string;
  if (!basicAuthOk(request.headers.get("authorization"), password)) {
    recordOutboxFailure();
    return new Response("Authentication required", {
      status: 401,
      headers: {
        ...HEADERS,
        "WWW-Authenticate": 'Basic realm="dev-outbox", charset="UTF-8"',
      },
    });
  }
  const messages = await listOutbox(
    process.env.EMAIL_SINK_DIR || ".dev-outbox",
  );
  return new Response(renderOutbox(messages), {
    status: 200,
    headers: { ...HEADERS, "Content-Type": "text/html; charset=utf-8" },
  });
}
