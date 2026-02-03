import VideoAssemblyService, { VideoAssemblyInput } from './lib/video/video-assembly';
import CloudinaryService from '../../../shared/services/cloudinary-service';
import { pickBackgroundTrack, getBrandingAssets } from './lib/assests/music-branding';
import { validateConfig } from '../../../shared/config';

/**
 * Pure function: assembles a video from provided assets and uploads to Cloudinary
 * @param input VideoAssemblyInput
 * @returns VideoAssemblyResult & Cloudinary URL
 */
export async function assembleVideo(input: VideoAssemblyInput): Promise<{
    videoId: string;
    outputUrl: string;
    duration: number;
    clipCount: number;
    sceneDurations?: number[];
}> {
    validateConfig(['cloudinary']);

    const assemblyService = new VideoAssemblyService();
    const cloudinaryService = CloudinaryService.getInstance();

    // Pick music and branding if not provided
    const music = input.music || pickBackgroundTrack();
    const branding = input.branding || getBrandingAssets();

    const assembledVideo = await assemblyService.assembleVideo({
        ...input,
        music,
        branding,
    });

    // Upload to Cloudinary
    const mainVideoPath = assembledVideo.outputPath;
    const mainVideoUpload = await cloudinaryService.uploadVideo(
        mainVideoPath,
        `${input.jobId || input.videoId}/videos`,
        'main-video'
    );

    return {
        videoId: assembledVideo.videoId,
        outputUrl: mainVideoUpload.secureUrl,
        duration: assembledVideo.duration,
        clipCount: assembledVideo.clipCount,
        sceneDurations: assembledVideo.sceneDurations,  // Pass through scene durations
    };
}
