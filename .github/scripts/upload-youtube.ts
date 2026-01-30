/**
 * GitHub Actions Script: Upload to YouTube
 * Called by: upload-youtube job
 */

import { uploadToYouTube } from '../../workers/youtube-upload/src/index';
import { validateConfig } from '../../shared/config';
import { getLongFormPublishTime } from '../../shared/services/shorts-publish-time-service';

interface ScriptData {
    script: {
        title: string;
        description: string;
        tags: string[];
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

async function uploadVideo(videoUrl: string, scriptData: string, thumbnailUrl?: string) {
    validateConfig(['youtube']);

    const data: ScriptData = JSON.parse(scriptData);

    console.error(`📤 Uploading video to YouTube: ${data.script.title}`);
    if (thumbnailUrl) {
        console.error(`🖼️  Thumbnail URL: ${thumbnailUrl}`);
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
    });

    console.error(`✅ Uploaded to YouTube: ${result.videoId}`);
    return result;
}

// Main execution
(async () => {
    try {
        const videoUrlEncoded = process.env.VIDEO_URL;
        const scriptData = process.env.SCRIPT_DATA;
        const thumbnailUrlEncoded = process.env.THUMBNAIL_URL; // Optional

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

        const result = await uploadVideo(videoUrl, scriptData, thumbnailUrl);

        // Output for GitHub Actions
        console.log(`youtube_id=${result.videoId}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ YouTube upload failed:', error);
        process.exit(1);
    }
})();
