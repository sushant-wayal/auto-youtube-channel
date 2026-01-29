import { ClipsRenderService } from './lib/actios-to-clips';
import { SceneIR } from './types';
import { config, validateConfig } from '../../../shared/config';
import path from 'path';

/**
 * Pure function: renders scenes to video clips and uploads to Cloudinary
 * @param scenes SceneIR[]
 * @param videoId string (for output folder naming)
 * @param isShort boolean (default: false) - whether video is short form
 * @param hookText string (optional) - visual hook text for Shorts (shown before actions)
 * @returns { urls: string[], timings: number[], animationStopTimes: number[] }
 */
export async function renderScenes({
    scenes,
    isShort = false,
    videoId,
    hookText
}: {
    scenes: SceneIR[];
    isShort?: boolean;
    videoId: string;
    hookText?: string;
}): Promise<{ urls: string[]; timings: number[]; animationStopTimes: number[] }> {
    validateConfig(['cloudinary']);

    const { width, height, fps } = isShort ? config.video.short : config.video.long;
    const outputDir = path.join(config.workDir, videoId, 'scenes');
    const service = new ClipsRenderService(scenes, videoId, hookText);
    return service.renderScenes(width, height, fps, outputDir);
}
