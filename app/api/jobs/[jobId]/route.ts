// app/api/jobs/[jobId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await ctx.params;

  if (!jobId) {
    return NextResponse.json(
      { error: "Missing jobId" },
      { status: 400 }
    );
  }

  const prefixes = [
    "voiceOver:job:",
    "clipCollector:job:",
    "videoAssembler:job:",
  ];

  let jobData: string | null = null;

  for (const prefix of prefixes) {
    jobData = await redis.get(`${prefix}${jobId}`);
    if (jobData) break;
  }

  if (!jobData) {
    return NextResponse.json(
      { error: "Job not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(JSON.parse(jobData), { status: 200 });
}
