import { redirect } from "next/navigation";
import { getTenant } from "@/lib/auth/tenant";
import { getDb } from "@/lib/db/client";
import { getCompany } from "@/lib/db/tenant";
import { COUNTRY_LOCALE, getT } from "@/lib/i18n";
import type { Country } from "@/lib/countries";

// Phase 2 stub: proves the session gate and shows tenant-scoped data. Real dashboard is phase 4.
export default async function Dashboard() {
  const tenant = await getTenant();
  if (!tenant) redirect("/login");
  const company = await getCompany(getDb(), tenant.companyId);
  if (!company) redirect("/login");
  if (!company.onboardingCompletedAt) redirect("/onboarding");
  const t = getT(COUNTRY_LOCALE[company.country as Country] ?? "en");
  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-bold">{t("dashboard.title")}</h1>
      <p className="font-medium">{company.name}</p>
      <p className="text-slate-700">{t("dashboard.placeholder")}</p>
    </div>
  );
}
