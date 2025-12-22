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
        if (!config.prod) {
            console.log('⏸️ Skipping audio generation in non-prod environment');
            // combined audio url
            // 'https://res.cloudinary.com/divc1cuwa/video/upload/v1766300061/video-gen/68f03b4d-63b9-4872-90d7-1e80918d5893/audio/narration-audio.wav'
            await this.redisService.completeJob(job.jobId, {
                voiceOverUrls: [
                    'https://res.cloudinary.com/divc1cuwa/video/upload/v1766341277/video-gen/narrations/part-1/narration-audio.wav',
                    'https://res.cloudinary.com/divc1cuwa/video/upload/v1766341306/video-gen/narrations/part-2/narration-audio.wav',
                    'https://res.cloudinary.com/divc1cuwa/video/upload/v1766341337/video-gen/narrations/part-3/narration-audio.wav',
                    'https://res.cloudinary.com/divc1cuwa/video/upload/v1766341368/video-gen/narrations/part-4/narration-audio.wav',
                    'https://res.cloudinary.com/divc1cuwa/video/upload/v1766341407/video-gen/narrations/part-5/narration-audio.wav',
                    'https://res.cloudinary.com/divc1cuwa/video/upload/v1766341443/video-gen/narrations/part-6/narration-audio.wav',
                    'https://res.cloudinary.com/divc1cuwa/video/upload/v1766341486/video-gen/narrations/part-7/narration-audio.wav'
                ],
            });
            return;
            const silencePath = path.join(config.worker.workDir, '2min-silence.wav');

            // Generate 2 min (120s) silence audio (16-bit PCM, 16kHz, mono)
            const durationSeconds = 279;
            const sampleRate = 16000;
            const numChannels = 1;
            const bitsPerSample = 16;
            const numSamples = durationSeconds * sampleRate * numChannels;
            const headerSize = 44;
            const dataSize = numSamples * (bitsPerSample / 8);

            const buffer = Buffer.alloc(headerSize + dataSize);

            // Write WAV header
            buffer.write('RIFF', 0); // ChunkID
            buffer.writeUInt32LE(headerSize + dataSize - 8, 4); // ChunkSize
            buffer.write('WAVE', 8); // Format
            buffer.write('fmt ', 12); // Subchunk1ID
            buffer.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
            buffer.writeUInt16LE(1, 20); // AudioFormat (PCM)
            buffer.writeUInt16LE(numChannels, 22); // NumChannels
            buffer.writeUInt32LE(sampleRate, 24); // SampleRate
            buffer.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28); // ByteRate
            buffer.writeUInt16LE(numChannels * bitsPerSample / 8, 32); // BlockAlign
            buffer.writeUInt16LE(bitsPerSample, 34); // BitsPerSample
            buffer.write('data', 36); // Subchunk2ID
            buffer.writeUInt32LE(dataSize, 40); // Subchunk2Size
            // Data is already zeroed (silence)

            await fs.writeFile(silencePath, buffer);

            const silenceUpload = await this.cloudinaryService.uploadAudio(
                silencePath,
                `silence-audio`,
                '2min-silence'
            );

            console.log(`✅ 2-min silence audio uploaded to Cloudinary: ${silenceUpload.secureUrl}`);
            await fs.rm(silencePath, { force: true });

            await this.redisService.completeJob(job.jobId, {
                voiceOverUrls: [silenceUpload.secureUrl],
            });
            return;
        }

        const { jobId, videoIdea, perSceneNarration } = job;
        console.log(`\n🎬 === PROCESSING JOB: ${jobId} ===`);
        console.log(`📝 Video Idea: ${videoIdea}`);

        try {
            await this.redisService.updateJobProgress(
                jobId, 'processing', 5, 'Started generating voice-over...'
            );

            // Track results
            let voiceOverPath: string | null = null;
            let voiceOverUrl: string | null = null;

            console.log(`🎙️ Starting voice-over generation...`);
            const audioOutputDir = path.join(config.worker.workDir, jobId);
            await fs.mkdir(audioOutputDir, { recursive: true });

            const urls = await this.ttsService.generateNarrationAudios(
                jobId,
                perSceneNarration,
                audioOutputDir,
                { voice: 'Puck' }
            );
            console.log(`✅ Voice-over generated: ${urls}`);

            await fs.rm(audioOutputDir, { recursive: true, force: true });

            await this.redisService.completeJob(jobId, {
                voiceOverUrls: urls,
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
