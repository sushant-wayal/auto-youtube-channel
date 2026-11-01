import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

const VALID_EVENT_TYPES = new Set([
  "page_view",
  "video_impression",
  "video_play",
  "video_progress_25",
  "video_progress_50",
  "video_progress_75",
  "video_progress_100",
  "cta_click",
  "form_viewed",
  "form_started",
  "form_submit_attempt",
  "form_submit_success",
  "form_submit_error",
  "workflow_step_inspected",
  "screenshot_tab_switched",
  "faq_toggled",
]);

// In-memory rate limiting map: ip/visitor -> last timestamp & count
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit = 60, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count += 1;
  return true;
}

// Clean in-memory map periodically
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of rateLimitMap.entries()) {
      if (now > v.resetAt) rateLimitMap.delete(k);
    }
  }, 120000);
}

export async function POST(request: Request) {
  try {
    let body: any;
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const text = await request.text();
      try {
        body = JSON.parse(text);
      } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
      }
    }

    const eventType = String(body.eventType || "").trim();
    if (!VALID_EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ error: "Invalid eventType" }, { status: 400 });
    }

    const visitorId = String(body.visitorId || "").slice(0, 100);
    const sessionId = String(body.sessionId || "").slice(0, 100);
    const pathName = body.path ? String(body.path).slice(0, 255) : null;
    const referrer = body.referrer ? String(body.referrer).slice(0, 500) : null;
    const utmSource = body.utmSource ? String(body.utmSource).slice(0, 100) : null;
    const utmMedium = body.utmMedium ? String(body.utmMedium).slice(0, 100) : null;
    const utmCampaign = body.utmCampaign ? String(body.utmCampaign).slice(0, 100) : null;
    const utmContent = body.utmContent ? String(body.utmContent).slice(0, 100) : null;
    const utmTerm = body.utmTerm ? String(body.utmTerm).slice(0, 100) : null;

    // Abuse prevention
    if (visitorId && !checkRateLimit(visitorId, 120, 60000)) {
      return NextResponse.json({ warning: "Rate limited" }, { status: 429 });
    }

    // Sanitize properties (no emails, passwords, or PII in analytics)
    let properties: Record<string, any> = {};
    if (body.properties && typeof body.properties === "object" && !Array.isArray(body.properties)) {
      for (const [k, v] of Object.entries(body.properties)) {
        if (/password|secret|token|email|auth/i.test(k)) continue;
        if (typeof v === "string") {
          properties[k] = v.slice(0, 200);
        } else if (typeof v === "number" || typeof v === "boolean") {
          properties[k] = v;
        }
      }
    }

    const eventRecord = {
      eventType,
      eventName: eventType,
      visitorId: visitorId || "anonymous",
      sessionId: sessionId || "anonymous",
      path: pathName,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      properties,
      createdAt: new Date(),
    };

    // Save to Primary Postgres DB
    try {
      await prisma.analyticsEvent.create({
        data: eventRecord,
      });
    } catch (dbErr) {
      console.warn("[Analytics API] Database insert failed, falling back to disk:", dbErr);
    }

    // Always mirror to disk file storage for durability
    try {
      const dataDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const eventsFile = path.join(dataDir, "analytics_events.jsonl");
      fs.appendFileSync(
        eventsFile,
        JSON.stringify({ ...eventRecord, createdAt: eventRecord.createdAt.toISOString() }) + "\n",
        "utf-8"
      );
    } catch (diskErr) {
      console.error("[Analytics API] Disk write error:", diskErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Analytics API] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

