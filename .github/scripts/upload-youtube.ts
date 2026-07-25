/**
 * GitHub Actions Script: Upload to YouTube
 * Called by: upload-youtube job
 */

import { uploadToYouTube } from '../../workers/youtube-upload/src/index';
import { validateConfig } from '../../shared/config';
import { getLongFormPublishTime } from '../../shared/services/shorts-publish-time-service';
import { setJobStatus, setMetadata } from './utils/status-updater';

interface ScriptData {
    script: {
        title: string;
        description: string;
        tags: string[];
        scenes: Array<{
            sceneTitle?: string;
            narration: string;
        }>;
    };
    seriesContext?: {
        seriesId: string;
        seriesTitle: string;
        episodeId: string;
        topic: string;
    };
}

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

async function uploadVideo(videoUrl: string, scriptData: string, thumbnailUrl?: string, sceneDurationsEncoded?: string) {
    validateConfig(['youtube']);

    const data: ScriptData = JSON.parse(scriptData);

    console.error(`📤 Uploading video to YouTube: ${data.script.title}`);
    if (thumbnailUrl) {
        console.error(`🖼️  Thumbnail URL: ${thumbnailUrl}`);
    }

    // Extract scene titles and durations for timestamp generation
    let sceneTitles: string[] | undefined;
    let sceneDurations: number[] | undefined;

    if (sceneDurationsEncoded) {
        try {
            const decoded = Buffer.from(sceneDurationsEncoded, 'hex').toString('utf-8');
            sceneDurations = JSON.parse(decoded);

            // Extract scene titles from script
            sceneTitles = data.script.scenes.map(scene => {
                // Use sceneTitle if available, otherwise extract from narration
                if (scene.sceneTitle) {
                    return scene.sceneTitle;
                }
                // Fallback: extract first sentence from narration
                const narration = scene.narration.replace(/\[PAUSE=.*?\]/g, '').trim();
                const firstSentence = narration.split(/[.!?]/)[0] || narration;
                return firstSentence.length > 60
                    ? firstSentence.substring(0, 57) + '...'
                    : firstSentence;
            });

            if (sceneTitles && sceneDurations) {
                console.error(`📊 Scene metadata: ${sceneTitles.length} titles, ${sceneDurations.length} durations`);
                console.error(`📊 Video includes intro (8s) and outro (8s)`);
            }
        } catch (error) {
            console.error(`⚠️ Failed to parse scene durations:`, error);
            sceneTitles = undefined;
            sceneDurations = undefined;
        }
    }

    // Get configured long-form schedule time
    const longFormTime = await getLongFormPublishTime();
    const scheduledPublishTime = getPublishTimeFromISTTime(longFormTime, 0);
    console.error(`📅 Scheduling long-form video for ${longFormTime} IST (${scheduledPublishTime})`);

    const result = await uploadToYouTube({
        videoUrl,
        isShort: false,
        title: data.script.title,
        description: data.script.description,
        tags: data.script.tags,
        thumbnailUrl: thumbnailUrl || undefined,
        privacyStatus: 'private', // Required for scheduled publishing
        scheduledPublishTime,
        sceneTitles,  // Pass scene titles for chapters
        sceneDurations,  // Pass actual durations from assembly
        // Long-form videos have intro and outro
        hasIntro: true,
        introDuration: 8,
        introTitle: 'Intro',
        hasOutro: true,
        outroDuration: 8,
        outroTitle: 'Outro',
        seriesTitle: data.seriesContext?.seriesTitle,
    });

    console.error(`✅ Uploaded to YouTube: ${result.videoId}`);

    if (data.seriesContext) {
        console.error(`📺 Video is part of series "${data.seriesContext.seriesTitle}". Triggering completion webhook...`);
        const websiteDomain = process.env.WEBSITE_DOMAIN || 'http://localhost:3000';
        try {
            const webhookRes = await fetch(`${websiteDomain}/api/series/complete-episode`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    seriesId: data.seriesContext.seriesId,
                    episodeId: data.seriesContext.episodeId,
                    topic: data.seriesContext.topic,
                    videoId: result.videoId
                })
            });
            if (webhookRes.ok) {
                console.error(`✅ Webhook triggered successfully.`);
            } else {
                console.error(`⚠️ Webhook failed with status: ${webhookRes.status}`);
            }
        } catch (e) {
            console.error(`⚠️ Failed to trigger series webhook:`, e);
        }
    }

    return result;
}

// Main execution
(async () => {
    try {
        const videoUrlEncoded = process.env.VIDEO_URL;
        const scriptData = process.env.SCRIPT_DATA;
        const thumbnailUrlEncoded = process.env.THUMBNAIL_URL; // Optional
        const sceneDurationsEncoded = process.env.SCENE_DURATIONS; // Optional for timestamps

        if (!videoUrlEncoded || !scriptData) {
            throw new Error('Missing required: VIDEO_URL (env) or SCRIPT_DATA (env)');
        }

        // Decode hex values
        const videoUrl = Buffer.from(videoUrlEncoded, 'hex').toString('utf-8');
        const thumbnailUrl = thumbnailUrlEncoded && thumbnailUrlEncoded.length > 0
            ? Buffer.from(thumbnailUrlEncoded, 'hex').toString('utf-8')
            : undefined;

        console.error(`[DEBUG] Thumbnail URL encoded: ${thumbnailUrlEncoded || '(empty)'}`);
        console.error(`[DEBUG] Thumbnail URL decoded: ${thumbnailUrl || '(none)'}`);
        console.error(`[DEBUG] Scene durations: ${sceneDurationsEncoded ? 'present' : 'not available'}`);

        await setJobStatus('uploadYoutube', 'running');
        const result = await uploadVideo(videoUrl, scriptData, thumbnailUrl, sceneDurationsEncoded);
        await setMetadata({ youtubeId: result.videoId });
        await setJobStatus('uploadYoutube', 'success');

        // Output for GitHub Actions
        console.log(`youtube_id=${result.videoId}`);

        process.exit(0);
    } catch (error) {
        await setJobStatus('uploadYoutube', 'failure');
        console.error('❌ YouTube upload failed:', error);
        process.exit(1);
    }
})();
