/**
 * GitHub Actions Script: Process Shorts
 * Called by: process-shorts job
 */

import { renderScenes } from '../../workers/video-scene-renderer/src/index';
import { generateVoiceOvers } from '../../workers/voice-over-generation/src/index';
import { assembleVideo } from '../../workers/video-assembler/src/index';
import { uploadToYouTube } from '../../workers/youtube-upload/src/index';
import { validateConfig } from '../../shared/config';

interface ScriptData {
    script: {
        description: string;
        tags: string[];
        shorts: Array<{
            id: string;
            hook: string;
            narration: string;
            baseDuration: number;
            holdDuration: number;
            actions: any[];
        }>;
    };
}

async function processAllShorts(videoId: string, scriptData: string) {
    validateConfig(['cloudinary', 'gemini', 'youtube']);

    const data: ScriptData = JSON.parse(scriptData);
    const shorts = data.script.shorts;

    console.error(`📱 Processing ${shorts.length} shorts for video ${videoId}`);

    const results = [];

    for (let i = 0; i < shorts.length; i++) {
        const short = shorts[i];
        const shortId = `${videoId}-short-${i}`;

        console.error(`\n📱 Processing short ${i + 1}/${shorts.length}: ${short.hook}`);

        // 1. Render scenes for short
        console.error(`🎬 Rendering scenes for short ${i + 1}...`);

        // Use default durations if not provided
        const baseDuration = short.baseDuration ?? 25;
        const holdDuration = short.holdDuration ?? 0;

        console.error(`   Duration: ${baseDuration}s base + ${holdDuration}s hold = ${baseDuration + holdDuration}s total`);

        const { urls: clips, timings, animationStopTimes } = await renderScenes({
            scenes: [{
                id: short.id,
                baseDuration,
                holdDuration,
                actions: short.actions,
            }],
            isShort: true,
            videoId: shortId,
        });

        // 2. Generate voice-over for short
        console.error(`🎤 Generating voice-over for short ${i + 1}...`);
        const { urls: voiceovers } = await generateVoiceOvers({
            perSceneNarration: [short.narration],
            videoId: shortId,
            voice: 'Puck',
        });

        // 3. Assemble short
        console.error(`🧩 Assembling short ${i + 1}...`);
        const assembled = await assembleVideo({
            jobId: shortId,
            videoId: shortId,
            narration: short.narration,
            perSceneNarration: [short.narration],
            narrationAudios: voiceovers,
            clips,
            clipTimings: timings,
            animationStopTimes,
            isShort: true,
        });

        // 4. Upload to YouTube
        console.error(`📤 Uploading short ${i + 1} to YouTube...`);
        const { videoId: youtubeId } = await uploadToYouTube({
            videoUrl: assembled.outputUrl,
            isShort: true,
            title: short.hook,
            description: data.script.description,
            tags: data.script.tags,
            privacyStatus: 'public',
        });

        console.error(`✅ Short ${i + 1} completed: ${youtubeId}`);

        results.push({
            shortId,
            youtubeId,
            videoUrl: assembled.outputUrl,
        });
    }

    console.error(`\n✅ All ${shorts.length} shorts processed successfully`);
    return results;
}

// Main execution
(async () => {
    try {
        const videoId = process.argv[2];
        const scriptData = process.env.SCRIPT_DATA;

        if (!videoId || !scriptData) {
            throw new Error('Missing required: videoId (arg) or SCRIPT_DATA (env)');
        }

        const results = await processAllShorts(videoId, scriptData);
        console.log(JSON.stringify(results, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('❌ Shorts processing failed:', error);
        process.exit(1);
    }
})();
