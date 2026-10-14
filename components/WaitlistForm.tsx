"use client";

import { useState, type FormEvent } from "react";

type Props = {
  /** Fixed country code for localized pages; null on `/`, where visitors type their own. */
  country: string | null;
  labels: {
    intro: string;
    email: string;
    country: string;
    submit: string;
    success: string;
    invalid: string;
    error: string;
  };
};

export function WaitlistForm({ country, labels }: Props) {
  const [status, setStatus] = useState<
    "idle" | "sending" | "success" | "invalid" | "error"
  >("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setStatus("sending");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.get("email"),
          country: country ?? data.get("country"),
          website: data.get("website"),
        }),
      });
      setStatus(res.ok ? "success" : res.status === 422 ? "invalid" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p role="status" className="font-medium text-green-700">
        {labels.success}
      </p>
    );
  }

  const input = "w-full rounded border border-slate-300 px-3 py-2";
  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <p className="text-slate-700">{labels.intro}</p>
      <label className="block text-sm">
        <span className="mb-1 block">{labels.email}</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className={input}
        />
      </label>
      {country === null && (
        <label className="block text-sm">
          <span className="mb-1 block">{labels.country}</span>
          <input type="text" name="country" maxLength={60} className={input} />
        </label>
      )}
      {/* honeypot: hidden from people, tempting to bots */}
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {labels.submit}
      </button>
      {status === "invalid" && (
        <p role="alert" className="text-sm text-red-700">
          {labels.invalid}
        </p>
      )}
      {status === "error" && (
        <p role="alert" className="text-sm text-red-700">
          {labels.error}
        </p>
      )}
    </form>
  );
}
