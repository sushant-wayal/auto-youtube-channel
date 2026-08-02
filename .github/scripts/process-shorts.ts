/**
 * GitHub Actions Script: Process Shorts
 * Called by: process-shorts job
 */

import { renderScenes } from '../../workers/video-scene-renderer/src/index';
import { generateVoiceOvers } from '../../workers/voice-over-generation/src/index';
import { assembleVideo } from '../../workers/video-assembler/src/index';
import { uploadToYouTube, formatYouTubeTitle } from '../../workers/youtube-upload/src/index';
import { validateConfig } from '../../shared/config';
import { getShortsPublishTimeByRank } from '../../shared/services/shorts-publish-time-service';

/**
 * Calculate publish time from IST time string
 * @param timeIST Time in HH:MM format (IST)
 * @param dayOffset Number of days to offset from today (0 = today, 1 = tomorrow)
 */
function getPublishTimeFromISTTime(timeIST: string, dayOffset: number = 0): string {
    const now = new Date();
    const [hours, minutes] = timeIST.split(':').map(Number);

    // IST is UTC+5:30
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);

    // Set to target time IST
    const targetIST = new Date(istNow);
    targetIST.setHours(hours, minutes, 0, 0);

    // Add day offset
    targetIST.setDate(targetIST.getDate() + dayOffset);

    // Convert back to UTC for YouTube API
    const utcPublishTime = new Date(targetIST.getTime() - istOffset);

    return utcPublishTime.toISOString();
}

interface ScriptData {
    script: {
        description: string;
        tags: string[];
        shorts: Array<{
            id: string;
            hook: string;
            scenes: Array<{
                id: string;
                narration: string;
                baseDuration: number;
                holdDuration: number;
                actions: any[];
            }>;
        }>;
    };
}

async function processAllShorts(videoId: string, scriptData: string) {
    validateConfig(['cloudinary', 'voiceover', 'youtube']);

    const data: ScriptData = JSON.parse(scriptData);
    const shorts = data.script.shorts;

    console.error(`📱 Processing ${shorts.length} shorts for video ${videoId}`);

    const results = [];

    for (let i = 0; i < shorts.length; i++) {
        const short = shorts[i];
        const shortId = `${videoId}-short-${i}`;

        console.error(`\n📱 Processing short ${i + 1}/${shorts.length}: ${short.hook || '(no hook)'}`);

        // Derive title: use hook field if present, otherwise fall back to first scene narration or shortId
        const rawTitle = short.hook
            || short.scenes.find(s => s.narration)?.narration.slice(0, 60)
            || shortId;
        const shortTitle = formatYouTubeTitle(rawTitle, 100);

        // 1. Render all scenes for short (hook + content)
        console.error(`🎬 Rendering ${short.scenes.length} scenes for short ${i + 1}...`);

        const isAiRender = (process.env.SCENE_RENDER_METHOD || '').toLowerCase() === 'ai';

        if (!isAiRender) {
            // Validate first scene is hook scene
            const hookScene = short.scenes[0];
            if (!hookScene || hookScene.id !== 'hook') {
                throw new Error(`Short ${i + 1} must have first scene with id='hook'`);
            }
            if (hookScene.narration !== '') {
                throw new Error(`Hook scene must have empty narration (short ${i + 1})`);
            }
            if (hookScene.baseDuration < 0.8 || hookScene.baseDuration > 1.5) {
                console.warn(`⚠️ Hook scene duration ${hookScene.baseDuration}s outside recommended range 0.8-1.5s`);
            }

            console.error(`   Hook scene: ${hookScene.baseDuration}s (no narration)`);
        }

        // Log content scenes
        const contentScenes = isAiRender ? short.scenes : short.scenes.slice(1);
        contentScenes.forEach((scene, idx) => {
            const totalDuration = scene.baseDuration + scene.holdDuration;
            const sceneNum = isAiRender ? idx + 1 : idx + 2;
            console.error(`   Scene ${sceneNum}: ${totalDuration}s (${scene.baseDuration}s base + ${scene.holdDuration}s hold)`);
        });

        const { urls: clips, timings, animationStopTimes } = await renderScenes({
            scenes: short.scenes,
            isShort: true,
            videoId: shortId,
        });

        // 2. Generate voice-over for ALL scenes (including hook with empty narration)
        // This ensures array lengths match between clips and narrations
        const allNarrations = short.scenes.map(scene => scene.narration);
        console.error(`🎤 Generating voice-over for ${allNarrations.length} scenes (including hook)...`);

        const { urls: voiceovers } = await generateVoiceOvers({
            perSceneNarration: allNarrations,
            videoId: shortId,
            voice: 'Puck',
        });

        // 3. Assemble short
        console.error(`🧩 Assembling short ${i + 1}...`);

        // Combine content narrations for metadata (skip empty hook narration)
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

        // 4. Upload to YouTube with ranked schedule time
        // Assign shorts to ranked time slots based on position (rank)
        const shortsRank = Math.min(i, 4); // Cap at rank 4 (we have 5 slots)
        const shortsTime = await getShortsPublishTimeByRank(shortsRank);
        const scheduledPublishTime = getPublishTimeFromISTTime(shortsTime, 0);
        console.error(`📤 Uploading short ${i + 1} (Rank ${shortsRank + 1}) to YouTube (scheduled for ${shortsTime} IST / ${scheduledPublishTime})...`);

        const { videoId: youtubeId } = await uploadToYouTube({
            videoUrl: assembled.outputUrl,
            isShort: true,
            title: shortTitle,
            description: data.script.description,
            tags: data.script.tags,
            privacyStatus: 'private', // Required for scheduled publishing
            scheduledPublishTime,
        });

        console.error(`✅ Short ${i + 1} completed: ${youtubeId} (Rank ${shortsRank + 1} - scheduled for ${shortsTime} IST)`);

        results.push({
            shortId,
            youtubeId,
            videoUrl: assembled.outputUrl,
            scheduledPublishTime,
            rank: shortsRank + 1,
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
