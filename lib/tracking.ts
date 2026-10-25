// Conversion tracking (SPEC §10, phase 9): Google Tag Manager, loaded only after cookie consent,
// never on private paths, never on staging. Everything here is inert unless ALL of these hold:
// a real GTM_ID, APP_ENV is not staging, the visitor accepted cookies, and the path is public.

type Env = Record<string, string | undefined>;

export const GTM_ID_RE = /^GTM-[A-Z0-9]{4,12}$/;

/** The container id for this request, or null (unset, `changeme`, malformed, or staging). */
export function resolveGtmId(env: Env = process.env): string | null {
  if ((env.APP_ENV ?? "").trim().toLowerCase() === "staging") return null;
  const id = (env.GTM_ID ?? "").trim();
  return GTM_ID_RE.test(id) ? id : null;
}

/** Private or tokenized areas: no tracking there, whatever the consent. */
export const EXCLUDED_PREFIXES = [
  "/report",
  "/dashboard",
  "/employee",
  "/vendor",
  "/login",
  "/onboarding",
  "/dev-outbox",
] as const;

export function isTrackablePath(pathname: string): boolean {
  return !EXCLUDED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** Exactly these payloads; nothing identifying (no e-mail, name, tax id, attempt or company id). */
export type TrackingEvent =
  | { event: "view_pricing" }
  | { event: "begin_checkout" }
  | { event: "purchase"; value: number; currency: string }
  | { event: "lead_generic_country_waitlist" };

const ALLOWED_KEYS: Record<TrackingEvent["event"], readonly string[]> = {
  view_pricing: ["event"],
  begin_checkout: ["event"],
  purchase: ["event", "value", "currency"],
  lead_generic_country_waitlist: ["event"],
};

export const CONSENT_CHANGED = "complystart:consent-changed";
export const OPEN_CONSENT = "complystart:open-consent";

type TrackingWindow = Window & {
  dataLayer?: Record<string, unknown>[];
  __tracking?: { active: boolean };
};

function consentAccepted(): boolean {
  return document.cookie.split("; ").some((c) => c === "consent=accepted");
}

/**
 * Pushes one event, only while tracking is active (container loaded), consent is still accepted
 * (checked on every call, so a withdrawal stops the next push) and the path is public.
 */
export function trackEvent(e: TrackingEvent): boolean {
  if (typeof window === "undefined") return false;
  const w = window as TrackingWindow;
  if (!w.__tracking?.active) return false;
  if (!consentAccepted() || !isTrackablePath(window.location.pathname))
    return false;
  const clean: Record<string, unknown> = {};
  for (const k of ALLOWED_KEYS[e.event]) {
    clean[k] = (e as Record<string, unknown>)[k];
  }
  (w.dataLayer ??= []).push(clean);
  return true;
}

/** Marks tracking on/off and, when turning on, injects the GTM container once. */
export function setTrackingActive(gtmId: string, active: boolean): void {
  const w = window as TrackingWindow;
  w.__tracking = { active };
  if (!active) return;
  if (document.querySelector(`script[data-gtm="${gtmId}"]`)) return;
  const dl = (w.dataLayer ??= []);
  dl.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const s = document.createElement("script");
  s.async = true;
  s.dataset.gtm = gtmId;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`;
  document.head.appendChild(s);
}
