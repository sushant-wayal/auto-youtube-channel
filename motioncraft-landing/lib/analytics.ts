// =========================================================================
// SERENITY STUDIO — FIRST-PARTY EVENT TRACKING & ANALYTICS CLIENT
// =========================================================================

export type AnalyticsEventType =
  // Traffic events
  | "page_view"
  // Video engagement events
  | "video_impression"
  | "video_play"
  | "video_progress_25"
  | "video_progress_50"
  | "video_progress_75"
  | "video_progress_100"
  // CTA interaction events
  | "cta_click"
  // Registration funnel events
  | "form_viewed"
  | "form_started"
  | "form_submit_attempt"
  | "form_submit_success"
  | "form_submit_error"
  // Generic interactions
  | "workflow_step_inspected"
  | "screenshot_tab_switched"
  | "faq_toggled";

export interface AttributionContext {
  visitorId: string;
  sessionId: string;
  referrer: string;
  url: string;
  path: string;
  utm: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  };
}

const VISITOR_COOKIE_NAME = "ss_visitor_id";
const SESSION_COOKIE_NAME = "ss_session_id";
const ATTRIBUTION_STORAGE_KEY = "ss_initial_attribution";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

/**
 * Returns or provisions persistent anonymous visitor ID
 */
export function getVisitorId(): string {
  if (typeof window === "undefined") return "";

  let id = localStorage.getItem(VISITOR_COOKIE_NAME) || getCookie(VISITOR_COOKIE_NAME);
  if (!id) {
    id = generateUUID();
    try {
      localStorage.setItem(VISITOR_COOKIE_NAME, id);
    } catch {}
    setCookie(VISITOR_COOKIE_NAME, id, 365);
  }
  return id;
}

/**
 * Returns or provisions active session ID
 */
export function getSessionId(): string {
  if (typeof window === "undefined") return "";

  let id = sessionStorage.getItem(SESSION_COOKIE_NAME) || getCookie(SESSION_COOKIE_NAME);
  if (!id) {
    id = generateUUID();
    try {
      sessionStorage.setItem(SESSION_COOKIE_NAME, id);
    } catch {}
    setCookie(SESSION_COOKIE_NAME, id, 1);
  }
  return id;
}

/**
 * Captures and preserves initial visit UTM attribution
 */
export function getAttributionContext(): AttributionContext {
  if (typeof window === "undefined") {
    return {
      visitorId: "",
      sessionId: "",
      referrer: "",
      url: "",
      path: "",
      utm: {},
    };
  }

  const urlParams = new URLSearchParams(window.location.search);
  const currentUtm = {
    source: urlParams.get("utm_source") || undefined,
    medium: urlParams.get("utm_medium") || undefined,
    campaign: urlParams.get("utm_campaign") || undefined,
    content: urlParams.get("utm_content") || undefined,
    term: urlParams.get("utm_term") || undefined,
  };

  // Check if first-touch attribution is already preserved
  let preservedUtm = currentUtm;
  try {
    const rawStored = localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (rawStored) {
      const parsed = JSON.parse(rawStored);
      preservedUtm = {
        source: currentUtm.source || parsed.source,
        medium: currentUtm.medium || parsed.medium,
        campaign: currentUtm.campaign || parsed.campaign,
        content: currentUtm.content || parsed.content,
        term: currentUtm.term || parsed.term,
      };
    } else if (currentUtm.source || currentUtm.medium || currentUtm.campaign) {
      localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(currentUtm));
    }
  } catch {}

  return {
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
    referrer: document.referrer || "direct",
    url: window.location.href,
    path: window.location.pathname || "/",
    utm: preservedUtm,
  };
}

/**
 * Backwards compatibility helper
 */
export function getTrackingContext() {
  const attr = getAttributionContext();
  return {
    referrer: attr.referrer,
    utm: attr.utm,
    visitorId: attr.visitorId,
    sessionId: attr.sessionId,
  };
}

/**
 * Dispatches an event to the first-party analytics API
 */
export function trackEvent(
  eventType: AnalyticsEventType,
  properties?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;

  const context = getAttributionContext();

  const payload = {
    eventType,
    visitorId: context.visitorId,
    sessionId: context.sessionId,
    path: context.path,
    referrer: context.referrer,
    utmSource: context.utm.source || null,
    utmMedium: context.utm.medium || null,
    utmCampaign: context.utm.campaign || null,
    utmContent: context.utm.content || null,
    utmTerm: context.utm.term || null,
    properties: properties || {},
    timestamp: new Date().toISOString(),
  };

  if (process.env.NODE_ENV === "development") {
    console.log(`[First-Party Analytics: ${eventType}]`, payload);
  }

  // Push to dataLayer if present
  if (Array.isArray((window as unknown as { dataLayer: unknown[] }).dataLayer)) {
    (window as unknown as { dataLayer: unknown[] }).dataLayer.push({
      event: eventType,
      ...payload,
    });
  }

  // Dispatch to first-party collector via sendBeacon or fetch keepalive
  try {
    const serialized = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics", serialized);
    } else {
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: serialized,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {}
}
