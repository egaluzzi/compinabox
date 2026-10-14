import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { RootDoc } from "@/components/RootDoc";
import { localeFromCookies } from "@/lib/i18n";

// Root layout for the authenticated app (dashboard, onboarding). Always dynamic: per-user.
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  const locale = localeFromCookies((n) => jar.get(n)?.value);
  return (
    <RootDoc lang={locale}>
      <main className="mx-auto w-full max-w-3xl px-4 py-8 text-slate-900">
        {children}
      </main>
    </RootDoc>
  );
}
