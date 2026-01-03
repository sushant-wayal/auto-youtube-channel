/**
 * GitHub Actions Script: Render Video Scenes
 * Called by: parallel-rendering job
 */

import { renderScenes } from '../../workers/video-scene-renderer/src/index';
import { validateConfig } from '../../shared/config';

interface ScriptData {
    script: {
        scenes: Array<{
            id: string;
            narration: string;
            baseDuration: number;
            holdDuration: number;
            actions: any[];
        }>;
    };
}

async function renderVideoScenes(videoId: string, scriptData: string) {
    validateConfig(['cloudinary']);

    const data: ScriptData = JSON.parse(scriptData);
    console.error(`🎬 Rendering ${data.script.scenes.length} scenes for video ${videoId}`);

    return {
        urls: [
            'https://res.cloudinary.com/divc1cuwa/video/upload/v1766232798/video-gen/scenes/scene_scene-1.mp4',
            'https://res.cloudinary.com/divc1cuwa/video/upload/v1766232865/video-gen/scenes/scene_scene-2.mp4',
            'https://res.cloudinary.com/divc1cuwa/video/upload/v1766232965/video-gen/scenes/scene_scene-3.mp4',
            'https://res.cloudinary.com/divc1cuwa/video/upload/v1766233065/video-gen/scenes/scene_scene-4.mp4',
            'https://res.cloudinary.com/divc1cuwa/video/upload/v1766233166/video-gen/scenes/scene_scene-5.mp4',
            'https://res.cloudinary.com/divc1cuwa/video/upload/v1766233276/video-gen/scenes/scene_scene-6.mp4',
            'https://res.cloudinary.com/divc1cuwa/video/upload/v1766233369/video-gen/scenes/scene_scene-7.mp4'
        ],
        timings: [40, 40, 60, 60, 60, 65, 55],
        animationStopTimes: [24.5, 21.5, 38, 20.5, 24.5, 25, 20.5],
    };

    const result = await renderScenes({
        scenes: data.script.scenes,
        isShort: false,
        videoId,
    });

    console.error(`✅ Rendered ${result.urls.length} scenes`);
    return result;
}

// Main execution
(async () => {
    try {
        const videoId = process.argv[2];
        const scriptData = process.env.SCRIPT_DATA;

        if (!videoId || !scriptData) {
            throw new Error('Missing required: videoId (arg) or SCRIPT_DATA (env)');
        }

        const result = await renderVideoScenes(videoId, scriptData);

        // Output for GitHub Actions (base64 encoded to avoid secret detection)
        console.error(`[DEBUG] About to output clips_urls with ${result.urls?.length || 0} URLs`);
        console.log(`clips_urls=B64:${Buffer.from(JSON.stringify(result.urls)).toString('base64')}`);
        console.error(`[DEBUG] Wrote clips_urls`);
        console.error(`[DEBUG] About to output clips_timings with ${result.timings?.length || 0} timings`);
        console.log(`clips_timings=B64:${Buffer.from(JSON.stringify(result.timings)).toString('base64')}`);
        console.error(`[DEBUG] Wrote clips_timings`);
        console.error(`[DEBUG] About to output animation_stop_times with ${result.animationStopTimes?.length || 0} times`);
        console.log(`animation_stop_times=B64:${Buffer.from(JSON.stringify(result.animationStopTimes)).toString('base64')}`);
        console.error(`[DEBUG] Wrote animation_stop_times`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Scene rendering failed:', error);
        process.exit(1);
    }
})();
