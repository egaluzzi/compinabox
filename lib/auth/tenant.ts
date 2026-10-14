import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/lib/db/client";
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
  if (!userId || !companyId) return null;
  const [row] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.companyId, companyId)));
  return row ? { userId, companyId } : null;
}
