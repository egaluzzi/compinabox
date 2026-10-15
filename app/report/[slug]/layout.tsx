import type { ReactNode } from "react";
import { RootDoc } from "@/components/RootDoc";
import { loadPublicCompany } from "@/lib/whistleblower/public-company";

// Root layout for the public whistleblower channel. Deliberately NOT the marketing layout: no
// consent banner, no UTM capture, no analytics, no third-party requests, no cookies read or set.
// <html lang> is the company's country locale. Unknown slug -> 404.
export const dynamic = "force-dynamic";

export default async function ReportLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { locale } = await loadPublicCompany(slug);
  return <RootDoc lang={locale}>{children}</RootDoc>;
}
