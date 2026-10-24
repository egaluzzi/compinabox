import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { companies, employees, employeeSessions } from "@/lib/db/schema";
import { SESSION_TTL_MS } from "./constants";

// Link -> session (phase 6). The emailed token is a one-time key: the Start button (POST) swaps it
// for a revocable, DB-backed portal session. Only sha256 of either secret is ever stored.

export const sha256 = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export const newSecret = () => randomBytes(32).toString("base64url");

/**
 * READ-ONLY validity check used by the GET "Start" page. It consumes nothing, so a mail scanner
 * that prefetches the link cannot burn it.
 */
export async function isInviteUsable(db: Db, token: string, now = new Date()) {
  if (!token || token.length > 200) return false;
  const [row] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(
      and(
        eq(employees.inviteTokenHash, sha256(token)),
        gt(employees.inviteExpiresAt, now),
        isNull(employees.deactivatedAt),
      ),
    );
  return !!row;
}

export type Started = { sessionToken: string; expiresAt: Date };

/**
 * Consumes the invite and opens a session, in one transaction. The UPDATE ... RETURNING is a
 * single atomic statement: two concurrent POSTs with the same token cannot both match, so exactly
 * one wins. Unknown, used, expired, re-issued-away and deactivated all give null (one outcome).
 */
export async function startSession(
  db: Db,
  token: string,
  now = new Date(),
): Promise<Started | null> {
  if (!token || token.length > 200) return null;
  return db.transaction(async (tx) => {
    const won = await tx
      .update(employees)
      .set({ inviteTokenHash: null })
      .where(
        and(
          eq(employees.inviteTokenHash, sha256(token)),
          gt(employees.inviteExpiresAt, now),
          isNull(employees.deactivatedAt),
        ),
      )
      .returning({ id: employees.id, companyId: employees.companyId });
    if (won.length === 0) return null;
    const sessionToken = newSecret();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await tx.insert(employeeSessions).values({
      companyId: won[0].companyId,
      employeeId: won[0].id,
      tokenHash: sha256(sessionToken),
      expiresAt,
    });
    return { sessionToken, expiresAt };
  });
}

export type PortalEmployee = {
  sessionId: string;
  employeeId: string;
  companyId: string;
  name: string;
  email: string;
};

/**
 * Cookie value -> employee. The employee AND the company come only from this row (the join
 * additionally requires employee.company_id = session.company_id). Expired sessions and
 * deactivated employees resolve to null.
 */
export async function getPortalEmployee(
  db: Db,
  sessionToken: string | undefined,
  now = new Date(),
): Promise<PortalEmployee | null> {
  if (!sessionToken || sessionToken.length > 200) return null;
  const [row] = await db
    .select({
      sessionId: employeeSessions.id,
      employeeId: employees.id,
      companyId: employees.companyId,
      name: employees.name,
      email: employees.email,
    })
    .from(employeeSessions)
    .innerJoin(
      employees,
      and(
        eq(employees.id, employeeSessions.employeeId),
        eq(employees.companyId, employeeSessions.companyId),
      ),
    )
    .where(
      and(
        eq(employeeSessions.tokenHash, sha256(sessionToken)),
        gt(employeeSessions.expiresAt, now),
        isNull(employees.deactivatedAt),
      ),
    );
  return row ?? null;
}

export async function endSession(
  db: Db,
  me: { sessionId: string; companyId: string },
) {
  await db
    .delete(employeeSessions)
    .where(
      and(
        eq(employeeSessions.id, me.sessionId),
        eq(employeeSessions.companyId, me.companyId),
      ),
    );
}

export async function getPortalCompany(db: Db, companyId: string) {
  const [row] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId));
  return row ?? null;
}
