/**
 * GitHub Actions Script: Assemble a Single Live Stream Scene Segment
 * Called by: live-assemble-scene matrix job in live-stream.yml
 *
 * Reads clip URL and audio URL from Redis (written by the render and voiceover jobs),
 * mixes them with FFmpeg, uploads the result to Cloudinary, then:
 *   - Stores the segment URL in Redis for the streaming job to collect
 *   - Deletes the clip and audio Redis keys (no longer needed)
 *
 * Redis keys read:
 *   live:{videoId}:scene:{N}:clip_url
 *   live:{videoId}:scene:{N}:audio_url
 *
 * Redis key written:
 *   live:{videoId}:scene:{N}:segment_url
 *
 * Redis keys deleted after use:
 *   live:{videoId}:scene:{N}:clip_url
 *   live:{videoId}:scene:{N}:audio_url
 *   live:{videoId}:scene:{N}:clip_timing
 *   live:{videoId}:scene:{N}:animation_stop_time
 *
 * Env vars required:
 *   SCENE_INDEX         — 0-based scene index
 *   VIDEO_ID            — e.g. live-1783831740426
 *   SCRIPT_DATA         — compact JSON (for scene duration metadata)
 *   REDIS_URL           — Redis connection string
 *   CLOUDINARY_*        — credentials
 */

import { validateConfig } from '../../shared/config';
import { runFFmpeg, getVideoDuration } from '../../workers/video-assembler/src/lib/video/ffmpeg-utils';
import CloudinaryService from '../../shared/services/cloudinary-service';
import Redis from 'ioredis';
import fs from 'fs';
import path from 'path';

interface ScriptData {
    videoId: string;
    script: {
        scenes: Array<{
            id: string;
            narration: string;
            baseDuration: number;
            holdDuration?: number;
        }>;
    };
}

const REDIS_TTL_SECONDS = 60 * 60 * 24; // 24 hours
const REDIS_WAIT_INTERVAL_MS = 5_000;   // Poll every 5 seconds
const REDIS_WAIT_TIMEOUT_MS  = 30 * 60 * 1000; // 30 min max wait (should never hit this)

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

async function downloadFile(url: string, outPath: string): Promise<void> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download ${url} (${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, buf);
}

async function assembleSingleScene() {
    validateConfig(['cloudinary']);

    const sceneIndexStr = process.env.SCENE_INDEX;
    const videoId = process.env.VIDEO_ID;
    const scriptDataStr = process.env.SCRIPT_DATA;

    if (sceneIndexStr === undefined || !videoId || !scriptDataStr) {
        throw new Error('Missing required env vars: SCENE_INDEX, VIDEO_ID, SCRIPT_DATA');
    }

    const sceneIndex = parseInt(sceneIndexStr, 10);
    const data: ScriptData = JSON.parse(scriptDataStr);
    const scene = data.script.scenes[sceneIndex];
    if (!scene) throw new Error(`Scene at index ${sceneIndex} not found`);

    const redis = new Redis(process.env.REDIS_URL!);

    let clipUrl: string;
    let audioUrl: string;

    try {
        // ── 1. Read clip + audio URLs from Redis ──────────────────────────────
        // The assemble job starts AFTER both render and voiceover matrix jobs
        // finish (needs: [...]), so these keys should already exist. But we poll
        // just in case of slight timing skew.
        const prefix = `live:${videoId}:scene:${sceneIndex}`;
        clipUrl  = await waitForRedisKey(redis, `${prefix}:clip_url`);
        audioUrl = await waitForRedisKey(redis, `${prefix}:audio_url`);
    } finally {
        await redis.quit();
    }

    console.error(`🧩 Assembling scene ${sceneIndex}...`);
    console.error(`  📹 Clip:  ${clipUrl}`);
    console.error(`  🔊 Audio: ${audioUrl}`);

    // ── 2. Download clip and audio ─────────────────────────────────────────
    const workDir = path.join(process.cwd(), 'live_assemble_tmp', `scene-${sceneIndex}`);
    fs.mkdirSync(workDir, { recursive: true });

    const clipPath          = path.join(workDir, 'clip.mp4');
    const audioPath         = path.join(workDir, 'audio.wav');
    const sceneVideoPath    = path.join(workDir, 'scene_normalized.mp4');
    const segmentPath       = path.join(workDir, 'segment.mp4');

    console.error(`  ⬇️  Downloading clip...`);
    await downloadFile(clipUrl, clipPath);
    console.error(`  ⬇️  Downloading audio...`);
    await downloadFile(audioUrl, audioPath);

    // ── 3. Get durations ───────────────────────────────────────────────────
    const clipDuration  = await getVideoDuration(clipPath);
    const audioDuration = await getVideoDuration(audioPath);
    console.error(`  ⏱  Clip: ${clipDuration.toFixed(2)}s | Audio: ${audioDuration.toFixed(2)}s`);

    // ── 4. Normalize clip to audio duration (audio drives final length) ────
    const targetDuration = Math.max(audioDuration, 0.5);
    const extraDuration  = Math.max(0, targetDuration - clipDuration);
    const padFilter = extraDuration > 0
        ? `tpad=stop_mode=clone:stop_duration=${extraDuration.toFixed(3)}`
        : `null`;
    const vf = `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,fps=30,${padFilter}`;

    console.error(`  🎞️  Normalizing video to ${targetDuration.toFixed(2)}s...`);
    await runFFmpeg({
        inputs: [clipPath],
        output: sceneVideoPath,
        args: [
            '-threads', '1',
            '-t', String(targetDuration),
            '-vf', vf,
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '18',
            '-an',
            '-movflags', '+faststart',
        ],
    });

    // ── 5. Mux video + audio ───────────────────────────────────────────────
    console.error(`  🔊 Attaching audio...`);
    const finalVideoDur = await getVideoDuration(sceneVideoPath);

    await runFFmpeg({
        inputs: [sceneVideoPath, audioPath],
        output: segmentPath,
        args: [
            '-threads', '1',
            '-c:v', 'copy',
            '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
            '-t', String(finalVideoDur),   // trim to video length
            '-movflags', '+faststart',
        ],
    });

    // ── 6. Upload segment to Cloudinary ────────────────────────────────────
    const cloudinary = CloudinaryService.getInstance();
    const upload = await cloudinary.uploadVideo(
        segmentPath,
        'live-segments',
        `${videoId}_segment-${sceneIndex}`
    );

    // Cleanup local files
    fs.rmSync(workDir, { recursive: true, force: true });

    const segmentUrl = upload.secureUrl;
    console.error(`✅ Segment ${sceneIndex} assembled: ${segmentUrl}`);

    // ── 7. Write segment URL to Redis; delete intermediate keys ───────────
    const redis2 = new Redis(process.env.REDIS_URL!);
    try {
        const prefix = `live:${videoId}:scene:${sceneIndex}`;
        await redis2.setex(`${prefix}:segment_url`, REDIS_TTL_SECONDS, segmentUrl);
        console.error(`📦 Stored segment URL in Redis: ${prefix}:segment_url`);

        // Delete intermediate keys — clip and audio URLs are no longer needed
        const deleted = await redis2.del(
            `${prefix}:clip_url`,
            `${prefix}:clip_timing`,
            `${prefix}:animation_stop_time`,
            `${prefix}:audio_url`
        );
        console.error(`🗑  Deleted ${deleted} intermediate Redis keys for scene ${sceneIndex}`);
    } finally {
        await redis2.quit();
    }
}

(async () => {
    try {
        await assembleSingleScene();
        process.exit(0);
    } catch (error) {
        console.error('❌ Live scene assembly failed:', error);
        process.exit(1);
    }
})();
