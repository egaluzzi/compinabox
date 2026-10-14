const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Phase 1 stub: validates, drops honeypot hits, and writes ONE console line with
 * email + country + timestamp. Nothing else from the request is read or logged —
 * no IP, no user-agent, no headers. Phase 2 replaces the log with a WaitlistLead row.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (typeof parsed !== "object" || parsed === null)
      return json({ ok: false }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ ok: false }, 400);
  }

  // Honeypot: pretend success so bots learn nothing.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return json({ ok: true }, 200);
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (email.length > 254 || !EMAIL.test(email))
    return json({ ok: false, error: "invalid_email" }, 422);

  const country =
    typeof body.country === "string"
      ? body.country
          .replace(/[^\p{L}\p{N} .'-]/gu, "")
          .trim()
          .slice(0, 60)
      : "";

  console.log(
    JSON.stringify({
      event: "waitlist",
      email,
      country: country || "unknown",
      at: new Date().toISOString(),
    }),
  );
  return json({ ok: true }, 200);
}
