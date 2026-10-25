import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getT, localeFromCookies } from "@/lib/i18n";
import { PRIVACY_DOC } from "@/lib/legal/privacy";
import { TERMS_DOC } from "@/lib/legal/terms";
import { PLACEHOLDER_RE, type LegalDoc } from "@/lib/legal/types";
import {
  LEGAL_VERSION_DATE,
  PRIVACY_VERSION,
  TERMS_VERSION,
} from "@/lib/legal/version";
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

/** Text with every visible placeholder highlighted, so nothing can be mistaken for a real value. */
function WithPlaceholders({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(PLACEHOLDER_RE)) {
    parts.push(text.slice(last, m.index));
    parts.push(
      <mark
        key={m.index}
        data-placeholder=""
        className="rounded bg-amber-200 px-1 text-slate-900"
      >
        {m[0]}
      </mark>,
    );
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

function DocBody({ doc }: { doc: LegalDoc }) {
  return (
    <div className="space-y-6 text-slate-800">
      {doc.intro.map((p) => (
        <p key={p}>
          <WithPlaceholders text={p} />
        </p>
      ))}
      {doc.sections.map((s) => (
        <section key={s.heading} className="space-y-2">
          <h2 className="text-xl font-semibold">{s.heading}</h2>
          {s.paragraphs?.map((p) => (
            <p key={p}>
              <WithPlaceholders text={p} />
            </p>
          ))}
          {s.bullets && (
            <ul className="list-disc space-y-1 pl-6">
              {s.bullets.map((b) => (
                <li key={b}>
                  <WithPlaceholders text={b} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

// Drafted by the team from what the product does (lib/legal/REVIEW.md); not yet reviewed by a
// lawyer. The body exists in Portuguese only (Brazil is the first market); the chrome follows the
// visitor's language.
export default async function LegalPage({ params }: Props) {
  const { doc } = await params;
  if (!isDoc(doc)) notFound();
  const jar = await cookies();
  const locale = localeFromCookies((n) => jar.get(n)?.value);
  const t = getT(locale);
  const body =
    doc === "terms" ? TERMS_DOC : doc === "privacy" ? PRIVACY_DOC : null;
  const version = doc === "terms" ? TERMS_VERSION : PRIVACY_VERSION;
  return (
    <article className="max-w-3xl space-y-4">
      <p className="inline-block rounded bg-amber-100 px-2 py-1 text-sm font-semibold text-amber-900">
        {t("legal.draft")}
      </p>
      <h1 className="text-3xl font-bold">{t(DOCS[doc])}</h1>
      {doc === "disclaimer" && (
        <p className="text-slate-700">{t("footer.disclaimer")}</p>
      )}
      {body && (
        <>
          {locale !== "pt-BR" && (
            <p className="text-sm text-slate-600">{t("legal.ptOnly")}</p>
          )}
          <p className="text-sm text-slate-600">{t("legal.placeholders")}</p>
          <div lang="pt-BR">
            <DocBody doc={body} />
          </div>
          <p className="border-t border-slate-200 pt-3 text-sm text-slate-600">
            {t("legal.version")}: {version} · {LEGAL_VERSION_DATE}
          </p>
        </>
      )}
    </article>
  );
}
