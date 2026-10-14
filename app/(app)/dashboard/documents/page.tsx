import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenant } from "@/lib/auth/tenant";
import { getDb } from "@/lib/db/client";
import { getCompany } from "@/lib/db/tenant";
import { DOCUMENT_TYPES, type DocumentType } from "@/lib/documents/types";
import { listDocuments } from "@/lib/documents/store";
import { COUNTRY_LOCALE, getT } from "@/lib/i18n";
import type { Country } from "@/lib/countries";

const TYPE_KEY = {
  code_of_conduct: "codeOfConduct",
  "policy:anti_bribery": "antiBribery",
  "policy:gifts_hospitality": "giftsHospitality",
  "policy:conflicts_of_interest": "conflictsOfInterest",
  "policy:third_party_public_officials": "thirdPartyPublicOfficials",
  "policy:whistleblower_protection": "whistleblowerProtection",
} as const satisfies Record<DocumentType, string>;

// Minimal Phase 3 page; phase 4 builds the dashboard shell around it.
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ regenerated?: string; error?: string }>;
}) {
  const tenant = await getTenant();
  if (!tenant) redirect("/login");
  const db = getDb();
  const company = await getCompany(db, tenant.companyId);
  if (!company) redirect("/login");
  if (!company.onboardingCompletedAt) redirect("/onboarding");
  const t = getT(COUNTRY_LOCALE[company.country as Country] ?? "en");
  const { regenerated, error } = await searchParams;
  const rows = await listDocuments(db, tenant.companyId);
  const date = (d: Date) =>
    d.toLocaleDateString(COUNTRY_LOCALE[company.country as Country] ?? "en", {
      timeZone: "America/Sao_Paulo",
    });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("documents.title")}</h1>
      <p className="text-slate-700">{t("documents.intro")}</p>
      <p className="text-sm text-slate-600">{t("documents.languageNote")}</p>
      <p className="text-sm font-semibold text-amber-800">{t("legal.draft")}</p>
      {regenerated && (
        <p role="status" className="text-slate-800">
          {regenerated === "created"
            ? t("documents.created")
            : t("documents.unchanged")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {t("documents.errRegenerate")}
        </p>
      )}
      {rows.length === 0 ? (
        <p>{t("documents.empty")}</p>
      ) : (
        <>
          <ul className="space-y-5">
            {DOCUMENT_TYPES.map((type) => {
              const versions = rows.filter((r) => r.type === type);
              if (versions.length === 0) return null;
              return (
                <li key={type} className="rounded border border-slate-200 p-4">
                  <h2 className="text-lg font-semibold">
                    {t(`documents.types.${TYPE_KEY[type]}`)}
                  </h2>
                  <ul className="mt-2 space-y-1">
                    {versions.map((v, i) => (
                      <li key={v.id} className="flex flex-wrap gap-3 text-sm">
                        <span>
                          {t("documents.version", { n: v.version })}
                          {i === 0 && ` (${t("documents.current")})`} ·{" "}
                          {t("documents.generatedOn", {
                            date: date(v.generatedAt),
                          })}
                        </span>
                        <Link
                          className="underline"
                          href={`/dashboard/documents/${v.id}`}
                        >
                          {t("documents.view")}
                        </Link>
                        <a
                          className="underline"
                          href={`/dashboard/documents/${v.id}/pdf`}
                        >
                          {t("documents.download")}
                        </a>
                      </li>
                    ))}
                  </ul>
                  <form
                    method="post"
                    action="/api/documents/regenerate"
                    className="mt-3"
                  >
                    <input type="hidden" name="type" value={type} />
                    <button className="rounded border border-slate-400 px-3 py-1 text-sm">
                      {t("documents.regenerate")}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
          <form method="post" action="/api/documents/regenerate">
            <input type="hidden" name="type" value="all" />
            <button className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white">
              {t("documents.regenerateAll")}
            </button>
            <p className="mt-2 text-sm text-slate-600">
              {t("documents.regenerateHint")}
            </p>
          </form>
        </>
      )}
    </div>
  );
}
