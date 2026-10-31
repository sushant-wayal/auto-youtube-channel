import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

const VALID_WORKFLOWS = [
  "Entirely manually",
  "Using multiple AI tools",
  "Using an existing automation platform",
  "Outsourced to editors or an agency",
  "Other",
];

const VALID_PRICE_RANGES = [
  "Less than ₹500",
  "₹500–₹999",
  "₹1,000–₹1,999",
  "₹2,000–₹3,999",
  "₹4,000–₹5,999",
  "More than ₹6,000",
  "I would not currently pay for this",
];

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const channelUrl = String(body.channelUrl || "").trim();
    const channelsCount = String(body.channelsCount || "1").trim();
    const monthlyVideos = String(body.monthlyVideos || "5-10").trim();
    const currentWorkflow = String(body.currentWorkflow || "").trim();
    const monthlySpend = String(body.monthlySpend || "").trim();
    const willingnessToPay = String(body.willingnessToPay || "").trim();
    const selectedTier = String(body.selectedTier || "Founding Creator Beta").trim();
    const notes = body.notes ? String(body.notes).trim() : null;

    const utmSource = body.utmSource ? String(body.utmSource).trim() : null;
    const utmMedium = body.utmMedium ? String(body.utmMedium).trim() : null;
    const utmCampaign = body.utmCampaign ? String(body.utmCampaign).trim() : null;
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

    if (channelUrl.length < 3) {
      return NextResponse.json(
        { error: "Please provide your YouTube channel URL or @handle." },
        { status: 400 }
      );
    }

    if (!VALID_WORKFLOWS.includes(currentWorkflow)) {
      return NextResponse.json(
        { error: "Please select how you currently produce videos." },
        { status: 400 }
      );
    }

    if (!VALID_PRICE_RANGES.includes(willingnessToPay)) {
      return NextResponse.json(
        { error: "Please select your monthly willingness-to-pay range." },
        { status: 400 }
      );
    }

    const submissionData = {
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
      message: "Application submitted successfully.",
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

