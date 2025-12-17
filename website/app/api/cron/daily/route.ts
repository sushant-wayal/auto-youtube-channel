import { createJob } from "@/lib/redis-client";
import { NextResponse } from "next/server";

export async function GET() {
  const { jobId } = await createJob({
    jobType: "auto-video-generation-and-upload",
    videoId: `daily-auto-video-${Date.now()}`,
    payload: {},
  }, true);

  console.log(`\n🗓️  Created daily auto video generation and upload job: ${jobId}`);

  return NextResponse.json({ ok: true });
}
