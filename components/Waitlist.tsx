import { WaitlistForm } from "./WaitlistForm";
import type { T } from "@/lib/i18n";

/** Server wrapper: resolves labels once so every page uses the identical form. */
export function Waitlist({ t, country }: { t: T; country: string | null }) {
  return (
    <section
      id="waitlist"
      className="rounded-lg border border-slate-200 bg-slate-50 p-5"
    >
      <h2 className="mb-3 text-xl font-semibold">{t("home.joinWaitlist")}</h2>
      <WaitlistForm
        country={country}
        labels={{
          intro: t("waitlist.intro"),
          email: t("waitlist.emailLabel"),
          country: t("waitlist.countryLabel"),
          submit: t("home.joinWaitlist"),
          success: t("waitlist.success"),
          invalid: t("waitlist.invalid"),
          error: t("waitlist.error"),
        }}
      />
    </section>
  );
}
