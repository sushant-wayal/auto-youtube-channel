/**
 * Video Generation Job Processor
 * Uses internal lib services to process video generation jobs
 * 
 * Flow:
 * 1. Script Generation
 * 2. In Parallel: Voice-over + Assets + Thumbnail
 * 3. Video Assembly (waits for voice-over + assets only)
 * 4. Shorts Generation (ALL shorts run in parallel, each with parallel voice-over + assets)
 */

import path from 'path';
import fs from 'fs/promises';

// Import services from worker's internal lib
import VideoAssemblyService from '../lib/video/video-assembly';
import { pickBackgroundTrack, getBrandingAssets } from '../lib/assests/music-branding';

// Import worker services
import RedisService from '../services/redis-service';
import CloudinaryService from '../services/cloudinary-service';
import config from '../config';

import { VideoAssemblerJob } from '../types';

class JobProcessor {
    private assemblyService: VideoAssemblyService;

    private redisService: RedisService;
    private cloudinaryService: CloudinaryService;

    constructor() {
        this.assemblyService = new VideoAssemblyService(config.worker.workDir);

        this.redisService = RedisService.getInstance();
        this.cloudinaryService = CloudinaryService.getInstance();
    }

    /**
     * Process a video generation job with parallel execution
     */
    async processJob(job: VideoAssemblerJob): Promise<void> {
        const { jobId, videoIdea, clips, clipTimings, animationStopTimes, narration, voiceOverUrls, isShort, perSceneNarration } = job;
        console.log(`\n🎬 === PROCESSING JOB: ${jobId} ===`);
        console.log(`📝 Video Idea: ${videoIdea}`);
        console.log(`length of voiceOverUrls: ${voiceOverUrls.length}`);

        const videoId = `video-${Date.now()}`;

        try {
            
            console.log(`\n🎥 Starting video assembly...`);

            await this.redisService.updateJobProgress(
                jobId, 'processing', 5, 'Assembling main video with FFmpeg...'
            );

            let music: string = '';
            try {
                music = pickBackgroundTrack();
            } catch (error) {
                console.error(error);
                console.warn('⚠️ No background music available');
            }

            const branding = getBrandingAssets();

            const assembledVideo = await this.assemblyService.assembleVideo({
                jobId,
                videoId,
                clips,
                clipTimings,
                animationStopTimes,
                narration: narration,
                narrationAudios: voiceOverUrls,
                music,
                branding,
                isShort,
                perSceneNarration
            });
            console.log(`✅ Main video assembled: ${assembledVideo.duration.toFixed(1)}s`);

            // Upload main video to Cloudinary
            const mainVideoPath = path.join(config.worker.workDir, assembledVideo.outputPath);
            const mainVideoUpload = await this.cloudinaryService.uploadVideo(
                mainVideoPath,
                `${jobId}/videos`,
                'main-video'
            );

            const videoFilesDirPath = path.join(config.worker.workDir, videoId);
            await fs.rm(videoFilesDirPath, { recursive: true, force: true });
            console.log(`🧹 Cleaned up video files directory: ${videoFilesDirPath}`);

            console.log(`🗑️ Deleted local file: ${mainVideoPath}`);

            await this.redisService.updateJobProgress(
                jobId, 'processing', 95, `Main video assembled! Duration: ${assembledVideo.duration.toFixed(0)}s`,
            );

            await this.redisService.completeJob(jobId, {
                videoId,
                outputPath: mainVideoUpload.secureUrl,
                duration: assembledVideo.duration,
                clipCount: assembledVideo.clipCount
            });

            console.log(`\n🎉 === JOB COMPLETED: ${jobId} ===`);

        } catch (error) {
            console.error(`❌ Job ${jobId} failed:`, error);
            await this.redisService.failJob(
                jobId,
                error instanceof Error ? error.message : 'Unknown error'
            );
        }
    }
}

export default JobProcessor;
