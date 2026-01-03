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

        // Output for GitHub Actions
        console.log(`clips_urls=${JSON.stringify(result.urls)}`);
        console.log(`clips_timings=${JSON.stringify(result.timings)}`);
        console.log(`animation_stop_times=${JSON.stringify(result.animationStopTimes)}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Scene rendering failed:', error);
        process.exit(1);
    }
})();
