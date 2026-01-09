/**
 * Simplified orchestration for GitHub Actions
 * Pure function pipeline - no Redis dependencies
 */

import { renderScenes } from '../../video-scene-renderer/src/index';
import { generateVoiceOvers } from '../../voice-over-generation/src/index';
import { assembleVideo } from '../../video-assembler/src/index';
import { uploadToYouTube } from '../../youtube-upload/src/index';
import { validateConfig } from '../../../shared/config';

/**
 * Calculate the next 4:30 PM IST publish time
 * @param dayOffset Number of days to offset from today (0 = today, 1 = tomorrow)
 */
function getNext430PMISTPublishTime(dayOffset: number = 0): string {
    const now = new Date();

    // IST is UTC+5:30
    const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    const istNow = new Date(now.getTime() + istOffset);

    // Set to 4:30 PM IST (16:30)
    const targetIST = new Date(istNow);
    targetIST.setHours(16, 30, 0, 0);

    // Add day offset
    targetIST.setDate(targetIST.getDate() + dayOffset);

    // Convert back to UTC for YouTube API
    const utcPublishTime = new Date(targetIST.getTime() - istOffset);

    return utcPublishTime.toISOString();
}

export interface VideoScript {
    title: string;
    description: string;
    tags: string[];
    narration: string;
    scenes: Array<{
        id: string;
        narration: string;
        baseDuration: number;
        holdDuration: number;
        actions: any[];
    }>;
    shorts: Array<{
        id: string;
        hook: string;
        narration: string;
        baseDuration: number;
        holdDuration: number;
        actions: any[];
    }>;
}

/**
 * Main orchestration function - generates full video and shorts
 */
export async function orchestrateVideoGeneration(videoIdea: string) {
    validateConfig(['website', 'cloudinary', 'gemini', 'youtube']);

    console.error(`💡 Video idea: "${videoIdea}"`);

    // 1. Generate script via API
    console.error('📝 Generating video script...');
    const response = await fetch(`${process.env.WEBSITE_DOMAIN}/api/generate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoIdea }),
    });

    if (!response.ok) {
        throw new Error(`Script generation failed: ${response.statusText}`);
    }

    const data = await response.json() as { script?: VideoScript; error?: string };
    if (!data.script) {
        throw new Error(data.error || 'Failed to generate script');
    }

    const script: VideoScript = data.script;
    const videoId = `video-${Date.now()}`;
    console.error(`✅ Generated script: "${script.title}"`);

    // === LONG FORM VIDEO ===
    // 2. Render scenes
    console.error('🎬 Rendering scenes...');
    const { urls: clips, timings: clipTimings, animationStopTimes } = await renderScenes({
        scenes: script.scenes,
        isShort: false,
        videoId,
    });
    console.error(`✅ Rendered ${clips.length} scenes`);

    // 3. Generate voice-overs
    console.error('🎤 Generating voice-overs...');
    const { urls: voiceOverUrls } = await generateVoiceOvers({
        perSceneNarration: script.scenes.map(s => s.narration),
        videoId,
    });
    console.error(`✅ Generated ${voiceOverUrls.length} voice-overs`);

    // 4. Assemble video
    console.error('🧩 Assembling video...');
    const assembled = await assembleVideo({
        jobId: videoId,
        videoId,
        narration: script.narration,
        perSceneNarration: script.scenes.map(s => s.narration),
        narrationAudios: voiceOverUrls,
        clips,
        clipTimings,
        animationStopTimes,
        isShort: false,
    });
    console.error(`✅ Assembled video: ${assembled.outputUrl}`);

    // 5. Upload to YouTube
    console.error('📤 Uploading video to YouTube...');
    const { videoId: youtubeId } = await uploadToYouTube({
        videoUrl: assembled.outputUrl,
        isShort: false,
        title: script.title,
        description: script.description,
        tags: script.tags,
    });
    console.error(`✅ Uploaded to YouTube: ${youtubeId}`);

    // === SHORTS ===
    console.error(`\n📱 Processing ${script.shorts.length} shorts...`);
    const shortsResults = [];

    for (let i = 0; i < script.shorts.length; i++) {
        const short = script.shorts[i];
        const shortId = `${videoId}-short-${i}`;

        console.error(`\n📱 Processing short ${i + 1}/${script.shorts.length}: ${short.hook}`);

        // Render, generate voiceover, assemble, and upload
        const { urls: shortClips, timings: shortTimings, animationStopTimes: shortStopTimes } =
            await renderScenes({
                scenes: [{
                    id: short.id, baseDuration: short.baseDuration,
                    holdDuration: short.holdDuration, actions: short.actions
                }],
                isShort: true,
                videoId: shortId,
            });

        const { urls: shortVoiceOvers } = await generateVoiceOvers({
            perSceneNarration: [short.narration],
            videoId: shortId,
        });

        const assembledShort = await assembleVideo({
            jobId: shortId,
            videoId: shortId,
            narration: short.narration,
            perSceneNarration: [short.narration],
            narrationAudios: shortVoiceOvers,
            clips: shortClips,
            clipTimings: shortTimings,
            animationStopTimes: shortStopTimes,
            isShort: true,
        });

        // Schedule all shorts for the same time (today at 4:30 PM IST)
        const scheduledPublishTime = getNext430PMISTPublishTime(0);
        console.error(`📤 Scheduling short ${i + 1} for ${scheduledPublishTime}...`);

        const { videoId: youtubeShortId } = await uploadToYouTube({
            videoUrl: assembledShort.outputUrl,
            isShort: true,
            title: short.hook,
            description: script.description,
            tags: script.tags,
            privacyStatus: 'private', // Required for scheduled publishing
            scheduledPublishTime,
        });

        console.error(`✅ Short ${i + 1} uploaded: ${youtubeShortId} (scheduled for ${scheduledPublishTime})`);
        shortsResults.push({ youtubeShortId, videoUrl: assembledShort.outputUrl, scheduledPublishTime });
    }

    return {
        youtubeId,
        assembledUrl: assembled.outputUrl,
        shorts: shortsResults,
    };
}
