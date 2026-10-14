"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

/** Client component only for the active state: layouts don't re-render on client navigation. */
export function DashboardNav({
  items,
  label,
}: {
  items: NavItem[];
  label: string;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <nav aria-label={label}>
      <ul className="grid grid-cols-2 gap-1 sm:grid-cols-4 md:grid-cols-1">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded px-3 py-2 text-sm ${
                  active
                    ? "bg-slate-900 font-semibold text-white"
                    : "text-slate-800 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
