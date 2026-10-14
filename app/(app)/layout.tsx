import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { RootDoc } from "@/components/RootDoc";
import { sessionLocale } from "@/lib/auth/require-tenant";
import { localeFromCookies } from "@/lib/i18n";

// Root layout for the authenticated app (dashboard, onboarding). Always dynamic: per-user.
// <html lang> follows the company's country locale; each page supplies its own <main>.
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  const locale =
    (await sessionLocale()) ?? localeFromCookies((n) => jar.get(n)?.value);
  return <RootDoc lang={locale}>{children}</RootDoc>;
}
