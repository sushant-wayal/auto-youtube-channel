/**
 * GitHub Actions Script: Stream All Assembled Scene Segments to YouTube Live
 * Called by: live-stream-to-youtube job in live-stream.yml
 *
 * Reads all segment URLs from Redis (written by the assemble jobs),
 * creates a private YouTube Live event, and streams all segments as ONE 
 * uninterrupted broadcast via FFmpeg concat demuxer.
 * Finally, deletes the segment URL keys from Redis.
 *
 * Redis keys read:
 *   live:{videoId}:scene:{N}:segment_url
 *
 * Redis keys deleted after use:
 *   live:{videoId}:scene:{N}:segment_url
 *
 * Env vars required:
 *   VIDEO_ID              — e.g. live-1783831740426
 *   SCENE_COUNT           — total number of scenes
 *   SCRIPT_DATA           — compact JSON (for title, description)
 *   REDIS_URL             — Redis connection string
 *   YT_CLIENT_ID          — YouTube OAuth2 client id
 *   YT_CLIENT_SECRET      — YouTube OAuth2 client secret
 *   YT_REFRESH_TOKEN      — YouTube OAuth2 refresh token
 *   PRIVACY               — "private" | "public" | "unlisted" (default: private)
 */

import { YouTubeLiveService } from '../../workers/live-streaming/src/services/youtube-live-service';
import { StreamingService } from '../../workers/live-streaming/src/services/streaming-service';
import { liveConfig } from '../../workers/live-streaming/src/config';
import Redis from 'ioredis';

interface ScriptData {
    videoId: string;
    script: {
        title: string;
        description: string;
    };
}

const REDIS_WAIT_INTERVAL_MS = 5_000;   // Poll every 5 seconds
const REDIS_WAIT_TIMEOUT_MS  = 30 * 60 * 1000; // 30 min max wait

/** Poll Redis until the key is set, or throw after timeout */
async function waitForRedisKey(redis: Redis, key: string): Promise<string> {
    const deadline = Date.now() + REDIS_WAIT_TIMEOUT_MS;
    console.error(`⏳ Waiting for Redis key: ${key}`);
    while (Date.now() < deadline) {
        const value = await redis.get(key);
        if (value !== null) {
            console.error(`✅ Got Redis key ${key} → ${value}`);
            return value;
        }
        await new Promise(r => setTimeout(r, REDIS_WAIT_INTERVAL_MS));
    }
    throw new Error(`Timed out waiting for Redis key: ${key}`);
}

async function streamToYouTube() {
    const videoId = process.env.VIDEO_ID;
    const sceneCountStr = process.env.SCENE_COUNT;
    const scriptDataStr = process.env.SCRIPT_DATA;
    const privacy = (process.env.PRIVACY || liveConfig.privacy || 'private') as 'private' | 'public' | 'unlisted';

    if (!videoId || !sceneCountStr || !scriptDataStr) {
        throw new Error('Missing required env vars: VIDEO_ID, SCENE_COUNT, SCRIPT_DATA');
    }

    const sceneCount = parseInt(sceneCountStr, 10);
    const data: ScriptData = JSON.parse(scriptDataStr);
    const { title, description } = data.script;

    console.log(`\n=================================================`);
    console.log(`🔴 LIVE STREAM: "${title}"`);
    console.log(`   Scenes: ${sceneCount} | Privacy: ${privacy}`);
    console.log(`=================================================\n`);

    const redis = new Redis(process.env.REDIS_URL!);
    const segmentUrls: string[] = [];
    const keysToDelete: string[] = [];

    try {
        // ── 1. Read all segment URLs from Redis ─────────────────────────────────
        // Wait for all segments to be ready in Redis
        for (let i = 0; i < sceneCount; i++) {
            const key = `live:${videoId}:scene:${i}:segment_url`;
            const url = await waitForRedisKey(redis, key);
            segmentUrls.push(url);
            keysToDelete.push(key);
            console.log(`  📦 Segment ${i}: ${url}`);
        }
    } finally {
        // Do not quit redis yet, we need it to delete keys later
    }

    // ── 2. Create YouTube Live Event ──────────────────────────────────────────
    console.log(`\n[4/6] 📺 Creating YouTube Live Event...`);
    const youtubeService = new YouTubeLiveService();
    const streamingService = new StreamingService();

    const broadcastId = await youtubeService.createBroadcast(title, description, privacy);
    const streamInfo = await youtubeService.createStream(title);
    await youtubeService.bindBroadcast(broadcastId, streamInfo.streamId);

    console.log(`✅ Live Event ready. Broadcast ID: ${broadcastId}`);
    console.log(`📡 Stream URL: ${streamInfo.ingestionAddress}`);

    // ── 3. Stream all segments in one RTMP session ────────────────────────────
    console.log(`\n[5/6] 🚀 Streaming ${sceneCount} segments to YouTube...`);
    await streamingService.streamSegments(
        segmentUrls,
        streamInfo.ingestionAddress,
        streamInfo.streamName
    );
    console.log(`✅ All segments streamed successfully.`);

    // ── 4. Complete the broadcast ─────────────────────────────────────────────
    console.log(`\n[6/6] 🏁 Completing broadcast...`);
    await new Promise(r => setTimeout(r, 10000)); // give YouTube a moment
    try {
        await youtubeService.transitionState(broadcastId, 'complete');
        console.log(`✅ Broadcast completed.`);
    } catch (err: any) {
        console.log(`⚠️ Auto-stop may have already completed it: ${err.message}`);
    }

    // ── 5. Cleanup Redis Keys ─────────────────────────────────────────────────
    if (keysToDelete.length > 0) {
        const deletedCount = await redis.del(...keysToDelete);
        console.log(`🗑  Cleaned up ${deletedCount} segment URLs from Redis.`);
    }
    
    await redis.quit();

    console.log(`\n🎉 Live Stream Pipeline Completed Successfully!`);
    console.log(`📺 https://www.youtube.com/watch?v=${broadcastId}`);
}

(async () => {
    try {
        await streamToYouTube();
        process.exit(0);
    } catch (error) {
        console.error('❌ Live stream to YouTube failed:', error);
        process.exit(1);
    }
})();
