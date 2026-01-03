import GeminiTTSService from './lib/ai/gemini-tts-service';
import { validateConfig } from '../../../shared/config';
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
    validateConfig(['cloudinary', 'gemini']);

    const ttsService = new GeminiTTSService();
    const outputDir = path.join('voiceover_tmp', videoId);
    await fs.mkdir(outputDir, { recursive: true });
    const urls = await ttsService.generateNarrationAudios(
        videoId,
        perSceneNarration,
        outputDir,
        { voice }
    );
    await fs.rm(outputDir, { recursive: true, force: true });
    return { urls };
}
