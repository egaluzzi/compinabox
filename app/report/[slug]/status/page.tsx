import type { Metadata } from "next";
import { StatusLookup } from "@/components/report/StatusLookup";
import { loadPublicCompany } from "@/lib/whistleblower/public-company";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { company, t } = await loadPublicCompany((await params).slug);
  return {
    title: `${t("report.status.title")} — ${company.name}`,
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function StatusPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { company, t } = await loadPublicCompany(slug);
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
        <h1 className="text-3xl font-bold">{t("report.status.title")}</h1>
        <p className="text-slate-800">{t("report.status.intro")}</p>
      </header>
      <StatusLookup
        slug={slug}
        labels={{
          codeLabel: t("report.status.codeLabel"),
          submit: t("report.status.submit"),
          checking: t("report.status.checking"),
          resultStatus: t("report.status.resultStatus", { status: "{status}" }),
          resultDate: t("report.status.resultDate", { date: "{date}" }),
          notFound: t("report.status.notFound"),
          rateLimited: t("report.errors.rate_limited"),
          error: t("report.errors.server_error"),
        }}
      />
      <p className="text-sm">
        <a className="underline" href={`/report/${encodeURIComponent(slug)}`}>
          {t("report.status.back")}
        </a>
      </p>
    </main>
  );
}
