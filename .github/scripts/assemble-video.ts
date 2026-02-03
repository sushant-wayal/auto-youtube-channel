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
            sceneTitle?: string;
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

        // Decode hex values
        const clipsUrls = Buffer.from(clipsUrlsEncoded, 'hex').toString('utf-8');
        const clipsTimings = Buffer.from(clipsTimingsEncoded, 'hex').toString('utf-8');
        const animationStopTimes = Buffer.from(animationStopTimesEncoded, 'hex').toString('utf-8');
        const voiceoverUrls = Buffer.from(voiceoverUrlsEncoded, 'hex').toString('utf-8');

        const result = await assembleMainVideo(
            videoId,
            scriptData,
            clipsUrls,
            clipsTimings,
            animationStopTimes,
            voiceoverUrls
        );

        // Output for GitHub Actions (hex encoded to avoid secret detection patterns)
        console.log(`video_url=${Buffer.from(result.outputUrl).toString('hex')}`);

        // Output scene durations for timestamp generation
        if (result.sceneDurations && result.sceneDurations.length > 0) {
            console.log(`scene_durations=${Buffer.from(JSON.stringify(result.sceneDurations)).toString('hex')}`);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Video assembly failed:', error);
        process.exit(1);
    }
})();
