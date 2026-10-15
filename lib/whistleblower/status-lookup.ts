import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { whistleblowerReports } from "@/lib/db/schema";
import { COUNTRY_LOCALE, getT } from "@/lib/i18n";
import type { Country } from "@/lib/countries";
import { DISPLAY_TZ } from "@/lib/dashboard/format";
import { isStatus } from "./constants";

/**
 * (company, code) -> the status label and the date of the last status change. Nothing else:
 * no category, no description, no notes.
 */
export async function lookupStatus(
  db: Db,
  company: { id: string; country: string },
  code: string,
): Promise<{ status: string; label: string; date: string } | null> {
  const [row] = await db
    .select({
      status: whistleblowerReports.status,
      changedAt: whistleblowerReports.statusChangedAt,
    })
    .from(whistleblowerReports)
    .where(
      and(
        eq(whistleblowerReports.companyId, company.id),
        eq(whistleblowerReports.trackingCode, code),
      ),
    );
  if (!row || !isStatus(row.status)) return null;
  const locale = COUNTRY_LOCALE[company.country as Country] ?? "en";
  return {
    status: row.status,
    label: getT(locale)(`report.statuses.${row.status}`),
    date: row.changedAt.toLocaleDateString(locale, { timeZone: DISPLAY_TZ }),
  };
}
