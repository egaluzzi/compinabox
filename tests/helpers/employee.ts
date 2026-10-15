import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { companies, employees } from "@/lib/db/schema";
import { ensureInitialDocuments } from "@/lib/documents/store";
import { SESSION_COOKIE } from "@/lib/employee/constants";
import { newSecret, sha256, startSession } from "@/lib/employee/session";
import { seedCompany, uid } from "./db";

/** An onboarded tenant with the six generated documents (country br -> pt-BR, or another). */
export async function seedPortalCompany(
  db: Db,
  label = uid(),
  country: "br" | "ar" | "mx" = "br",
) {
  const s = await seedCompany(db, label);
  const [company] = await db
    .update(companies)
    .set({
      name: `Empresa ${label}`,
      industry: "technology",
      country,
      onboardingCompletedAt: new Date(),
    })
    .where(eq(companies.id, s.company.id))
    .returning();
  if (country === "br")
    await ensureInitialDocuments(db, s.company.id, s.user.id);
  return { ...s, company };
}

/** An employee with a live invite link (token returned; only its hash is stored). */
export async function seedInvited(
  db: Db,
  companyId: string,
  name = "Pessoa Teste",
  email = `p-${uid()}@example.test`,
  opts: { expiresInMs?: number } = {},
) {
  const token = newSecret();
  const [employee] = await db
    .insert(employees)
    .values({
      companyId,
      name,
      email,
      inviteTokenHash: sha256(token),
      invitedAt: new Date(),
      inviteExpiresAt: new Date(Date.now() + (opts.expiresInMs ?? 3600_000)),
    })
    .returning();
  return { employee, token };
}

/** Employee + an open portal session (the token exchange done through the real function). */
export async function seedSession(db: Db, companyId: string, name?: string) {
  const inv = await seedInvited(db, companyId, name);
  const started = await startSession(db, inv.token);
  if (!started) throw new Error("seed: session did not start");
  return { ...inv, sessionToken: started.sessionToken };
}

export const cookieOf = (sessionToken: string) =>
  `${SESSION_COOKIE}=${sessionToken}`;

export function postReq(
  url: string,
  sessionToken: string | null,
  body: FormData | Record<string, unknown> | null,
  headers: Record<string, string> = {},
) {
  const h: Record<string, string> = { ...headers };
  if (sessionToken) h.cookie = cookieOf(sessionToken);
  if (body && !(body instanceof FormData))
    h["content-type"] = "application/json";
  return new Request(url, {
    method: "POST",
    headers: h,
    body:
      body === null
        ? null
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
}

export const formOf = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
