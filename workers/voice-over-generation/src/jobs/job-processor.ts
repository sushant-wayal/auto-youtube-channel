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
import GeminiTTSService from '../lib/ai/gemini-tts-service';

// Import worker services
import RedisService from '../services/redis-service';
import CloudinaryService from '../services/cloudinary-service';
import config from '../config';

import { AudioGenerationJob } from '../types';

class JobProcessor {
    private ttsService: GeminiTTSService;

    private redisService: RedisService;
    private cloudinaryService: CloudinaryService;

    constructor() {
        this.ttsService = new GeminiTTSService();

        this.redisService = RedisService.getInstance();
        this.cloudinaryService = CloudinaryService.getInstance();
    }

    /**
     * Process a audio generation job
     */
    async processJob(job: AudioGenerationJob): Promise<void> {
        const { jobId, videoIdea, narration } = job;
        console.log(`\n🎬 === PROCESSING JOB: ${jobId} ===`);
        console.log(`📝 Video Idea: ${videoIdea}`);

        try {
            await this.redisService.updateJobProgress(
                jobId, 'processing', 45, 'Started generating voice-over...'
            );

            // Track results
            let voiceOverPath: string | null = null;
            let voiceOverUrl: string | null = null;

            console.log(`🎙️ Starting voice-over generation...`);
            const audioOutputDir = path.join(config.worker.workDir, jobId);
            await fs.mkdir(audioOutputDir, { recursive: true });

            await this.redisService.updateJobProgress(
                jobId, 'processing', 65, 'converting text to speech...'
            );

            // Generate voice-over audio
            const audioOutputPath = path.join(audioOutputDir, 'narration.wav');
            const path_ = await this.ttsService.generateNarrationAudio(
                narration,
                audioOutputPath,
                { voice: 'Puck' }
            );
            console.log(`✅ Voice-over generated: ${path_}`);

            await this.redisService.updateJobProgress(
                jobId, 'processing', 85, 'converting text to speech...'
            );

            const upload = await this.cloudinaryService.uploadAudio(
                path_,
                `${jobId}/audio`,
                'narration-audio'
            );

            console.log(`✅ Voice-over uploaded to Cloudinary: ${upload.secureUrl}`);

            await fs.rm(audioOutputDir, { recursive: true, force: true });

            await this.redisService.completeJob(jobId, {
                voiceOverUrl: upload.secureUrl,
            });

            console.log(`🎬 === JOB ${jobId} COMPLETE ===\n`);

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
