import { getDb } from "@/lib/db/client";
import { waitlistLeads } from "@/lib/db/schema";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Validates, drops honeypot hits, and stores a waitlist_leads row (email + country +
 * timestamp). Nothing else from the request is read or stored — no IP, no user-agent,
 * no headers — and nothing is logged. A repeat email is a silent no-op (same response).
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

  try {
    await getDb()
      .insert(waitlistLeads)
      .values({ email: email.toLowerCase(), country: country || "unknown" })
      .onConflictDoNothing();
  } catch {
    return json({ ok: false, error: "server" }, 500);
  }
  return json({ ok: true }, 200);
}
