import { redirect } from "next/navigation";
import { getTenant } from "@/lib/auth/tenant";
import { getDb } from "@/lib/db/client";
import { getCompany } from "@/lib/db/tenant";
import { COUNTRY_LOCALE, getT } from "@/lib/i18n";
import { INDUSTRIES } from "@/lib/industries";
import type { Country } from "@/lib/countries";

export default async function Onboarding({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const tenant = await getTenant();
  if (!tenant) redirect("/login");
  const company = await getCompany(getDb(), tenant.companyId);
  if (!company) redirect("/login");
  const { error } = await searchParams;
  const t = getT(COUNTRY_LOCALE[company.country as Country] ?? "en");
  const field = "mt-1 w-full rounded border border-slate-300 px-3 py-2";
  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8 text-slate-900">
      <h1 className="text-3xl font-bold">{t("onboarding.title")}</h1>
      <p className="text-slate-700">{t("onboarding.intro")}</p>
      {error && (
        <p role="alert" className="text-red-700">
          {error === "logo"
            ? t("onboarding.errLogo")
            : t("onboarding.errGeneric")}
        </p>
      )}
      <form
        method="post"
        action="/api/onboarding"
        encType="multipart/form-data"
        className="max-w-md space-y-4"
      >
        <label className="block text-sm font-medium">
          {t("onboarding.companyName")}
          <input
            name="companyName"
            required
            minLength={2}
            maxLength={120}
            defaultValue={company.name}
            className={field}
          />
        </label>
        <label className="block text-sm font-medium">
          {t("onboarding.industry")}
          <select
            name="industry"
            required
            defaultValue={company.industry ?? ""}
            className={field}
          >
            <option value="" disabled>
              {t("onboarding.industryPlaceholder")}
            </option>
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>
                {t(`industry.${i}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          {t("onboarding.logo")}
          <input
            name="logo"
            type="file"
            accept="image/png,image/jpeg"
            className={field}
          />
          <span className="text-xs font-normal text-slate-600">
            {t("onboarding.logoHint")}
          </span>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white"
        >
          {t("onboarding.submit")}
        </button>
      </form>
    </main>
  );
}
