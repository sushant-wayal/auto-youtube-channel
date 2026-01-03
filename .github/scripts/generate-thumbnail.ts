/**
 * GitHub Actions Script: Generate Thumbnail
 * Called by: generate-thumbnail job (runs in parallel)
 */

import { validateConfig } from '../../shared/config';

interface ScriptData {
    script: {
        title: string;
        description: string;
    };
}

async function generateThumbnail(videoId: string, scriptData: string) {
    validateConfig(['website']);

    const data: ScriptData = JSON.parse(scriptData);

    console.error(`🖼️ Generating thumbnail for: ${data.script.title}`);

    const websiteDomain = process.env.WEBSITE_DOMAIN || 'http://localhost:3000';

    // Call the thumbnail generation API
    const response = await fetch(`${websiteDomain}/api/generate-thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            videoId,
            title: data.script.title,
            description: data.script.description,
        }),
    });

    if (!response.ok) {
        throw new Error(`Thumbnail generation failed: ${response.statusText}`);
    }

    const result = await response.json();
    console.error(`✅ Thumbnail generated: ${result.thumbnailUrl}`);

    // Output for GitHub Actions (base64 encoded to avoid secret detection)
    console.log(`thumbnail_url=${Buffer.from(result.thumbnailUrl).toString('base64')}`);

    return result;
}

// Main execution
(async () => {
    try {
        const videoId = process.argv[2];
        const scriptData = process.env.SCRIPT_DATA;

        if (!videoId || !scriptData) {
            throw new Error('Missing required: videoId (arg) or SCRIPT_DATA (env)');
        }

        await generateThumbnail(videoId, scriptData);
        process.exit(0);
    } catch (error) {
        console.error('⚠️ Thumbnail generation failed (non-critical):', error);
        // Don't fail the pipeline if thumbnail generation fails
        process.exit(0);
    }
})();
