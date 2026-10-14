"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Labels = {
  pending: string;
  failed: string;
  expired: string;
  paid: string;
  retry: string;
  generic: string;
};
type State = { status: string; country?: string; signedIn?: boolean };

/** Polls the attempt status (the webhook may land after the browser). Never provisions anything. */
export function ReturnStatus({
  attempt,
  labels,
}: {
  attempt: string;
  labels: Labels;
}) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "pending" });

  useEffect(() => {
    let stop = false;
    let tries = 0;
    async function poll() {
      try {
        const res = await fetch(
          `/api/checkout/status?attempt=${encodeURIComponent(attempt)}`,
          { cache: "no-store" },
        );
        const body = (await res.json()) as State;
        if (stop) return;
        setState(body);
        if (body.status === "paid" && body.signedIn) {
          router.replace("/onboarding");
          return;
        }
        if (body.status === "pending" && ++tries < 90) setTimeout(poll, 2000);
      } catch {
        if (!stop && ++tries < 90) setTimeout(poll, 4000);
      }
    }
    void poll();
    return () => {
      stop = true;
    };
  }, [attempt, router]);

  const retry = (
    <a
      className="mt-3 inline-block rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white"
      href={`/checkout?c=${state.country ?? "br"}`}
    >
      {labels.retry}
    </a>
  );
  switch (state.status) {
    case "paid":
      return (
        <p role="status" className="text-slate-800">
          {labels.paid}
        </p>
      );
    case "failed":
      return (
        <div>
          <p role="alert" className="text-red-700">
            {labels.failed}
          </p>
          {retry}
        </div>
      );
    case "expired":
      return (
        <div>
          <p role="alert" className="text-red-700">
            {labels.expired}
          </p>
          {retry}
        </div>
      );
    case "unknown":
      return (
        <p role="alert" className="text-red-700">
          {labels.generic}
        </p>
      );
    default:
      return (
        <p role="status" className="text-slate-700">
          {labels.pending}
        </p>
      );
  }
}
