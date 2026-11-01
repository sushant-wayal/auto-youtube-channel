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
    const automationFocus = body.automationFocus
      ? String(body.automationFocus).trim()
      : body.notes
      ? String(body.notes).trim()
      : "";

    const currentWorkflow = String(body.currentWorkflow || "Early Access Interest List").trim();
    const monthlySpend = String(body.monthlySpend || "N/A (Interest List)").trim();
    const willingnessToPay = String(body.willingnessToPay || "Early Access Interest").trim();
    const selectedTier = String(body.selectedTier || "First Public Release Early Access").trim();

    const combinedNotes = [
      monthlyShorts ? `Shorts Volume: ${monthlyShorts}` : null,
      automationFocus ? `Automation Focus: ${automationFocus}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    const notes = combinedNotes || null;

    const utmSource = body.utmSource ? String(body.utmSource).trim() : null;
    const utmMedium = body.utmMedium ? String(body.utmMedium).trim() : null;
    const utmCampaign = body.utmCampaign ? String(body.utmCampaign).trim() : null;
    const referrer = body.referrer ? String(body.referrer).trim() : null;

    // Strict validation
    if (name.length < 2) {
      return NextResponse.json(
        { error: "Please enter your name." },
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

    const submissionData = {
      name,
      email,
      channelUrl,
      channelsCount,
      monthlyVideos,
      monthlyShorts,
      automationFocus,
      currentWorkflow,
      monthlySpend,
      willingnessToPay,
      selectedTier,
      notes,
      utmSource,
      utmMedium,
      utmCampaign,
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
        // Update existing application
        await prisma.earlyAccessApplication.update({
          where: { email },
          data: {
            name,
            channelUrl,
            channelsCount,
            monthlyVideos,
            currentWorkflow,
            monthlySpend,
            willingnessToPay,
            selectedTier,
            notes,
            utmSource,
            utmMedium,
            utmCampaign,
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
            currentWorkflow,
            monthlySpend,
            willingnessToPay,
            selectedTier,
            notes,
            utmSource,
            utmMedium,
            utmCampaign,
            referrer,
          },
        });
      }
      savedInDb = true;
    } catch (dbErr) {
      console.warn("[EarlyAccess API] Prisma DB write bypassed or failed, saving to durable disk store:", dbErr);
    }

    // Always persist to durable local file store as well so zero data is lost
    try {
      const dataDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const leadsFile = path.join(dataDir, "early_access_applications.json");
      let allLeads: typeof submissionData[] = [];
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
