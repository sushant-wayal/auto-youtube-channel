/**
 * GitHub Actions Script: Process a Single Short (Matrix job entry point)
 * Called by: process-short matrix job
 *
 * Each matrix runner calls this script with its own SHORT_INDEX, so all
 * shorts are rendered/voiced/assembled/uploaded in parallel instead of
 * sequentially (which previously took up to 120 min for 3–5 shorts).
 *
 * Required env vars:
 *   SHORT_INDEX           - 0-based index of the short to process
 *   SCRIPT_DATA           - full script JSON (from generate-script job output)
 *   CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
 *   GEMINI_API_KEY_1 / GEMINI_API_KEY_2
 *   YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN
 *   REDIS_URL
 */

import Redis from 'ioredis';
import { renderScenes } from '../../workers/video-scene-renderer/src/index';
import { generateVoiceOvers } from '../../workers/voice-over-generation/src/index';
import { assembleVideo } from '../../workers/video-assembler/src/index';
import { uploadToYouTube } from '../../workers/youtube-upload/src/index';
import { validateConfig } from '../../shared/config';
import { getShortsPublishTimeByRank } from '../../shared/services/shorts-publish-time-service';

/**
 * Convert an IST time string (HH:MM) to a UTC ISO-8601 publish timestamp.
 */
function getPublishTimeFromISTTime(timeIST: string, dayOffset: number = 0): string {
    const now = new Date();
    const [hours, minutes] = timeIST.split(':').map(Number);

    // IST is UTC+5:30
    const istOffset = 5.5 * 60 * 60 * 1000;

    // Shift 'now' into IST context so date arithmetic is correct
    const istNow = new Date(now.getTime() + istOffset);

    // Set target time within IST context
    const targetIST = new Date(istNow);
    targetIST.setUTCHours(hours, minutes, 0, 0);
    targetIST.setUTCDate(targetIST.getUTCDate() + dayOffset);

    // Convert back to UTC for YouTube API
    return new Date(targetIST.getTime() - istOffset).toISOString();
}

interface ShortScene {
    id: string;
    narration: string;
    baseDuration: number;
    holdDuration: number;
    actions: any[];
}

interface ScriptData {
    script: {
        description: string;
        tags: string[];
        shorts: Array<{
            id: string;
            hook: string;
            scenes: ShortScene[];
        }>;
    };
}

async function processSingleShort(videoId: string, shortIndex: number, scriptData: string) {
    validateConfig(['cloudinary', 'voiceover', 'youtube']);

    const data: ScriptData = JSON.parse(scriptData);
    const shorts = data.script.shorts;

    if (shortIndex < 0 || shortIndex >= shorts.length) {
        throw new Error(`SHORT_INDEX ${shortIndex} out of range (0–${shorts.length - 1})`);
    }

    const short = shorts[shortIndex];
    const shortId = `${videoId}-short-${shortIndex}`;

    console.error(`\n📱 Processing short ${shortIndex + 1}/${shorts.length}: ${short.hook}`);

    // ── Validate hook scene ──────────────────────────────────────────────────
    const hookScene = short.scenes[0];
    if (!hookScene || hookScene.id !== 'hook') {
        throw new Error(`Short ${shortIndex + 1} must have first scene with id='hook'`);
    }
    if (hookScene.narration !== '') {
        throw new Error(`Hook scene must have empty narration (short ${shortIndex + 1})`);
    }
    if (hookScene.baseDuration < 0.8 || hookScene.baseDuration > 1.5) {
        console.warn(`⚠️ Hook scene duration ${hookScene.baseDuration}s outside recommended range 0.8–1.5s`);
    }

    console.error(`   Hook scene: ${hookScene.baseDuration}s (no narration)`);
    const contentScenes = short.scenes.slice(1);
    contentScenes.forEach((scene, idx) => {
        const totalDuration = scene.baseDuration + scene.holdDuration;
        console.error(`   Scene ${idx + 2}: ${totalDuration}s (${scene.baseDuration}s base + ${scene.holdDuration}s hold)`);
    });

    // ── 1. Render scenes ─────────────────────────────────────────────────────
    console.error(`🎬 Rendering ${short.scenes.length} scenes...`);
    const { urls: clips, timings, animationStopTimes } = await renderScenes({
        scenes: short.scenes,
        isShort: true,
        videoId: shortId,
    });

    // ── 2. Generate voice-overs (hook narration is empty → silent slot) ──────
    const allNarrations = short.scenes.map(scene => scene.narration);
    console.error(`🎤 Generating voice-over for ${allNarrations.length} scenes (including hook)...`);
    const { urls: voiceovers } = await generateVoiceOvers({
        perSceneNarration: allNarrations,
        videoId: shortId,
        voice: 'Puck',
    });

    // ── 3. Assemble ──────────────────────────────────────────────────────────
    console.error(`🧩 Assembling short ${shortIndex + 1}...`);
    const contentNarrations = contentScenes.map(scene => scene.narration);
    const fullNarration = contentNarrations.join(' ');
    const assembled = await assembleVideo({
        jobId: shortId,
        videoId: shortId,
        narration: fullNarration,
        perSceneNarration: allNarrations,
        narrationAudios: voiceovers,
        clips,
        clipTimings: timings,
        animationStopTimes,
        isShort: true,
    });

    // ── 4. Upload to YouTube with ranked schedule time ────────────────────────
    const shortsRank = Math.min(shortIndex, 4); // cap at rank 4 (5 slots total)
    const shortsTime = await getShortsPublishTimeByRank(shortsRank);
    const scheduledPublishTime = getPublishTimeFromISTTime(shortsTime, 0);
    console.error(`📤 Uploading short ${shortIndex + 1} (Rank ${shortsRank + 1}) → scheduled ${shortsTime} IST (${scheduledPublishTime})...`);

    const { videoId: youtubeId } = await uploadToYouTube({
        videoUrl: assembled.outputUrl,
        isShort: true,
        title: short.hook,
        description: data.script.description,
        tags: data.script.tags,
        privacyStatus: 'private', // required for scheduled publishing
        scheduledPublishTime,
    });

    console.error(`✅ Short ${shortIndex + 1} done: https://youtube.com/watch?v=${youtubeId} (Rank ${shortsRank + 1} – ${shortsTime} IST)`);

    const result = {
        shortIndex,
        shortId,
        youtubeId,
        videoUrl: assembled.outputUrl,
        scheduledPublishTime,
        rank: shortsRank + 1,
    };

    // Persist result to Redis so the pipeline-status API can return it
    try {
        const redis = new Redis(process.env.REDIS_URL!);
        await redis.rpush(`pipeline:shorts:${videoId}`, JSON.stringify(result));
        await redis.expire(`pipeline:shorts:${videoId}`, 60 * 60 * 24 * 7); // 7 days
        await redis.quit();
        console.error(`✅ Short ${shortIndex} result stored in Redis`);
    } catch (redisErr) {
        console.error(`⚠️  Could not store short result in Redis (non-fatal):`, redisErr);
    }

    return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
    try {
        const videoId = process.argv[2];
        const shortIndexStr = process.env.SHORT_INDEX;
        const scriptData = process.env.SCRIPT_DATA;

        if (!videoId || shortIndexStr === undefined || !scriptData) {
            throw new Error('Missing required inputs: videoId (CLI arg), SHORT_INDEX (env), SCRIPT_DATA (env)');
        }

        const shortIndex = parseInt(shortIndexStr, 10);
        if (isNaN(shortIndex)) {
            throw new Error(`Invalid SHORT_INDEX: "${shortIndexStr}"`);
        }

        const result = await processSingleShort(videoId, shortIndex, scriptData);
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('❌ Short processing failed:', error);
        process.exit(1);
    }
})();
