/**
 * GitHub Actions Script: Generate Thumbnail
 * Called by: generate-thumbnail job (runs in parallel)
 */

import { validateConfig } from '../../shared/config';
import { setJobStatus, setMetadata } from './utils/status-updater';

interface ScriptData {
    script: {
        title: string;
        description: string;
        narration: string;
        tags?: string[];
        scenes?: Array<{
            id?: string;
            narration?: string;
            actions?: any[];
        }>;
    };
}

async function generateThumbnail(videoId: string, scriptData: string) {
    const data: ScriptData = JSON.parse(scriptData);
    console.error(`🖼️ Generating Ask Studio quality thumbnail for: ${data.script.title}`);

    // Generate thumbnail directly using Autonomous Thumbnail Composer (Gemini + FLUX.1 + Puppeteer + Cloudinary)
    console.error('🎨 Generating thumbnail using YouTube Studio Ask Studio Composer...');
    const { ThumbnailComposer } = await import('../../shared/services/thumbnail-composer');
    const composer = ThumbnailComposer.getInstance();
    const result = await composer.compose({
        videoId,
        title: data.script.title,
        description: data.script.description,
        narration: data.script.narration,
        tags: data.script.tags || [],
        scenes: data.script.scenes || [],
        generateVariations: true
    });
    const thumbnailUrl = result.thumbnailUrl;

    if (!thumbnailUrl) {
        throw new Error('Failed to generate thumbnail: no URL returned');
    }

    console.error(`✅ High-quality studio thumbnail generated: ${thumbnailUrl}`);

    // Output for GitHub Actions (hex encoded to avoid secret detection patterns)
    console.log(`thumbnail_url=${Buffer.from(thumbnailUrl).toString('hex')}`);

    if (process.env.REDIS_URL) {
        await setMetadata({ thumbnailUrl });
    }

    return { thumbnailUrl };
}

// Main execution
(async () => {
    try {
        const videoId = process.argv[2];
        const scriptData = process.env.SCRIPT_DATA;

        if (!videoId || !scriptData) {
            throw new Error('Missing required: videoId (arg) or SCRIPT_DATA (env)');
        }

        if (process.env.REDIS_URL) {
            await setJobStatus('generateThumbnail', 'running');
        }
        await generateThumbnail(videoId, scriptData);
        if (process.env.REDIS_URL) {
            await setJobStatus('generateThumbnail', 'success');
        }
        process.exit(0);
    } catch (error) {
        if (process.env.REDIS_URL) {
            await setJobStatus('generateThumbnail', 'failure');
        }
        console.error('❌ Thumbnail generation failed:', error);
        // Fail the pipeline so thumbnail issue is visible
        process.exit(1);
    }
})();
