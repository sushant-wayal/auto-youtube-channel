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

    console.log(`📤 Uploading video to YouTube: ${data.script.title}`);
    if (thumbnailUrl) {
        console.log(`🖼️  Thumbnail URL: ${thumbnailUrl}`);
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

    console.log(`✅ Uploaded to YouTube: ${result.videoId}`);
    return result;
}

// Main execution
(async () => {
    try {
        const videoUrl = process.argv[2];
        const scriptData = process.argv[3];
        const thumbnailUrl = process.argv[4]; // Optional

        if (!videoUrl || !scriptData) {
            throw new Error('Missing required arguments: videoUrl and scriptData');
        }

        const result = await uploadVideo(videoUrl, scriptData, thumbnailUrl);

        // Output for GitHub Actions
        console.log(`youtube_id=${result.videoId}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ YouTube upload failed:', error);
        process.exit(1);
    }
})();
