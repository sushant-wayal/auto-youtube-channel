import GeminiTTSService from './lib/gemini/gemini-tts-service';
import F5TTSService from './lib/f5/f5-tts-service';
import config, { validateConfig } from '../../../shared/config';
import path from 'path';
import fs from 'fs/promises';

/**
 * Pure function: generates voice-over audio files for each narration and uploads to Cloudinary
 * @param perSceneNarration string[]
 * @param videoId string (for output folder naming)
 * @param voice string (optional voice selection)
 * @returns { urls: string[] }
 */
export async function generateVoiceOvers({
    perSceneNarration,
    videoId,
    voice = 'Puck',
}: {
    perSceneNarration: string[];
    videoId: string;
    voice?: string;
}): Promise<{ urls: string[] }> {
    validateConfig(['cloudinary', 'voiceover']);

    const provider = (config.voiceover.provider || 'gemini').toLowerCase();
    const primary = provider === 'f5' ? 'f5' : 'gemini';
    const fallback = primary === 'gemini' ? 'f5' : 'gemini';
    const outputDir = path.join('voiceover_tmp', videoId);

    await fs.mkdir(outputDir, { recursive: true });

    const tryGenerate = async (method: 'gemini' | 'f5'): Promise<string[]> => {
        if (method === 'gemini') {
            validateConfig(['cloudinary', 'gemini']);
            const ttsService = new GeminiTTSService();
            return ttsService.generateNarrationAudios(
                videoId,
                perSceneNarration,
                outputDir,
                { voice }
            );
        }

        const ttsService = new F5TTSService();
        return ttsService.generateNarrationAudios(
            videoId,
            perSceneNarration,
            outputDir
        );
    };

    let lastError: unknown;

    for (const method of [primary, fallback] as const) {
        try {
            console.error(`🎤 Voice-over provider selected: ${method}`);
            const urls = await tryGenerate(method);
            await fs.rm(outputDir, { recursive: true, force: true });
            return { urls };
        } catch (error) {
            lastError = error;
            console.error(`❌ Voice-over generation failed with ${method}:`, error);
            await fs.rm(outputDir, { recursive: true, force: true });
            await fs.mkdir(outputDir, { recursive: true });
        }
    }

    throw new Error(
        `Voice-over generation failed with ${primary} and ${fallback}: ${lastError instanceof Error ? lastError.message : String(lastError)
        }`
    );
}
