"use client";

import Link from "next/link";
import { setCookie } from "@/lib/cookies";

/** Sets country=other ("show me the picker") and goes to `/`. */
export function ChangeCountry({ label }: { label: string }) {
  return (
    <Link
      href="/"
      prefetch={false}
      onClick={() => setCookie("country", "other")}
      className="text-sm text-slate-600 underline hover:text-slate-900"
    >
      {label}
    </Link>
  );
}
