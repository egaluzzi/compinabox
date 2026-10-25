import { createAttempt } from "@/lib/checkout/attempt";
import { RETURN_COOKIE } from "@/lib/checkout/return";
import { getDb } from "@/lib/db/client";
import { isHttpsApp, json, requestCookie } from "@/lib/http";
import { resolveProvider } from "@/lib/payments";
import { parseUtmCookie, UTM_COOKIE } from "@/lib/utm";

// POST /api/checkout — creates a checkout_attempt and returns the hosted-checkout URL.
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (typeof parsed !== "object" || parsed === null)
      return json({ ok: false, error: "bad_request" }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  const resolution = resolveProvider();
  if (!resolution.available)
    return json({ ok: false, error: "unavailable" }, 503);

  const result = await createAttempt(getDb(), resolution.provider, {
    country: body.country,
    companyName: body.companyName,
    taxId: body.taxId,
    billingEmail: body.billingEmail,
    termsAccepted: body.termsAccepted,
    termsVersion: body.termsVersion,
    utm: parseUtmCookie(requestCookie(request, UTM_COOKIE)),
  });
  if (!result.ok) {
    const status =
      result.error === "unavailable" || result.error === "provider_error"
        ? 503
        : 422;
    return json({ ok: false, error: result.error }, status);
  }

  const response = json({
    ok: true,
    attemptId: result.attemptId,
    redirectUrl: result.redirectUrl,
  });
  // Binds the post-payment sign-in to THIS browser (see lib/checkout/return.ts).
  response.headers.append(
    "Set-Cookie",
    `${RETURN_COOKIE}=${result.returnToken}; Path=/; Max-Age=${60 * 60 * 24}; HttpOnly; SameSite=Lax${isHttpsApp() ? "; Secure" : ""}`,
  );
  return response;
}
