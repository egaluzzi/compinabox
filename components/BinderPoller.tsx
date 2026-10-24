"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Polls the status of the running dossier job (backoff 2 s -> 15 s) and refreshes the page when it
// is ready or failed. Without JS the page carries a plain "refresh" link instead.
export function BinderPoller({ id }: { id: string }) {
  const router = useRouter();
  useEffect(() => {
    let stopped = false;
    let delay = 2000;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch(
          `/dashboard/binder/status?id=${encodeURIComponent(id)}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const body = (await res.json()) as { status: string };
          if (body.status === "ready" || body.status === "failed") {
            router.refresh();
            return;
          }
        }
      } catch {
        // offline or restarting: try again
      }
      if (stopped) return;
      delay = Math.min(Math.round(delay * 1.5), 15000);
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, delay);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [id, router]);
  return null;
}
