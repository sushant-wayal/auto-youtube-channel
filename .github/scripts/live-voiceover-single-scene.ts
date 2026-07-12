/**
 * GitHub Actions Script: Generate Voiceover for a Single Live Stream Scene
 * Called by: live-voiceover-scene matrix job in live-stream.yml
 *
 * Env vars required:
 *   SCENE_INDEX       — 0-based index of the scene
 *   VIDEO_ID          — e.g. live-1783831740426
 *   SCRIPT_DATA       — compact JSON { videoId, script: { scenes, ... } }
 *   REDIS_URL         — Redis connection string
 *   CLOUDINARY_*      — credentials
 *   GEMINI_API_KEY_1  — for Gemini TTS
 *
 * Redis keys written (TTL 24h):
 *   live:{videoId}:scene:{N}:audio_url — generated audio Cloudinary URL
 */

import { generateVoiceOvers } from '../../workers/voice-over-generation/src/index';
import { validateConfig } from '../../shared/config';
import Redis from 'ioredis';

interface ScriptData {
    videoId: string;
    script: {
        scenes: Array<{
            narration: string;
        }>;
    };
}

const REDIS_TTL_SECONDS = 60 * 60 * 24; // 24 hours

async function generateSingleSceneVoiceover() {
    validateConfig(['cloudinary', 'voiceover']);

    const sceneIndexStr = process.env.SCENE_INDEX;
    const videoId = process.env.VIDEO_ID;
    const scriptDataStr = process.env.SCRIPT_DATA;

    if (sceneIndexStr === undefined || !videoId || !scriptDataStr) {
        throw new Error('Missing required env vars: SCENE_INDEX, VIDEO_ID, SCRIPT_DATA');
    }

    const sceneIndex = parseInt(sceneIndexStr, 10);
    const data: ScriptData = JSON.parse(scriptDataStr);
    const scene = data.script.scenes[sceneIndex];

    if (!scene) {
        throw new Error(`Scene at index ${sceneIndex} not found (total: ${data.script.scenes.length})`);
    }

    const narration = scene.narration || '';
    console.error(`🎤 Generating voiceover for scene ${sceneIndex}`);
    console.error(`📝 Narration length: ${narration.length} chars`);

    // Use a per-scene jobId so each voiceover uploads independently.
    // The Cloudinary path will be: video-gen/narrations/{videoId}-live-vo-{sceneIndex}/part-1.wav
    const sceneJobId = `${videoId}-live-vo-${sceneIndex}`;

    const result = await generateVoiceOvers({
        perSceneNarration: [narration],
        videoId: sceneJobId,
        voice: 'Puck',
    });

    const audioUrl = result.urls[0];
    console.error(`✅ Voiceover for scene ${sceneIndex} uploaded: ${audioUrl}`);

    // ── Store in Redis ──────────────────────────────────────────────────────
    const redis = new Redis(process.env.REDIS_URL!);
    try {
        const key = `live:${videoId}:scene:${sceneIndex}:audio_url`;
        await redis.setex(key, REDIS_TTL_SECONDS, audioUrl);
        console.error(`📦 Stored in Redis: ${key} → ${audioUrl}`);
    } finally {
        await redis.quit();
    }
}

(async () => {
    try {
        await generateSingleSceneVoiceover();
        process.exit(0);
    } catch (error) {
        console.error('❌ Live scene voiceover generation failed:', error);
        process.exit(1);
    }
})();
