import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, type Db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export type Tenant = { userId: string; companyId: string };

/**
 * The only source of company_id for tenant queries: the signed session, never a request
 * param. Re-checked against the DB so a deleted/moved user's old JWT stops working.
 */
export async function getTenant(): Promise<Tenant | null> {
  const session = await auth();
  const userId = session?.user?.id;
  const companyId = session?.companyId;
  const issuedAtMs = session?.issuedAtMs;
  if (!userId || !companyId || typeof issuedAtMs !== "number") return null;
  const [row] = await getDb()
    .select({ validAfter: users.sessionsValidAfter })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.companyId, companyId)));
  if (!row) return null;
  // Revocation: sign-out sets sessions_valid_after = now() (Postgres clock); a session issued
  // before that is void. The droplet and Postgres share a host/clock, so no tolerance window.
  if (issuedAtMs < row.validAfter.getTime()) return null;
  return { userId, companyId };
}

/** Sign-out: void every session issued so far for this user (tenant comes from the session). */
export async function revokeSessions(db: Db, tenant: Tenant): Promise<void> {
  await db
    .update(users)
    .set({ sessionsValidAfter: sql`now()` })
    .where(
      and(eq(users.id, tenant.userId), eq(users.companyId, tenant.companyId)),
    );
}
