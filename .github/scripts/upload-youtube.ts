/**
 * GitHub Actions Script: Upload to YouTube
 * Called by: upload-youtube job
 */

import { uploadToYouTube } from '../../workers/youtube-upload/src/index';
import { validateConfig } from '../../shared/config';

interface ScriptData {
    script: {
        title: string;
        description: string;
        tags: string[];
    };
}

async function uploadVideo(videoUrl: string, scriptData: string, thumbnailUrl?: string) {
    validateConfig(['youtube']);

    const data: ScriptData = JSON.parse(scriptData);

    console.error(`📤 Uploading video to YouTube: ${data.script.title}`);
    if (thumbnailUrl) {
        console.error(`🖼️  Thumbnail URL: ${thumbnailUrl}`);
    }

    const result = await uploadToYouTube({
        videoUrl,
        isShort: false,
        title: data.script.title,
        description: data.script.description,
        tags: data.script.tags,
        thumbnailUrl: thumbnailUrl || undefined,
        privacyStatus: 'public',
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
        const thumbnailUrl = thumbnailUrlEncoded ? Buffer.from(thumbnailUrlEncoded, 'hex').toString('utf-8') : undefined;

        const result = await uploadVideo(videoUrl, scriptData, thumbnailUrl);

        // Output for GitHub Actions
        console.log(`youtube_id=${result.videoId}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ YouTube upload failed:', error);
        process.exit(1);
    }
})();
