/**
 * GitHub Actions Script: Assemble Video
 * Called by: assemble-video job
 */

import { assembleVideo } from '../../workers/video-assembler/src/index';
import { validateConfig } from '../../shared/config';

interface ScriptData {
    script: {
        narration: string;
        scenes: Array<{
            narration: string;
        }>;
    };
}

async function assembleMainVideo(
    videoId: string,
    scriptData: string,
    clipsUrls: string,
    clipsTimings: string,
    animationStopTimes: string,
    voiceoverUrls: string
) {
    validateConfig(['cloudinary']);

    const data: ScriptData = JSON.parse(scriptData);
    const clips: string[] = JSON.parse(clipsUrls);
    const timings: number[] = JSON.parse(clipsTimings);
    const stopTimes: number[] = JSON.parse(animationStopTimes);
    const voiceovers: string[] = JSON.parse(voiceoverUrls);

    console.log(`🧩 Assembling video ${videoId}`);

    const result = await assembleVideo({
        jobId: videoId,
        videoId,
        narration: data.script.narration,
        perSceneNarration: data.script.scenes.map(s => s.narration),
        narrationAudios: voiceovers,
        clips,
        clipTimings: timings,
        animationStopTimes: stopTimes,
        isShort: false,
    });

    console.log(`✅ Video assembled: ${result.outputUrl}`);
    return result;
}

// Main execution
(async () => {
    try {
        const [videoId, scriptData, clipsUrls, clipsTimings, animationStopTimes, voiceoverUrls] = process.argv.slice(2);

        if (!videoId || !scriptData || !clipsUrls || !clipsTimings || !animationStopTimes || !voiceoverUrls) {
            throw new Error('Missing required arguments');
        }

        const result = await assembleMainVideo(
            videoId,
            scriptData,
            clipsUrls,
            clipsTimings,
            animationStopTimes,
            voiceoverUrls
        );

        // Output for GitHub Actions
        console.log(`video_url=${result.outputUrl}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Video assembly failed:', error);
        process.exit(1);
    }
})();
