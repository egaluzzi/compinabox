import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { vendorScreenings, vendors } from "@/lib/db/schema";
import {
  SCREEN_COOLDOWN_MS,
  SCREEN_DAILY_CAP,
} from "@/lib/screening/constants";
import type { ScreeningProvider, ScreeningStatus } from "@/lib/screening/types";

export type ScreenResult =
  | { state: "done"; status: ScreeningStatus }
  | { state: "unavailable" | "not_found" | "archived" | "cooldown" | "cap" };

const startOfUtcDay = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * The explicit admin action. Guards first (provider available, vendor is this company's and not
 * archived, per-vendor cooldown, per-company daily cap counted from vendor_screenings with
 * errors included), then ONE provider call, then — in the same transaction — the history row and
 * the vendor's cached result. A transaction-scoped advisory lock per company serialises screening
 * for that company, so two fast clicks cannot both pass the guards and double-bill.
 *
 * What leaves the system is the vendor name and the optional country code, nothing else.
 */
export async function screenVendor(
  db: Db,
  companyId: string,
  userId: string,
  vendorId: string,
  provider: ScreeningProvider,
  now = new Date(),
): Promise<ScreenResult> {
  if (!provider.available) return { state: "unavailable" };
  return db.transaction(async (tx): Promise<ScreenResult> => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"vendor_screen:" + companyId}, 0))`,
    );
    const [v] = await tx
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), eq(vendors.companyId, companyId)));
    if (!v) return { state: "not_found" };
    if (v.archivedAt) return { state: "archived" };
    const [last] = await tx
      .select({ at: vendorScreenings.screenedAt })
      .from(vendorScreenings)
      .where(
        and(
          eq(vendorScreenings.companyId, companyId),
          eq(vendorScreenings.vendorId, vendorId),
        ),
      )
      .orderBy(desc(vendorScreenings.screenedAt))
      .limit(1);
    if (last && now.getTime() - last.at.getTime() < SCREEN_COOLDOWN_MS)
      return { state: "cooldown" };
    const [today] = await tx
      .select({ n: count() })
      .from(vendorScreenings)
      .where(
        and(
          eq(vendorScreenings.companyId, companyId),
          gte(vendorScreenings.screenedAt, startOfUtcDay(now)),
        ),
      );
    if ((today?.n ?? 0) >= SCREEN_DAILY_CAP) return { state: "cap" };

    let outcome;
    try {
      outcome = await provider.screen({
        name: v.name,
        ...(v.country ? { country: v.country } : {}),
      });
    } catch {
      // A misconfigured provider (e.g. a non-https base URL) throws before any request exists:
      // nothing was sent, nothing is recorded.
      return { state: "unavailable" };
    }
    const status = outcome.status;
    await tx.insert(vendorScreenings).values({
      companyId,
      vendorId,
      screenedAt: now,
      provider: provider.name,
      dataset: outcome.status === "error" ? provider.dataset : outcome.dataset,
      nameScreened: v.name,
      status,
      matchCount: outcome.status === "error" ? 0 : outcome.matches.length,
      matches: outcome.status === "error" ? [] : outcome.matches,
      errorCode: outcome.status === "error" ? outcome.code : null,
      requestedByUserId: userId,
    });
    await tx
      .update(vendors)
      .set({ screeningResult: status, screenedAt: now })
      .where(and(eq(vendors.id, vendorId), eq(vendors.companyId, companyId)));
    return { state: "done", status };
  });
}
