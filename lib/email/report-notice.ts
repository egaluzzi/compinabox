import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { companies, users } from "@/lib/db/schema";
import { COUNTRY_LOCALE, getT } from "@/lib/i18n";
import type { Country } from "@/lib/countries";
import { getEmailSender } from "./index";

/**
 * One email per admin of the company when a report is submitted. Deliberately content-free: no
 * category, no description, no tracking code, no report id, no timestamp — just a link to the
 * dashboard. Never throws (a report is never lost because email is down); a failure logs a
 * fixed string. Lives outside lib/whistleblower so that tree can stay free of any logging.
 */
export async function notifyAdminsOfNewReport(db: Db, companyId: string) {
  try {
    const [company] = await db
      .select({ country: companies.country })
      .from(companies)
      .where(eq(companies.id, companyId));
    if (!company) return;
    const admins = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.companyId, companyId));
    const t = getT(COUNTRY_LOCALE[company.country as Country] ?? "en");
    const base = new URL(process.env.APP_URL || "http://localhost:3000").origin;
    const url = `${base}/dashboard/whistleblower`;
    const sender = getEmailSender();
    const text = t("email.reportBody", { url });
    for (const a of admins)
      await sender.send({
        to: a.email,
        subject: t("email.reportSubject"),
        text,
        html: `<p>${text.replace(url, `<a href="${url}">${url}</a>`)}</p>`,
      });
  } catch {
    console.error("report notification email failed");
  }
}
