import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { RootDoc } from "@/components/RootDoc";
import { SiteShell, langOf } from "@/components/SiteShell";
import { localeFromCookies } from "@/lib/i18n";

// Root layout for pages with no country in the URL: language comes from cookies.
export const dynamic = "force-dynamic";

export default async function VisitorLayout({
  children,
}: {
  children: ReactNode;
}) {
  const jar = await cookies();
  const locale = localeFromCookies((n) => jar.get(n)?.value);
  return (
    <RootDoc lang={locale}>
      <SiteShell locale={locale} lang={langOf(locale)}>
        {children}
      </SiteShell>
    </RootDoc>
  );
}
