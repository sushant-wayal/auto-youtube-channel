/**
 * GitHub Actions Script: Render a Single Live Stream Scene
 * Called by: live-render-scene matrix job in live-stream.yml
 *
 * Env vars required:
 *   SCENE_INDEX           — 0-based index of the scene to render
 *   VIDEO_ID              — e.g. live-1783831740426
 *   SCRIPT_DATA           — compact JSON { videoId, script: { scenes, ... } }
 *   REDIS_URL             — Redis connection string
 *   CLOUDINARY_*          — credentials
 *   WEBSITE_DOMAIN        — for AI HTML generation
 *   SCENE_RENDER_METHOD   — always "ai" in prod
 *
 * Redis keys written (TTL 24h):
 *   live:{videoId}:scene:{N}:clip_url            — rendered clip Cloudinary URL
 *   live:{videoId}:scene:{N}:clip_timing         — clip timing value (seconds)
 *   live:{videoId}:scene:{N}:animation_stop_time — animation stop time (seconds)
 */

import { renderScenes } from '../../workers/video-scene-renderer/src/index';
import { validateConfig } from '../../shared/config';
import Redis from 'ioredis';

interface ScriptData {
    videoId: string;
    script: {
        scenes: Array<{
            id: string;
            narration: string;
            baseDuration: number;
            holdDuration: number;
            actions: any[];
            sceneTheme?: 'light' | 'dark' | 'auto';
        }>;
    };
}

const REDIS_TTL_SECONDS = 60 * 60 * 24; // 24 hours — long enough for any pipeline run

async function renderSingleScene() {
    validateConfig(['cloudinary', 'website']);

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

    console.error(`🎬 Rendering scene ${sceneIndex} (id: "${scene.id}")`);
    console.error(`⏱  Duration: ${scene.baseDuration + (scene.holdDuration ?? 0)}s`);

    // Render — renderScenes returns the real Cloudinary URL with version
    const result = await renderScenes({
        scenes: [scene],
        videoId: `${videoId}-live-render`,  // unique prefix to avoid collision with daily pipeline
        isShort: false,
    });

    const clipUrl = result.urls[0];
    const timing = result.timings[0];
    const animationStopTime = result.animationStopTimes[0];

    console.error(`✅ Scene ${sceneIndex} rendered: ${clipUrl}`);

    // ── Store in Redis ──────────────────────────────────────────────────────
    const redis = new Redis(process.env.REDIS_URL!);
    try {
        const prefix = `live:${videoId}:scene:${sceneIndex}`;
        await redis.setex(`${prefix}:clip_url`,            REDIS_TTL_SECONDS, clipUrl);
        await redis.setex(`${prefix}:clip_timing`,         REDIS_TTL_SECONDS, String(timing));
        await redis.setex(`${prefix}:animation_stop_time`, REDIS_TTL_SECONDS, String(animationStopTime));

        console.error(`📦 Stored in Redis: ${prefix}:clip_url → ${clipUrl}`);
    } finally {
        await redis.quit();
    }
}

(async () => {
    try {
        await renderSingleScene();
        process.exit(0);
    } catch (error) {
        console.error('❌ Live scene rendering failed:', error);
        process.exit(1);
    }
})();
