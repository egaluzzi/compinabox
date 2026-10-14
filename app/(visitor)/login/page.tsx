import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { getT, localeFromCookies } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requestLink(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) redirect("/login?invalid=1");
  // Same outcome for known and unknown emails (see auth.ts sendVerificationRequest).
  await signIn("email", { email, redirect: false, redirectTo: "/dashboard" });
  redirect("/login?sent=1");
}

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const jar = await cookies();
  const t = getT(localeFromCookies((n) => jar.get(n)?.value));
  const note = sp.sent
    ? t("login.sent")
    : sp.invalid
      ? t("login.invalid")
      : sp.error
        ? t("login.error")
        : null;
  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-3xl font-bold">{t("login.title")}</h1>
      {note && (
        <p role="status" className="text-slate-700">
          {note}
        </p>
      )}
      <form action={requestLink} className="space-y-3">
        <label className="block text-sm font-medium">
          {t("login.emailLabel")}
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white"
        >
          {t("login.submit")}
        </button>
      </form>
    </div>
  );
}
