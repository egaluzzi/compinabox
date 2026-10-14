import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { RootDoc } from "@/components/RootDoc";
import { SiteShell } from "@/components/SiteShell";
import { isCountry } from "@/lib/countries";
import { COUNTRY_LOCALE } from "@/lib/i18n";

// ENABLED_COUNTRIES is read per request (CLAUDE.md §9), so these pages are never prerendered.
export const dynamic = "force-dynamic";

export default async function CountryLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ country: string }>;
}) {
  const { country } = await params;
  if (!isCountry(country)) notFound();
  const locale = COUNTRY_LOCALE[country];
  return (
    <RootDoc lang={locale}>
      <SiteShell locale={locale} country={country}>
        {children}
      </SiteShell>
    </RootDoc>
  );
}
