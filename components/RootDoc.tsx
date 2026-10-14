import type { ReactNode } from "react";
import "@/app/globals.css";

/** The <html>/<body> shell, shared by the two root layouts. */
export function RootDoc({
  lang,
  children,
}: {
  lang: string;
  children: ReactNode;
}) {
  return (
    <html lang={lang}>
      <body className="bg-white antialiased">{children}</body>
    </html>
  );
}
