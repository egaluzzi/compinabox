import { VendorForm } from "@/components/vendor/VendorForm";
import { LinkInvalidView } from "@/components/vendor/LinkInvalidView";
import { getDb } from "@/lib/db/client";
import type { Country } from "@/lib/countries";
import { COUNTRY_LOCALE, getT } from "@/lib/i18n";
import { findOpenLink } from "@/lib/vendors/submit";

// The questionnaire. READ-ONLY: GET never consumes the link (a mail scanner or a link preview
// that opens it must not burn it); the POST to /vendor/api/submit does, atomically. Unknown,
// used, expired, re-issued and archived links all render the same friendly page.
export default async function Questionnaire({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ retry?: string }>;
}) {
  const { token } = await params;
  const { retry } = await searchParams;
  const open = await findOpenLink(getDb(), token);
  if (!open) return <LinkInvalidView />;
  const locale = COUNTRY_LOCALE[open.country as Country] ?? "en";
  const t = getT(locale);
  return (
    <main
      lang={locale}
      className="mx-auto max-w-xl space-y-5 px-4 py-12 text-slate-900"
    >
      <h1 className="text-2xl font-bold">
        {t("vendor.title", { company: open.company })}
      </h1>
      <p>{t("vendor.intro", { company: open.company })}</p>
      <p className="text-sm text-slate-700">{t("vendor.notLegal")}</p>
      <VendorForm
        token={token}
        retry={retry === "1"}
        labels={{
          respondentName: t("vendor.respondentName"),
          respondentRole: t("vendor.respondentRole"),
          ownership: t("vendor.ownership"),
          ownershipHelp: t("vendor.ownershipHelp"),
          pep: t("vendor.pep"),
          sanctions: t("vendor.sanctions"),
          antibribery: t("vendor.antibribery"),
          details: t("vendor.details"),
          yes: t("vendor.yes"),
          no: t("vendor.no"),
          submit: t("vendor.submit"),
          submitting: t("vendor.submitting"),
          errorSummary: t("vendor.errorSummary"),
          networkError: t("vendor.networkError"),
          errors: {
            required: t("vendor.error.required"),
            too_long: t("vendor.error.too_long"),
            choice: t("vendor.error.choice"),
          },
          thanksTitle: t("vendor.thanksTitle"),
          thanksBody: t("vendor.thanksBody"),
          invalidTitle: t("vendor.invalidTitle"),
          invalidBody: t("vendor.invalidBody"),
        }}
      />
    </main>
  );
}
