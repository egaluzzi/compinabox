import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getT, localeFromCookies } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

const DOCS = {
  terms: "footer.terms",
  privacy: "footer.privacy",
  disclaimer: "footer.disclaimerLink",
} as const;
type Doc = keyof typeof DOCS;

function isDoc(value: string): value is Doc {
  return value in DOCS;
}

type Props = { params: Promise<{ doc: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { doc } = await params;
  if (!isDoc(doc)) return {};
  const jar = await cookies();
  const t = getT(localeFromCookies((n) => jar.get(n)?.value));
  return pageMetadata({
    title: `${t(DOCS[doc])} | ${t("brand.name")}`,
    description: t("meta.home.description"),
    canonical: `/legal/${doc}`,
    noindex: true,
  });
}

// Placeholders only: no substantive legal text until reviewed (SPEC §11).
export default async function LegalPage({ params }: Props) {
  const { doc } = await params;
  if (!isDoc(doc)) notFound();
  const jar = await cookies();
  const t = getT(localeFromCookies((n) => jar.get(n)?.value));
  return (
    <article className="max-w-3xl space-y-4">
      <p className="inline-block rounded bg-amber-100 px-2 py-1 text-sm font-semibold text-amber-900">
        {t("legal.draft")}
      </p>
      <h1 className="text-3xl font-bold">{t(DOCS[doc])}</h1>
      {doc === "disclaimer" && (
        <p className="text-slate-700">{t("footer.disclaimer")}</p>
      )}
    </article>
  );
}
