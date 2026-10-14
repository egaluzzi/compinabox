import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentView } from "@/components/DocumentView";
import { requireTenant } from "@/lib/auth/require-tenant";
import { formatDate } from "@/lib/dashboard/format";
import { getDb } from "@/lib/db/client";
import { parseDocument } from "@/lib/documents/generate";
import { getDocument } from "@/lib/documents/store";
import { isUuid } from "@/lib/http";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenant, locale, t } = await requireTenant();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const db = getDb();
  // Another company's document is indistinguishable from a missing one: 404, not 403.
  const row = await getDocument(db, tenant.companyId, id);
  if (!row) notFound();
  const doc = parseDocument(row.content);
  return (
    <div className="space-y-5">
      <Link href="/dashboard/documents" className="text-sm underline">
        {t("documents.backToList")}
      </Link>
      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700">
        <span>
          {t("documents.version", { n: row.version })} ·{" "}
          {t("documents.generatedOn", {
            date: formatDate(row.generatedAt, locale),
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
