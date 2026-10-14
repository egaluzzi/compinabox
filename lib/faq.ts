import type { T } from "./i18n";

export type FaqItem = { q: string; a: string };

export function sharedFaq(t: T): FaqItem[] {
  return [
    { q: t("faq.q1"), a: t("faq.a1") },
    { q: t("faq.q2"), a: t("faq.a2") },
    { q: t("faq.q3"), a: t("faq.a3") },
    { q: t("faq.q4"), a: t("faq.a4") },
    { q: t("faq.q5"), a: t("faq.a5") },
  ];
}

/** Country-specific items first, then the shared ones (CONTENT.md §5). */
export function countryFaq(t: T): FaqItem[] {
  return [
    { q: t("landing.faq.q1"), a: t("landing.faq.a1") },
    { q: t("landing.faq.q2"), a: t("landing.faq.a2") },
    ...sharedFaq(t),
  ];
}
