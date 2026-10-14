import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DocumentView } from "@/components/DocumentView";
import { getTenant } from "@/lib/auth/tenant";
import { getDb } from "@/lib/db/client";
import { getCompany } from "@/lib/db/tenant";
import { parseDocument } from "@/lib/documents/generate";
import { getDocument } from "@/lib/documents/store";
import { isUuid } from "@/lib/http";
import { COUNTRY_LOCALE, getT } from "@/lib/i18n";
import type { Country } from "@/lib/countries";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tenant = await getTenant();
  if (!tenant) redirect("/login");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const db = getDb();
  const company = await getCompany(db, tenant.companyId);
  if (!company) redirect("/login");
  // Another company's document is indistinguishable from a missing one: 404, not 403.
  const row = await getDocument(db, tenant.companyId, id);
  if (!row) notFound();
  const doc = parseDocument(row.content);
  const t = getT(COUNTRY_LOCALE[company.country as Country] ?? "en");
  return (
    <div className="space-y-5">
      <Link href="/dashboard/documents" className="text-sm underline">
        {t("documents.backToList")}
      </Link>
      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700">
        <span>
          {t("documents.version", { n: row.version })} ·{" "}
          {t("documents.generatedOn", {
            date: row.generatedAt.toLocaleDateString(doc.locale, {
              timeZone: "America/Sao_Paulo",
            }),
          })}
        </span>
        <a className="underline" href={`/dashboard/documents/${row.id}/pdf`}>
          {t("documents.download")}
        </a>
      </div>
      {doc.reviewStatus === "draft" && (
        <p className="text-sm font-semibold text-amber-800">
          {t("legal.draft")}
        </p>
      )}
      <DocumentView doc={doc} />
      <p className="border-t border-slate-200 pt-3 text-xs text-slate-600">
        {t("footer.disclaimer")}
      </p>
    </div>
  );
}
