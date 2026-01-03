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

    console.log(`🖼️ Generating thumbnail for: ${data.script.title}`);

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
    console.log(`✅ Thumbnail generated: ${result.thumbnailUrl}`);

    // Output for GitHub Actions
    console.log(`thumbnail_url=${result.thumbnailUrl}`);

    return result;
}

// Main execution
(async () => {
    try {
        const videoId = process.argv[2];
        const scriptData = process.argv[3];

        if (!videoId || !scriptData) {
            throw new Error('Missing required arguments: videoId and scriptData');
        }

        await generateThumbnail(videoId, scriptData);
        process.exit(0);
    } catch (error) {
        console.error('⚠️ Thumbnail generation failed (non-critical):', error);
        // Don't fail the pipeline if thumbnail generation fails
        process.exit(0);
    }
})();
