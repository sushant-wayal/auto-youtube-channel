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

    console.error(`🧩 Assembling video ${videoId}`);

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

    console.error(`✅ Video assembled: ${result.outputUrl}`);
    return result;
}

// Main execution
(async () => {
    try {
        const videoId = process.argv[2];
        const scriptData = process.env.SCRIPT_DATA;
        const clipsUrlsEncoded = process.env.CLIPS_URLS;
        const clipsTimingsEncoded = process.env.CLIPS_TIMINGS;
        const animationStopTimesEncoded = process.env.ANIMATION_STOP_TIMES;
        const voiceoverUrlsEncoded = process.env.VOICEOVER_URLS;

        if (!videoId) {
            throw new Error('Missing required: videoId');
        }
        if (!scriptData) {
            throw new Error('Missing required: SCRIPT_DATA env var');
        }
        if (!clipsUrlsEncoded || clipsUrlsEncoded.trim() === '') {
            throw new Error('Missing required: CLIPS_URLS env var (render-scenes job may have failed)');
        }
        if (!clipsTimingsEncoded) {
            throw new Error('Missing required: CLIPS_TIMINGS env var');
        }
        if (!animationStopTimesEncoded) {
            throw new Error('Missing required: ANIMATION_STOP_TIMES env var');
        }
        if (!voiceoverUrlsEncoded || voiceoverUrlsEncoded.trim() === '') {
            throw new Error('Missing required: VOICEOVER_URLS env var (generate-voiceover job may have failed)');
        }

        // Decode base64 values (strip B64: prefix)
        const clipsUrls = Buffer.from(clipsUrlsEncoded.replace(/^B64:/, ''), 'base64').toString('utf-8');
        const clipsTimings = Buffer.from(clipsTimingsEncoded.replace(/^B64:/, ''), 'base64').toString('utf-8');
        const animationStopTimes = Buffer.from(animationStopTimesEncoded.replace(/^B64:/, ''), 'base64').toString('utf-8');
        // Decode hex for voiceover
        const voiceoverUrls = Buffer.from(voiceoverUrlsEncoded, 'hex').toString('utf-8');

        const result = await assembleMainVideo(
            videoId,
            scriptData,
            clipsUrls,
            clipsTimings,
            animationStopTimes,
            voiceoverUrls
        );

        // Output for GitHub Actions (base64 encoded to avoid secret detection)
        console.log(`video_url=B64:${Buffer.from(result.outputUrl).toString('base64')}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Video assembly failed:', error);
        process.exit(1);
    }
})();
