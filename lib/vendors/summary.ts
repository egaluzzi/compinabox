import type { Db } from "@/lib/db/client";
import type { ScreeningStatus } from "@/lib/screening/types";
import {
  latestScreenings,
  listVendors,
  questionnaireState,
  type VendorState,
} from "./queries";

export type VendorSummary = {
  id: string;
  name: string;
  country: string | null;
  questionnaire: VendorState;
  questionnaireDate: Date | null;
  /** Latest screening run (errors included), or null if never screened. */
  screening: null | {
    status: ScreeningStatus;
    at: Date;
    dataset: string;
    possibleMatchCount: number;
  };
};

/**
 * Tenant-scoped summary for the binder (phase 8): one row per active vendor. Not a verdict —
 * it reports what was asked and what the screening returned on which date, nothing more.
 */
export async function summarizeVendors(
  db: Db,
  companyId: string,
  now = new Date(),
): Promise<VendorSummary[]> {
  const [vs, latest] = await Promise.all([
    listVendors(db, companyId),
    latestScreenings(db, companyId),
  ]);
  return vs.map((v) => {
    const s = latest.get(v.id);
    return {
      id: v.id,
      name: v.name,
      country: v.country,
      questionnaire: questionnaireState(v, now),
      questionnaireDate: v.submittedAt ?? v.invitedAt,
      screening: s
        ? {
            status: s.status as ScreeningStatus,
            at: s.screenedAt,
            dataset: s.dataset,
            possibleMatchCount:
              s.status === "possible_match" ? s.matchCount : 0,
          }
        : null,
    };
  });
}
