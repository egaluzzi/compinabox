import { eq } from "drizzle-orm";
import { LinkInvalidView } from "@/components/employee/LinkInvalidView";
import { getDb } from "@/lib/db/client";
import { companies, employees } from "@/lib/db/schema";
import type { Country } from "@/lib/countries";
import { sha256 } from "@/lib/employee/session";
import { COUNTRY_LOCALE, getT } from "@/lib/i18n";

// The token-entry page. READ-ONLY: it never consumes the link (a mail scanner or a link preview
// that opens it must not burn it). The Start button POSTs the token to /employee/api/session,
// which consumes it atomically. The token appears in this page only as the form's hidden field.
// Public by nature: the only page (with link-invalid) that does not use the portal session gate.
export default async function Start({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();
  const [row] =
    token.length > 0 && token.length <= 200
      ? await db
          .select({
            company: companies.name,
            country: companies.country,
            expires: employees.inviteExpiresAt,
            off: employees.deactivatedAt,
          })
          .from(employees)
          .innerJoin(companies, eq(companies.id, employees.companyId))
          .where(eq(employees.inviteTokenHash, sha256(token)))
      : [];
  // Unknown, used, expired, re-issued-away and deactivated: the same friendly page, same status.
  if (!row || row.off || !row.expires || row.expires <= new Date())
    return <LinkInvalidView />;
  const locale = COUNTRY_LOCALE[row.country as Country] ?? "en";
  const t = getT(locale);
  return (
    <main
      lang={locale}
      className="mx-auto max-w-xl space-y-5 px-4 py-12 text-slate-900"
    >
      <h1 className="text-2xl font-bold">
        {t("employee.startTitle", { company: row.company })}
      </h1>
      <p>{t("employee.startBody")}</p>
      <form method="post" action="/employee/api/session">
        <input type="hidden" name="token" value={token} />
        <button className="rounded bg-slate-900 px-5 py-2 font-medium text-white">
          {t("employee.startButton")}
        </button>
      </form>
    </main>
  );
}
