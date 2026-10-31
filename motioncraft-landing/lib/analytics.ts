// =========================================================================
// SERENITY STUDIO — CONVERSION TRACKING & EVENT ANALYTICS
// =========================================================================

export type AnalyticsEventType =
  | "page_visit"
  | "hero_cta_clicked"
  | "product_demo_clicked"
  | "workflow_step_inspected"
  | "screenshot_tab_switched"
  | "pricing_section_viewed"
  | "early_access_form_started"
  | "early_access_step1_completed"
  | "willingness_to_pay_selected"
  | "form_submitted"
  | "faq_toggled";

export interface AnalyticsPayload {
  event: AnalyticsEventType;
  properties?: Record<string, unknown>;
  timestamp?: string;
  url?: string;
  referrer?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  };
}

/**
 * Extracts UTM parameters and referrer from browser URL
 */
export function getTrackingContext() {
  if (typeof window === "undefined") {
    return {
      referrer: "",
      utm: {},
    };
  }

  const searchParams = new URLSearchParams(window.location.search);
  return {
    referrer: document.referrer || "direct",
    utm: {
      source: searchParams.get("utm_source") || undefined,
      medium: searchParams.get("utm_medium") || undefined,
      campaign: searchParams.get("utm_campaign") || undefined,
      content: searchParams.get("utm_content") || undefined,
      term: searchParams.get("utm_term") || undefined,
    },
  };
}

/**
 * Dispatches an analytics event to browser dataLayer, console, and optional backend API
 */
export function trackEvent(
  event: AnalyticsEventType,
  properties: Record<string, unknown> = {}
) {
  if (typeof window === "undefined") return;

  const trackingContext = getTrackingContext();
  const payload: AnalyticsPayload = {
    event,
    properties,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    referrer: trackingContext.referrer,
    utm: trackingContext.utm,
  };

  // 1. Log in dev console for instant verification
  if (process.env.NODE_ENV !== "production") {
    console.debug(`[Serenity Analytics] ${event}`, payload);
  }

  // 2. Window dataLayer integration (Google Tag Manager / GA4)
  const win = window as unknown as { dataLayer?: unknown[] };
  if (Array.isArray(win.dataLayer)) {
    win.dataLayer.push({
      event,
      ...properties,
      ...trackingContext.utm,
    });
  }

  // 3. Optional PostHog or Plausible integration if configured
  const winAny = window as unknown as {
    plausible?: (event: string, options?: { props: Record<string, unknown> }) => void;
    posthog?: { capture: (event: string, properties?: Record<string, unknown>) => void };
  };

  if (typeof winAny.plausible === "function") {
    winAny.plausible(event, { props: properties });
  }

  if (winAny.posthog && typeof winAny.posthog.capture === "function") {
    winAny.posthog.capture(event, properties);
  }
}

