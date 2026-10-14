import { and, eq, gt, isNull } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { checkoutAttempt, users } from "@/lib/db/schema";
import { hashToken } from "./attempt";

export const RETURN_COOKIE = "return_token";

export type ReturnState = {
  status: "pending" | "paid" | "failed" | "expired" | "unknown";
  /** Set exactly once, only for the browser that started the checkout. */
  user: { id: string; email: string; companyId: string } | null;
};

/**
 * Status poll for /checkout/return. Reading status never provisions anything. If the attempt
 * is paid AND the caller holds the matching httpOnly return token (set when the attempt was
 * created) AND it has not been used AND has not expired, the token is burned atomically and
 * the user is returned so the route can issue a session. Anything else: no session.
 */
export async function readReturnState(
  db: Db,
  attemptId: string,
  returnToken: string | undefined,
  now = new Date(),
): Promise<ReturnState> {
  if (!/^[0-9a-f-]{36}$/i.test(attemptId))
    return { status: "unknown", user: null };
  const [attempt] = await db
    .select({ status: checkoutAttempt.status })
    .from(checkoutAttempt)
    .where(eq(checkoutAttempt.id, attemptId));
  if (!attempt) return { status: "unknown", user: null };
  const status = attempt.status as ReturnState["status"];
  if (status !== "paid" || !returnToken) return { status, user: null };

  const [claimed] = await db
    .update(checkoutAttempt)
    .set({ returnTokenUsedAt: now })
    .where(
      and(
        eq(checkoutAttempt.id, attemptId),
        eq(checkoutAttempt.status, "paid"),
        eq(checkoutAttempt.returnTokenHash, hashToken(returnToken)),
        isNull(checkoutAttempt.returnTokenUsedAt),
        gt(checkoutAttempt.returnTokenExpiresAt, now),
      ),
    )
    .returning({ userId: checkoutAttempt.userId });
  if (!claimed?.userId) return { status, user: null };

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, claimed.userId));
  return {
    status,
    user: user
      ? { id: user.id, email: user.email, companyId: user.companyId }
      : null,
  };
}
