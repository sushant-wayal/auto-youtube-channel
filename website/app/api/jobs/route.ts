// app/api/jobs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobType, videoId, payload } = body;

    if (!jobType || !videoId || !payload) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const jobId = uuidv4();
    const createdAt = Date.now();

    const jobData = {
      jobId,
      videoId,
      createdAt,
      updatedAt: createdAt,
      status: "pending",
      progress: 0,
      message: "",
      ...payload,
    };

    let queueKey = "";
    let jobKey = "";

    switch (jobType) {
      case "voiceover":
        queueKey = "voiceOver:jobs:queue";
        jobKey = `voiceOver:job:${jobId}`;
        break;
      case "assets":
        queueKey = "clipCollector:jobs:queue";
        jobKey = `clipCollector:job:${jobId}`;
        break;
      case "assembly":
        queueKey = "videoAssembler:jobs:queue";
        jobKey = `videoAssembler:job:${jobId}`;
        break;
      case "youtube-upload":
        queueKey = "youtubeUploader:jobs:queue";
        jobKey = `youtubeUploader:job:${jobId}`;
        break;
      default:
        return NextResponse.json(
          { error: "Invalid jobType" },
          { status: 400 }
        );
    }

    await redis.set(jobKey, JSON.stringify(jobData));
    await redis.rpush(queueKey, jobId);

    return NextResponse.json({ jobId }, { status: 200 });
  } catch (err) {
    console.error("Job API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const maxDuration = 60; // optional, if jobs get spicy
