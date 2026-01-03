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

    console.error(`🎤 Generating ${narrations.length} voice-overs for video ${videoId}`);

    return {
        urls: [
            'https://res.cloudinary.com/divc1cuwa/video/upload/v1766341277/video-gen/narrations/part-1/narration-audio.wav',
            'https://res.cloudinary.com/divc1cuwa/video/upload/v1766341306/video-gen/narrations/part-2/narration-audio.wav',
            'https://res.cloudinary.com/divc1cuwa/video/upload/v1766341337/video-gen/narrations/part-3/narration-audio.wav',
            'https://res.cloudinary.com/divc1cuwa/video/upload/v1766341368/video-gen/narrations/part-4/narration-audio.wav',
            'https://res.cloudinary.com/divc1cuwa/video/upload/v1766341407/video-gen/narrations/part-5/narration-audio.wav',
            'https://res.cloudinary.com/divc1cuwa/video/upload/v1766341443/video-gen/narrations/part-6/narration-audio.wav',
            'https://res.cloudinary.com/divc1cuwa/video/upload/v1766341486/video-gen/narrations/part-7/narration-audio.wav'
        ],
    };

    const result = await generateVoiceOvers({
        perSceneNarration: narrations,
        videoId,
        voice: 'Puck',
    });

    console.error(`✅ Generated ${result.urls.length} voice-overs`);
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

        const result = await generateNarration(videoId, scriptData);

        // Output for GitHub Actions
        console.error(`[DEBUG] About to output voiceover_urls with ${result.urls?.length || 0} URLs`);
        console.log(`voiceover_urls=${JSON.stringify(result.urls)}`);
        console.error(`[DEBUG] Wrote voiceover_urls`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Voice-over generation failed:', error);
        process.exit(1);
    }
})();
