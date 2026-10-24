import type { Metadata } from "next";
import { ReportForm } from "@/components/report/ReportForm";
import {
  REPORT_CATEGORIES,
  MAX_DESCRIPTION,
} from "@/lib/whistleblower/constants";
import { loadPublicCompany } from "@/lib/whistleblower/public-company";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { company, t } = await loadPublicCompany((await params).slug);
  return {
    title: t("report.title", { company: company.name }),
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { company, t } = await loadPublicCompany(slug);
  const errors = {
    category: t("report.errors.category"),
    description: t("report.errors.description"),
    contact: t("report.errors.contact"),
    too_many_files: t("report.errors.too_many_files"),
    file_too_large: t("report.errors.file_too_large"),
    file_type: t("report.errors.file_type"),
    file_invalid: t("report.errors.file_invalid"),
    rate_limited: t("report.errors.rate_limited"),
    server_error: t("report.errors.server_error"),
    network: t("report.errors.network"),
  };
  return (
    <main
      id="main"
      className="mx-auto max-w-2xl space-y-6 px-4 py-10 text-slate-900"
    >
      <header className="space-y-3">
        {company.logoFile && (
          // eslint-disable-next-line @next/next/no-img-element -- served by our own /uploads route
          <img
            src={`/uploads/${company.logoFile}`}
            alt={t("report.logoAlt", { company: company.name })}
            className="h-12 w-auto max-w-[12rem] object-contain"
          />
        )}
        <h1 className="text-3xl font-bold">
          {t("report.title", { company: company.name })}
        </h1>
        <p className="text-slate-800">
          {t("report.intro", { company: company.name })}
        </p>
      </header>
      <ReportForm
        slug={slug}
        maxDescription={MAX_DESCRIPTION}
        labels={{
          categoryLabel: t("report.categoryLabel"),
          categoryPlaceholder: t("report.categoryPlaceholder"),
          categories: REPORT_CATEGORIES.map((c) => ({
            value: c,
            label: t(`report.categories.${c}`),
          })),
          descriptionLabel: t("report.descriptionLabel"),
          descriptionHelp: t("report.descriptionHelp", {
            max: MAX_DESCRIPTION,
          }),
          evidenceLabel: t("report.evidenceLabel"),
          evidenceHelp: t("report.evidenceHelp"),
          contactQuestion: t("report.contactQuestion"),
          contactYes: t("report.contactYes"),
          contactNo: t("report.contactNo"),
          contactLabel: t("report.contactLabel"),
          contactHelp: t("report.contactHelp"),
          submit: t("report.submit"),
          submitting: t("report.submitting"),
          confirmed: t("report.confirmed"),
          saveCode: t("report.saveCode"),
          statusLink: t("report.statusLink"),
          errors,
        }}
      />
      <p className="text-sm">
        <a
          className="underline"
          href={`/report/${encodeURIComponent(slug)}/status`}
        >
          {t("report.statusLink")}
        </a>
      </p>
    </main>
  );
}
