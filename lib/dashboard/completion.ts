import type { Db } from "@/lib/db/client";
import {
  computeCompletion,
  getRoster,
  type Completion,
} from "@/lib/employee/roster";
import type { Locale } from "@/lib/i18n";

/**
 * Company-wide completion (phase 6): the definition lives in lib/employee/roster.ts
 * (computeCompletion). `percent` is null when there are no active employees; the Overview then
 * shows "—".
 */
export async function companyCompletion(
  db: Db,
  companyId: string,
  locale: Locale,
): Promise<Completion> {
  return computeCompletion(await getRoster(db, companyId, locale));
}
