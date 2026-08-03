import { ClipsRenderService } from './lib/actios-to-clips';
import { SceneIR } from './types';
import { config, validateConfig } from '../../../shared/config';
import type { SoundEvent } from '../../video-assembler/src/lib/assests/sfx-mixer';
import path from 'path';

/**
 * Pure function: renders scenes to video clips and uploads to Cloudinary
 * @param scenes SceneIR[]
 * @param videoId string (for output folder naming)
 * @param isShort boolean (default: false) - whether video is short form
 * @returns { urls, timings, animationStopTimes, perSceneSoundEvents }
 */
export async function renderScenes({
    scenes,
    isShort = false,
    videoId
}: {
    scenes: SceneIR[];
    isShort?: boolean;
    videoId: string;
}): Promise<{ urls: string[]; timings: number[]; animationStopTimes: number[]; perSceneSoundEvents: SoundEvent[][] }> {
    const renderMethod = config.sceneRendering.method === 'ai' ? 'ai' : 'code';
    validateConfig(renderMethod === 'ai' ? ['cloudinary', 'website'] : ['cloudinary']);

    const { width, height, fps } = isShort ? config.video.short : config.video.long;
    const outputDir = path.join(config.workDir, videoId, 'scenes');
    const service = new ClipsRenderService(scenes, videoId, {
        renderMethod,
        isShort,
        websiteDomain: config.website.domain,
    });
    return service.renderScenes(width, height, fps, outputDir);
}
