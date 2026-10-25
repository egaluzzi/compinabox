import type { ReactNode } from "react";
import "@/app/globals.css";
import { isStaging, stagingBannerText } from "@/lib/env";

/**
 * The <html>/<body> shell, shared by every root layout (marketing, visitor, dashboard/onboarding,
 * employee, vendor, report). The staging banner lives here so no page type can miss it. It reads
 * APP_ENV per request (every root layout is force-dynamic) and never renders elsewhere.
 */
export function RootDoc({
  lang,
  children,
}: {
  lang: string;
  children: ReactNode;
}) {
  return (
    <html lang={lang}>
      <body className="bg-white antialiased">
        {isStaging() && (
          <div
            role="note"
            data-staging-banner=""
            className="bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-slate-900"
          >
            {stagingBannerText(lang)}
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
