import { createHmac, timingSafeEqual } from "node:crypto";
import { and, asc, eq, gt, lt } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { checkoutAttempt } from "@/lib/db/schema";
import { applyPayment } from "./webhook";
import {
  PaymentLookupUnavailable,
  PaymentNotFound,
  type PaymentProvider,
} from "./types";

export const RECONCILE_MIN_AGE_MS = 5 * 60 * 1000;
export const RECONCILE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const RECONCILE_BATCH = 50;

export type ReconcileSummary = {
  checked: number;
  changed: number;
  unavailable: number;
  errors: number;
};

/** The bearer token for the internal route: derived from the webhook secret, so no extra setting. */
export function reconcileToken(webhookSecret: string): string {
  return createHmac("sha256", webhookSecret)
    .update("reconcile-payments")
    .digest("hex");
}

export function reconcileTokenValid(
  presented: string | null,
  webhookSecret: string,
): boolean {
  if (!presented || !webhookSecret) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(reconcileToken(webhookSecret));
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Webhooks get lost, and Pix can turn approved hours later. For pending attempts of this provider
 * (older than 5 minutes, younger than 7 days; at most 50, oldest first, one at a time) ask the
 * processor for the attempt's payments and run each through the SAME applyPayment() the webhook
 * uses. One attempt failing never stops the others.
 */
export async function reconcilePending(
  db: Db,
  provider: PaymentProvider,
  now = new Date(),
): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = {
    checked: 0,
    changed: 0,
    unavailable: 0,
    errors: 0,
  };
  if (!provider.findPayments) return summary;
  const rows = await db
    .select({ id: checkoutAttempt.id })
    .from(checkoutAttempt)
    .where(
      and(
        eq(checkoutAttempt.status, "pending"),
        eq(checkoutAttempt.provider, provider.name),
        lt(
          checkoutAttempt.createdAt,
          new Date(now.getTime() - RECONCILE_MIN_AGE_MS),
        ),
        gt(
          checkoutAttempt.createdAt,
          new Date(now.getTime() - RECONCILE_MAX_AGE_MS),
        ),
      ),
    )
    .orderBy(asc(checkoutAttempt.createdAt))
    .limit(RECONCILE_BATCH);

  for (const { id } of rows) {
    summary.checked++;
    try {
      for (const ref of await provider.findPayments(id)) {
        try {
          const info = await provider.fetchPayment(ref);
          // A search by external_reference must only ever act on THIS attempt.
          if (info.attemptId !== id) continue;
          const r = await applyPayment(
            db,
            provider,
            { eventId: ref, paymentRef: ref },
            info,
            now,
          );
          if (
            r.body.outcome === "provisioned" ||
            r.body.outcome === "marked_failed" ||
            r.body.outcome === "marked_expired" ||
            r.body.outcome === "refunded"
          )
            summary.changed++;
        } catch (err) {
          if (err instanceof PaymentNotFound) continue;
          throw err;
        }
      }
    } catch (err) {
      if (err instanceof PaymentLookupUnavailable) summary.unavailable++;
      else {
        summary.errors++;
        console.error(
          "reconcile: attempt failed:",
          err instanceof Error ? err.name : "error",
        );
      }
    }
  }
  return summary;
}
