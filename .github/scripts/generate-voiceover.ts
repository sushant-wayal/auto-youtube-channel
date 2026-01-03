/**
 * GitHub Actions Script: Generate Voice-Overs
 * Called by: parallel-rendering job
 */

import { generateVoiceOvers } from '../../workers/voice-over-generation/src/index';
import { validateConfig } from '../../shared/config';

interface ScriptData {
    script: {
        scenes: Array<{
            narration: string;
        }>;
    };
}

async function generateNarration(videoId: string, scriptData: string) {
    validateConfig(['cloudinary', 'gemini']);

    const data: ScriptData = JSON.parse(scriptData);
    const narrations = data.script.scenes.map(s => s.narration);

    console.log(`🎤 Generating ${narrations.length} voice-overs for video ${videoId}`);

    const result = await generateVoiceOvers({
        perSceneNarration: narrations,
        videoId,
        voice: 'Puck',
    });

    console.log(`✅ Generated ${result.urls.length} voice-overs`);
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

        const result = await generateNarration(videoId, scriptData);

        // Output for GitHub Actions
        console.log(`voiceover_urls=${JSON.stringify(result.urls)}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Voice-over generation failed:', error);
        process.exit(1);
    }
})();
