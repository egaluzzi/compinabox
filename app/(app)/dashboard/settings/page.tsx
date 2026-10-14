import Link from "next/link";
import { requireTenant } from "@/lib/auth/require-tenant";
import { getDb } from "@/lib/db/client";
import { getTenantUser } from "@/lib/db/tenant";
import { INDUSTRIES } from "@/lib/industries";

export default async function Settings({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { tenant, company, t } = await requireTenant();
  const user = await getTenantUser(getDb(), tenant.companyId, tenant.userId);
  const { saved, error } = await searchParams;
  const field = "mt-1 w-full rounded border border-slate-300 px-3 py-2";
  const dt = "text-sm font-medium text-slate-700";
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("dashboard.nav.settings")}</h1>
      {saved && (
        <p role="status" className="rounded bg-slate-100 p-3">
          {t("dashboard.settings.savedNotice")}{" "}
          <Link className="underline" href="/dashboard/documents">
            {t("dashboard.settings.savedLink")}
          </Link>
        </p>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error === "logo"
            ? t("onboarding.errLogo")
            : t("onboarding.errGeneric")}
        </p>
      )}
      <form
        method="post"
        action="/dashboard/settings/save"
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
        <div className="space-y-2">
          <p className={dt}>{t("dashboard.settings.currentLogo")}</p>
          {company.logoFile ? (
            // eslint-disable-next-line @next/next/no-img-element -- served by our own /uploads route
            <img
              src={`/uploads/${company.logoFile}`}
              alt={t("dashboard.logoAlt", { name: company.name })}
              className="h-12 w-auto max-w-[12rem] object-contain"
            />
          ) : (
            <p className="text-sm text-slate-600">
              {t("dashboard.settings.noLogo")}
            </p>
          )}
          <label className="block text-sm font-medium">
            {t("dashboard.settings.replaceLogo")}
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
        </div>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white"
        >
          {t("dashboard.settings.save")}
        </button>
      </form>
      <section aria-labelledby="account-h" className="max-w-md space-y-3">
        <h2 id="account-h" className="text-lg font-semibold">
          {t("dashboard.settings.account")}
        </h2>
        <p className="text-sm text-slate-600">
          {t("dashboard.settings.readOnlyNote")}
        </p>
        <dl className="space-y-2">
          <div>
            <dt className={dt}>{t("dashboard.settings.taxId")}</dt>
            <dd>{company.taxId}</dd>
          </div>
          <div>
            <dt className={dt}>{t("dashboard.settings.country")}</dt>
            <dd>
              {t(
                `dashboard.settings.countries.${company.country as "ar" | "br" | "mx"}`,
              )}
            </dd>
          </div>
          <div>
            <dt className={dt}>{t("dashboard.settings.adminEmail")}</dt>
            <dd>{user?.email}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
