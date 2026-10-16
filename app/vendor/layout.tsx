import type { ReactNode } from "react";
import { RootDoc } from "@/components/RootDoc";

// Root layout for the tokenized vendor questionnaire. Deliberately NOT the marketing layout (no
// consent banner, no UTM, no analytics), and it reads no cookies, headers or client address:
// nothing under app/vendor identifies the person filling the form (scripts/check-vendor-privacy.sh).
export const dynamic = "force-dynamic";
export const metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function VendorLayout({ children }: { children: ReactNode }) {
  return <RootDoc lang="pt-BR">{children}</RootDoc>;
}
