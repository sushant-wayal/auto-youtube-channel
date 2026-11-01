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
  | "early_access_section_cta_clicked"
  | "early_access_form_started"
  | "early_access_step1_completed"
  | "early_access_registered"
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
 * Dispatches an analytics event to internal audit log / beacon
 */
export function trackEvent(
  event: AnalyticsEventType,
  properties?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;

  const payload: AnalyticsPayload = {
    event,
    properties,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    ...getTrackingContext(),
  };

  // Push to dataLayer if Google Tag Manager or similar is initialized
  if (Array.isArray((window as unknown as { dataLayer: unknown[] }).dataLayer)) {
    (window as unknown as { dataLayer: unknown[] }).dataLayer.push(payload);
  }

  // Internal beacon / console logging for development observability
  if (process.env.NODE_ENV === "development") {
    console.log(`[Analytics Event: ${event}]`, payload);
  }

  // Optional: Dispatch to background collector if configured
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics", JSON.stringify(payload));
    }
  } catch {
    // Graceful silent fallback
  }
}
