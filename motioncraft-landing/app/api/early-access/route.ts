function extractYouTubeTag(input: string): string {
  let cleaned = String(input || "").trim();
  if (!cleaned) return "";

  // Strip query params and hashes
  cleaned = cleaned.split("?")[0].split("#")[0];
  // Strip trailing slashes
  cleaned = cleaned.replace(/\/+$/, "");

  // Match youtube URL patterns (handle /@..., /c/..., /channel/..., /user/...)
  const match = cleaned.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:@|c\/|user\/|channel\/)?([^\/\s]+)/i);
  let tag = match && match[1] ? match[1] : cleaned;

  // Clean any remaining protocol or domain if partial
  tag = tag.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/^youtube\.com\/?/i, "");

  // Normalize to @tag
  return tag.startsWith("@") ? tag : `@${tag}`;
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

const VALID_WTP_OPTIONS = [
  "₹0 - Only interested if free",
  "Under ₹3,000",
  "₹3,000–₹8,999",
  "₹9,000–₹22,999",
  "₹23,000–₹37,999",
  "₹38,000–₹89,999",
  "₹90,000+",
  "Not sure yet",
];

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const rawChannel = String(body.channelUrl || "").trim();
    const channelUrl = rawChannel ? extractYouTubeTag(rawChannel) : "";
    const channelsCount = String(body.channelsCount || "1 Channel").trim();
    const monthlyVideos = String(body.monthlyVideos || "1–4 videos / mo").trim();
    const monthlyShorts = String(body.monthlyShorts || "0 Shorts / mo").trim();
    const currentWorkflow = String(body.currentWorkflow || "Using multiple AI tools").trim();
    const monthlySpend = String(body.monthlySpend || "Under ₹3,000").trim();
    const willingnessToPay = String(body.willingnessToPay || "").trim();
    const primaryProblem = body.primaryProblem
      ? String(body.primaryProblem).trim()
      : body.automationFocus
      ? String(body.automationFocus).trim()
      : "";

    const selectedTier = String(body.selectedTier || "Public Release Early Access").trim();

    const visitorId = body.visitorId ? String(body.visitorId).trim() : null;
    const sessionId = body.sessionId ? String(body.sessionId).trim() : null;
    const utmSource = body.utmSource ? String(body.utmSource).trim() : null;
    const utmMedium = body.utmMedium ? String(body.utmMedium).trim() : null;
    const utmCampaign = body.utmCampaign ? String(body.utmCampaign).trim() : null;
    const utmContent = body.utmContent ? String(body.utmContent).trim() : null;
    const utmTerm = body.utmTerm ? String(body.utmTerm).trim() : null;
    const referrer = body.referrer ? String(body.referrer).trim() : null;

    // Strict validation
    if (name.length < 2) {
      return NextResponse.json(
        { error: "Please enter your full name." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (!willingnessToPay || !VALID_WTP_OPTIONS.includes(willingnessToPay)) {
      return NextResponse.json(
        { error: "Please select how much you would realistically be willing to pay per month." },
        { status: 400 }
      );
    }

    const notesSummary = [
      monthlyShorts ? `Shorts: ${monthlyShorts}` : null,
      primaryProblem ? `Problem: ${primaryProblem}` : null,
      currentWorkflow ? `Workflow: ${currentWorkflow}` : null,
      monthlySpend ? `Current Spend: ${monthlySpend}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    const submissionData = {
      name,
      email,
      channelUrl,
      channelsCount,
      monthlyVideos,
      monthlyShorts,
      currentWorkflow,
      monthlySpend,
      willingnessToPay,
      primaryProblem: primaryProblem || null,
      selectedTier,
      notes: notesSummary || null,
      visitorId,
      sessionId,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      referrer,
      createdAt: new Date().toISOString(),
    };

    let savedInDb = false;

    // Attempt primary database storage via Prisma
    try {
      const existing = await prisma.earlyAccessApplication.findUnique({
        where: { email },
      });

      if (existing) {
        await prisma.earlyAccessApplication.update({
          where: { email },
          data: {
            name,
            channelUrl,
            channelsCount,
            monthlyVideos,
            monthlyShorts,
            currentWorkflow,
            monthlySpend,
            willingnessToPay,
            primaryProblem: primaryProblem || null,
            selectedTier,
            notes: notesSummary || null,
            visitorId,
            sessionId,
            utmSource,
            utmMedium,
            utmCampaign,
            utmContent,
            utmTerm,
            referrer,
          },
        });
      } else {
        await prisma.earlyAccessApplication.create({
          data: {
            name,
            email,
            channelUrl,
            channelsCount,
            monthlyVideos,
            monthlyShorts,
            currentWorkflow,
            monthlySpend,
            willingnessToPay,
            primaryProblem: primaryProblem || null,
            selectedTier,
            notes: notesSummary || null,
            visitorId,
            sessionId,
            utmSource,
            utmMedium,
            utmCampaign,
            utmContent,
            utmTerm,
            referrer,
          },
        });
      }
      savedInDb = true;

      // Also record analytics conversion event
      await prisma.analyticsEvent.create({
        data: {
          eventType: "form_submit_success",
          eventName: "form_submit_success",
          visitorId: visitorId || "anonymous",
          sessionId: sessionId || "anonymous",
          path: "/#register",
          referrer,
          utmSource,
          utmMedium,
          utmCampaign,
          utmContent,
          utmTerm,
          properties: {
            willingnessToPay,
            channelsCount,
            monthlyVideos,
            monthlyShorts,
            currentWorkflow,
            monthlySpend,
          },
        },
      });
    } catch (dbErr) {
      console.warn("[EarlyAccess API] Prisma DB write warning:", dbErr);
    }

    // Always persist to durable local file store as well
    try {
      const dataDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const leadsFile = path.join(dataDir, "early_access_applications.json");
      let allLeads: any[] = [];
      if (fs.existsSync(leadsFile)) {
        try {
          allLeads = JSON.parse(fs.readFileSync(leadsFile, "utf-8"));
        } catch {
          allLeads = [];
        }
      }
      const existingIndex = allLeads.findIndex((l) => l.email === email);
      if (existingIndex >= 0) {
        allLeads[existingIndex] = submissionData;
      } else {
        allLeads.push(submissionData);
      }
      fs.writeFileSync(leadsFile, JSON.stringify(allLeads, null, 2), "utf-8");
    } catch (fileErr) {
      console.error("[EarlyAccess API] Durable disk write failed:", fileErr);
    }

    return NextResponse.json({
      success: true,
      message: "You're on the Serenity Studio early-access interest list! We'll contact you via email within the next 30 days with updates about our first public release.",
      savedInDb,
      candidate: {
        name,
        email,
        channelUrl,
        willingnessToPay,
      },
    });
  } catch (err: unknown) {
    console.error("[EarlyAccess API] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error. Please try again." },
      { status: 500 }
    );
  }
}
