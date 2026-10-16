import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentView } from "@/components/DocumentView";
import { PortalShell } from "@/components/employee/PortalShell";
import { formatDate } from "@/lib/dashboard/format";
import { getDb } from "@/lib/db/client";
import { parseDocument } from "@/lib/documents/generate";
import { getPortalDocument } from "@/lib/employee/acknowledge";
import { requireEmployee } from "@/lib/employee/require-employee";
import { isUuid } from "@/lib/http";
import { acknowledgments } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export default async function EmployeeDocument({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireEmployee();
  const { me, locale, t } = ctx;
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const db = getDb();
  // Another company's document is indistinguishable from a missing one: 404. The company is the
  // session's; the id from the URL is only a lookup key.
  const doc = await getPortalDocument(db, me, id);
  if (!doc) notFound();
  const back = (
    <Link href="/employee" className="text-sm underline">
      {t("employee.back")}
    </Link>
  );

  if (!doc.current)
    return (
      <PortalShell ctx={ctx}>
        {back}
        <h1 className="text-2xl font-bold">{t("employee.docOutdatedTitle")}</h1>
        <p>{t("employee.docOutdatedBody")}</p>
      </PortalShell>
    );

  const [ack] = await db
    .select({ at: acknowledgments.acceptedAt })
    .from(acknowledgments)
    .where(
      and(
        eq(acknowledgments.companyId, me.companyId),
        eq(acknowledgments.employeeId, me.employeeId),
        eq(acknowledgments.documentId, doc.row.id),
      ),
    );
  const content = parseDocument(doc.row.content);
  return (
    <PortalShell ctx={ctx}>
      {back}
      <DocumentView doc={content} />
      <section className="space-y-3 border-t border-slate-200 pt-4">
        {ack ? (
          <p role="status" className="font-medium text-green-800">
            {t("employee.docAlready", { date: formatDate(ack.at, locale) })}
          </p>
        ) : (
          <form
            method="post"
            action="/employee/api/acknowledge"
            className="space-y-3"
          >
            <input type="hidden" name="documentId" value={doc.row.id} />
            <p className="text-sm text-slate-700">
              {t("employee.docAcceptNotice")}
            </p>
            <button className="rounded bg-slate-900 px-4 py-2 font-medium text-white">
              {t("employee.docAccept")}
            </button>
          </form>
        )}
      </section>
    </PortalShell>
  );
}
