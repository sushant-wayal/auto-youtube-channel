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
import { ClipsRenderService } from '../lib/actios-to-clips';

// Import worker services
import RedisService from '../services/redis-service';
import CloudinaryService from '../services/cloudinary-service';
import config from '../config';

import { VideoSceneRendererJob } from '../types';

class JobProcessor {
    private redisService: RedisService;
    private cloudinaryService: CloudinaryService;

    constructor() {
        this.redisService = RedisService.getInstance();
        this.cloudinaryService = CloudinaryService.getInstance();
    }

    /**
     * Process a video generation job with parallel execution
     */
    async processJob(job: VideoSceneRendererJob): Promise<void> {
        if (!config.prod) {
            console.log('⏸️ Skipping video scene rendering in non-prod environment');
            await this.redisService.completeJob(job.jobId, {
                videoId: 'video-1234567890',
                clipsUrls: [
                    'https://res.cloudinary.com/divc1cuwa/video/upload/v1766232798/video-gen/scenes/scene_scene-1.mp4',
                    'https://res.cloudinary.com/divc1cuwa/video/upload/v1766232865/video-gen/scenes/scene_scene-2.mp4',
                    'https://res.cloudinary.com/divc1cuwa/video/upload/v1766232965/video-gen/scenes/scene_scene-3.mp4',
                    'https://res.cloudinary.com/divc1cuwa/video/upload/v1766233065/video-gen/scenes/scene_scene-4.mp4',
                    'https://res.cloudinary.com/divc1cuwa/video/upload/v1766233166/video-gen/scenes/scene_scene-5.mp4',
                    'https://res.cloudinary.com/divc1cuwa/video/upload/v1766233276/video-gen/scenes/scene_scene-6.mp4',
                    'https://res.cloudinary.com/divc1cuwa/video/upload/v1766233369/video-gen/scenes/scene_scene-7.mp4'
                ],
                clipTimings: [40, 40, 60, 60, 60, 65, 55],
                animationStopTimes: [24.5, 21.5, 38, 20.5, 24.5, 25, 20.5],
            });
            return;
        }
        const { jobId, scenes, videoIdea, isShort } = job;

        const clipsRenderService = new ClipsRenderService(scenes, jobId);

        console.log(`\n🎬 === PROCESSING JOB: ${jobId} ===`);
        console.log(`📝 Video Idea: ${videoIdea}`);

        const videoId = `video-${Date.now()}`;

        try {
            
            console.log(`\n🎥 Starting scene rendering...`);

            await this.redisService.updateJobProgress(
                jobId, 'processing', 5, 'Rendering video scenes...'
            );

            const outputDir = path.join(config.worker.workDir, videoId, 'scenes');

            const { urls: clips, timings: clipTimings, animationStopTimes } = await clipsRenderService.renderScenes(
                isShort ? config.video.short.width : config.video.long.width,
                isShort ? config.video.short.height : config.video.long.height,
                isShort ? config.video.short.fps : config.video.long.fps,
                outputDir
            );
            console.log(`✅ Scene rendering completed. Clips generated: ${clips.length}`);

            await this.redisService.completeJob(jobId, {
                videoId,
                clipsUrls: clips,
                clipTimings: clipTimings,
                animationStopTimes
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
