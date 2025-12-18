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

// Import services from worker's internal lib
import { collectClipsForVideo } from '../lib/assets/clip-collecter';

// Import worker services
import RedisService from '../services/redis-service';

import { ClipsCollectorJob } from '../types';

class JobProcessor {
    private redisService: RedisService;

    constructor() {
        this.redisService = RedisService.getInstance();
    }

    /**
     * Process a video generation job with parallel execution
     */
    async processJob(job: ClipsCollectorJob): Promise<void> {
        const { jobId, videoIdea, narration } = job;
        console.log(`\n🎬 === PROCESSING JOB: ${jobId} ===`);
        console.log(`📝 Video Idea: ${videoIdea}`);

        const videoId = `video-${Date.now()}`;

        try {

            console.log(`🎬 Starting assets collection...`);

            await this.redisService.updateJobProgress(
                jobId, 'processing', 10, 'Extracting key phrases for clip collection'
            );

            const clipResult = await collectClipsForVideo(jobId, videoId, narration);
            console.log(`✅ Downloaded ${clipResult.clipUrls.length} clips`);

            await this.redisService.completeJob(jobId, {
                videoId,
                clipsUrls: clipResult.clipUrls,
                clipTimings: clipResult.clipTimings
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
