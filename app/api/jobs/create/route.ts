/**
 * Job Creation API
 * Creates a new video generation job in Redis queue
 */

import { NextRequest, NextResponse } from "next/server";
import Redis from "ioredis";

const JOB_QUEUE_KEY = 'video:jobs:queue';
const JOB_DATA_PREFIX = 'video:job:';

// Get Redis client
function getRedisClient(): Redis {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        throw new Error('REDIS_URL is not configured');
    }
    return new Redis(redisUrl);
}

export async function POST(request: NextRequest) {
    let redis: Redis | null = null;

    try {
        const { videoIdea } = await request.json();

        if (!videoIdea || typeof videoIdea !== "string") {
            return NextResponse.json(
                { error: "Video idea is required" },
                { status: 400 }
            );
        }

        console.log("📝 Creating video generation job for:", videoIdea);

        redis = getRedisClient();

        // Generate unique job ID
        const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Create job data
        const job = {
            jobId,
            videoIdea,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            status: 'pending',
            progress: 0,
            message: 'Job created, waiting for processing',
        };

        // Save job data
        await redis.set(`${JOB_DATA_PREFIX}${jobId}`, JSON.stringify(job));

        // Add to queue
        await redis.rpush(JOB_QUEUE_KEY, jobId);

        console.log(`✅ Job created: ${jobId}`);

        return NextResponse.json({
            success: true,
            jobId,
            message: 'Job created successfully. Worker will process it shortly.',
        });

    } catch (error) {
        console.error("❌ Error creating job:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to create job" },
            { status: 500 }
        );
    } finally {
        if (redis) {
            await redis.quit();
        }
    }
}
