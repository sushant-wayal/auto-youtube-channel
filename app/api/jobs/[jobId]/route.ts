/**
 * Job Status API
 * Gets the status of a video generation job from Redis
 */

import { NextRequest, NextResponse } from "next/server";
import Redis from "ioredis";

const JOB_DATA_PREFIX = 'video:job:';

// Get Redis client
function getRedisClient(): Redis {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        throw new Error('REDIS_URL is not configured');
    }
    return new Redis(redisUrl);
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    let redis: Redis | null = null;

    try {
        const { jobId } = await params;

        if (!jobId) {
            return NextResponse.json(
                { error: "Job ID is required" },
                { status: 400 }
            );
        }

        redis = getRedisClient();

        // Get job data
        const jobData = await redis.get(`${JOB_DATA_PREFIX}${jobId}`);

        if (!jobData) {
            return NextResponse.json(
                { error: "Job not found" },
                { status: 404 }
            );
        }

        const job = JSON.parse(jobData);

        return NextResponse.json({
            success: true,
            job,
        });

    } catch (error) {
        console.error("❌ Error getting job status:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to get job status" },
            { status: 500 }
        );
    } finally {
        if (redis) {
            await redis.quit();
        }
    }
}
