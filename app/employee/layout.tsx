import type { ReactNode } from "react";
import { RootDoc } from "@/components/RootDoc";
import { employeeLocale } from "@/lib/employee/require-employee";

// Root layout for the tokenized employee portal. Always dynamic: per-employee. Deliberately NOT
// the marketing layout (no consent banner, no UTM, no analytics). It does not gate: every page
// and handler calls requireEmployee() itself (tests/employee-gate.test.ts).
export const dynamic = "force-dynamic";
export const metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function EmployeeLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <RootDoc lang={(await employeeLocale()) ?? "en"}>{children}</RootDoc>;
}
