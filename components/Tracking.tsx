"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  CONSENT_CHANGED,
  isTrackablePath,
  setTrackingActive,
  trackEvent,
  type TrackingEvent,
} from "@/lib/tracking";

function accepted(): boolean {
  return document.cookie.split("; ").some((c) => c === "consent=accepted");
}

/**
 * Loads the GTM container after consent, on public paths only. `gtmId` is null (renders nothing,
 * does nothing) without a real GTM_ID or on staging — decided on the server (resolveGtmId).
 */
export function Tracking({ gtmId }: { gtmId: string | null }) {
  const pathname = usePathname();
  useEffect(() => {
    if (!gtmId) return;
    const sync = () =>
      setTrackingActive(gtmId, accepted() && isTrackablePath(pathname));
    sync();
    window.addEventListener(CONSENT_CHANGED, sync);
    return () => window.removeEventListener(CONSENT_CHANGED, sync);
  }, [gtmId, pathname]);
  return null;
}

/** Fires one event when it mounts (e.g. the pricing page). */
export function TrackOnMount({ event }: { event: TrackingEvent }) {
  useEffect(() => {
    // The loader (a sibling later in the tree) activates tracking in the same commit, after this
    // effect: retry once on the next tick. Nothing is queued across a consent that never comes.
    if (trackEvent(event)) return;
    const timer = setTimeout(() => trackEvent(event), 0);
    return () => clearTimeout(timer);
    // the event object is a constant for the page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
