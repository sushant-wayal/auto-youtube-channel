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
import VideoGenerationService from '../services/video-generation-service';

// Import worker services
import RedisService from '../services/redis-service';
import config from '../config';

import { AutoVideoGenerationAndUploadJob } from '../types';

class JobProcessor {
    private redisService: RedisService;

    constructor() {
        this.redisService = RedisService.getInstance();
    }

    /**
     * Check if job is duplicate or not
     */
    async isDuplicateJob(): Promise<boolean> {
        const lockAcquired = await this.redisService.acquireDailyGenerationLock();
        return !lockAcquired;
    }

    /**
     * Upload video related to videoIdea on youtube
     */
    async processJob(job: AutoVideoGenerationAndUploadJob): Promise<void> {

        const { jobId, videoIdea } = job;
        console.log(`\n🎬 === PROCESSING JOB: ${jobId} ===`);
        console.log(`📝 Video Idea: ${videoIdea}`);

        const videoGenerationService = new VideoGenerationService(videoIdea);

        try {

            await this.redisService.updateJobProgress(jobId, 'processing', 10, 'Generating videos and uploading to YouTube');
            
            const urls = await videoGenerationService.generateAllVideosAndUpload();

            await this.redisService.completeJob(jobId, { uploadedVideoUrls: urls });

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
