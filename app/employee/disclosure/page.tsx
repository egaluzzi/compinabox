import Link from "next/link";
import { PortalShell } from "@/components/employee/PortalShell";
import { getDb } from "@/lib/db/client";
import { formatDate } from "@/lib/dashboard/format";
import {
  disclosureYear,
  MAX_DISCLOSURE_DETAILS,
} from "@/lib/employee/constants";
import { hasDisclosedThisYear } from "@/lib/employee/disclosure";
import { requireEmployee } from "@/lib/employee/require-employee";

export default async function DisclosurePage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const ctx = await requireEmployee();
  const { me, locale, t } = ctx;
  const { result } = await searchParams;
  const year = disclosureYear();
  const done = await hasDisclosedThisYear(getDb(), me);
  const input = "w-full rounded border border-slate-400 px-3 py-2";
  return (
    <PortalShell ctx={ctx}>
      <Link href="/employee" className="text-sm underline">
        {t("employee.back")}
      </Link>
      <h1 className="text-2xl font-bold">
        {t("employee.disclosureHeading", { year })}
      </h1>
      {result === "submitted" && (
        <p role="status" className="text-green-800">
          {t("employee.disclosureThanks", { year })}
        </p>
      )}
      {(result === "already" || (done && result !== "submitted")) && (
        <p role="status">
          {t("employee.disclosureAlready", { year })}
          {done ? ` (${formatDate(done, locale)})` : ""}
        </p>
      )}
      {result === "invalid" && (
        <p role="alert" className="text-red-700">
          {t("employee.disclosureError", { max: MAX_DISCLOSURE_DETAILS })}
        </p>
      )}
      {!done && (
        <form
          method="post"
          action="/employee/api/disclosure"
          className="space-y-4"
        >
          <p className="text-slate-700">{t("employee.disclosureIntro")}</p>
          <fieldset className="space-y-2">
            <label className="flex items-center gap-2">
              <input type="radio" name="choice" value="none" required />
              {t("employee.disclosureNone")}
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="choice" value="some" required />
              {t("employee.disclosureSome")}
            </label>
          </fieldset>
          <label className="block text-sm font-medium">
            {t("employee.disclosureDetails")}
            <textarea
              name="details"
              rows={6}
              maxLength={MAX_DISCLOSURE_DETAILS}
              className={`${input} mt-1 font-normal`}
            />
          </label>
          <button className="rounded bg-slate-900 px-4 py-2 font-medium text-white">
            {t("employee.disclosureSubmit")}
          </button>
        </form>
      )}
    </PortalShell>
  );
}
