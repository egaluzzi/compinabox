// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/br/pricing";
const router = { replace: vi.fn() }; // stable: a new object per render would re-run the poll effect
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => router,
}));

import { ConsentBanner } from "@/components/ConsentBanner";
import { ReturnStatus } from "@/components/ReturnStatus";
import { TrackOnMount, Tracking } from "@/components/Tracking";
import {
  CONSENT_CHANGED,
  EXCLUDED_PREFIXES,
  isTrackablePath,
  resolveGtmId,
  trackEvent,
} from "@/lib/tracking";

type W = Window & { dataLayer?: unknown[]; __tracking?: unknown };
const w = window as W;
const ID = "GTM-TEST123";
const scripts = () =>
  document.querySelectorAll('script[src*="googletagmanager.com"]');
const setConsent = (v: string | null) => {
  document.cookie = `consent=${v ?? ""}; Path=/; Max-Age=${v ? 3600 : 0}`;
};
const events = () =>
  (w.dataLayer ?? []).filter(
    (e) => (e as { event?: string }).event !== "gtm.js",
  );

beforeEach(() => {
  pathname = "/br/pricing";
  window.history.pushState({}, "", "/br/pricing");
  setConsent(null);
  delete w.dataLayer;
  delete w.__tracking;
  document.head.innerHTML = "";
  sessionStorage.clear();
});
afterEach(() => cleanup());

describe("resolveGtmId", () => {
  it("accepts a real id only", () => {
    expect(resolveGtmId({ GTM_ID: "GTM-ABC1234" })).toBe("GTM-ABC1234");
    for (const bad of [
      undefined,
      "",
      "changeme",
      "G-ABC123",
      "GTM-",
      "gtm-abc1234",
      "GTM-<script>",
    ]) {
      expect(resolveGtmId({ GTM_ID: bad }), String(bad)).toBeNull();
    }
  });
  it("never on staging, even with a real id", () => {
    expect(resolveGtmId({ GTM_ID: ID, APP_ENV: "staging" })).toBeNull();
    expect(resolveGtmId({ GTM_ID: ID, APP_ENV: "production" })).toBe(ID);
    expect(resolveGtmId({ GTM_ID: ID })).toBe(ID);
  });
});

describe("paths", () => {
  it("excluded: report, dashboard, employee, vendor, login, onboarding, dev-outbox — and below", () => {
    for (const p of EXCLUDED_PREFIXES) {
      expect(isTrackablePath(p), p).toBe(false);
      expect(isTrackablePath(`${p}/x/y`), p).toBe(false);
    }
  });
  it("public: /, /br, /br/pricing, /checkout, /legal/privacy, and look-alikes like /reports-info", () => {
    for (const p of [
      "/",
      "/br",
      "/br/pricing",
      "/checkout",
      "/legal/privacy",
      "/reporting",
    ]) {
      expect(isTrackablePath(p), p).toBe(true);
    }
  });
});

describe("before consent", () => {
  it("no script tag and no dataLayer push, with a real id, on a public path", () => {
    render(<Tracking gtmId={ID} />);
    render(<TrackOnMount event={{ event: "view_pricing" }} />);
    expect(scripts()).toHaveLength(0);
    expect(w.dataLayer).toBeUndefined();
  });
  it("rejected is the same as no choice", () => {
    setConsent("rejected");
    render(<Tracking gtmId={ID} />);
    expect(scripts()).toHaveLength(0);
    expect(trackEvent({ event: "begin_checkout" })).toBe(false);
    expect(w.dataLayer).toBeUndefined();
  });
  it("without a GTM id nothing happens even with consent", () => {
    setConsent("accepted");
    render(<Tracking gtmId={null} />);
    expect(scripts()).toHaveLength(0);
    expect(trackEvent({ event: "begin_checkout" })).toBe(false);
  });
});

describe("after consent", () => {
  it("the script appears once and events reach the dataLayer", () => {
    setConsent("accepted");
    const { rerender } = render(<Tracking gtmId={ID} />);
    rerender(<Tracking gtmId={ID} />);
    expect(scripts()).toHaveLength(1);
    expect(scripts()[0].getAttribute("src")).toBe(
      `https://www.googletagmanager.com/gtm.js?id=${ID}`,
    );
    expect(trackEvent({ event: "begin_checkout" })).toBe(true);
    expect(events()).toEqual([{ event: "begin_checkout" }]);
  });
  it("accepting through the banner loads it (the choice is observed live)", () => {
    const { getByText } = render(
      <>
        <Tracking gtmId={ID} />
        <ConsentBanner text="t" accept="Accept" reject="Reject" />
      </>,
    );
    expect(scripts()).toHaveLength(0);
    act(() => getByText("Accept").click());
    expect(scripts()).toHaveLength(1);
  });
  it("view_pricing fires on mount of the pricing page marker, once tracking is active", async () => {
    setConsent("accepted");
    render(
      <>
        <TrackOnMount event={{ event: "view_pricing" }} />
        <Tracking gtmId={ID} />
      </>,
    );
    await new Promise((r) => setTimeout(r, 5));
    expect(events()).toEqual([{ event: "view_pricing" }]);
  });
  it("withdrawal: after switching the choice to rejected no further push happens", () => {
    setConsent("accepted");
    render(<Tracking gtmId={ID} />);
    expect(trackEvent({ event: "begin_checkout" })).toBe(true);
    setConsent("rejected");
    window.dispatchEvent(new Event(CONSENT_CHANGED));
    expect(trackEvent({ event: "begin_checkout" })).toBe(false);
    expect(trackEvent({ event: "lead_generic_country_waitlist" })).toBe(false);
    expect(events()).toHaveLength(1);
  });
  it("withdrawal without the event is still caught by the per-call cookie check", () => {
    setConsent("accepted");
    render(<Tracking gtmId={ID} />);
    setConsent("rejected");
    expect(trackEvent({ event: "begin_checkout" })).toBe(false);
  });
});

describe("excluded paths, even with consent", () => {
  for (const p of [
    "/dashboard",
    "/report/acme",
    "/employee/documents",
    "/vendor/abc",
    "/login",
    "/onboarding",
    "/dev-outbox",
  ]) {
    it(`${p}: no script, no push`, () => {
      pathname = p;
      setConsent("accepted");
      window.history.pushState({}, "", p);
      render(<Tracking gtmId={ID} />);
      expect(scripts()).toHaveLength(0);
      expect(trackEvent({ event: "begin_checkout" })).toBe(false);
      expect(w.dataLayer).toBeUndefined();
    });
  }
});

describe("payloads", () => {
  it("purchase carries event, value and currency only — extra keys are dropped", () => {
    setConsent("accepted");
    render(<Tracking gtmId={ID} />);
    const sneaky = {
      event: "purchase",
      value: 12.5,
      currency: "BRL",
      email: "a@b.test",
      attemptId: "x",
      companyId: "y",
      taxId: "1",
    } as never;
    expect(trackEvent(sneaky)).toBe(true);
    expect(events()).toEqual([
      { event: "purchase", value: 12.5, currency: "BRL" },
    ]);
  });
  it("the return page pushes purchase once, from the status response (value in units, no ids)", async () => {
    setConsent("accepted");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          status: "paid",
          country: "br",
          signedIn: false,
          amountCents: 9900,
          currency: "BRL",
        }),
      ),
    );
    window.history.pushState({}, "", "/checkout/return");
    pathname = "/checkout/return";
    render(
      <>
        <Tracking gtmId={ID} />
        <ReturnStatus
          attempt="attempt-id-123"
          labels={{
            pending: "p",
            failed: "f",
            expired: "e",
            paid: "paid!",
            retry: "r",
            generic: "g",
          }}
        />
      </>,
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(events()).toEqual([
      { event: "purchase", value: 99, currency: "BRL" },
    ]);
    expect(JSON.stringify(w.dataLayer)).not.toContain("attempt-id-123");
    vi.unstubAllGlobals();
  });
});
