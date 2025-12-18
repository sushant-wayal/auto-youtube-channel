/**
 * Redis Service
 * Handles job queue management and progress updates
 */

import Redis from 'ioredis';
import config from '../config';
import { VideoAssemblerJob, JobStatus, JobProgress } from '../types';

const JOB_QUEUE_KEY = 'videoAssembler:jobs:queue';
const JOB_DATA_PREFIX = 'videoAssembler:job:';
const JOB_PROGRESS_PREFIX = 'videoAssembler:progress:';

class RedisService {
    private client: Redis;
    private subscriber: Redis;
    private static instance: RedisService;

    private constructor() {
        this.client = new Redis(config.redis.url);
        this.subscriber = new Redis(config.redis.url);

        this.client.on('connect', () => {
            console.log('✅ Redis client connected');
        });

        this.client.on('error', (err) => {
            console.error('❌ Redis client error:', err);
        });
    }

    static getInstance(): RedisService {
        if (!RedisService.instance) {
            RedisService.instance = new RedisService();
        }
        return RedisService.instance;
    }

    /**
     * Get the next pending job from the queue
     */
    async getNextJob(): Promise<VideoAssemblerJob | null> {
        try {
            // Get job ID from queue (FIFO)
            const jobId = await this.client.lpop(JOB_QUEUE_KEY);

            if (!jobId) {
                return null;
            }

            // Get job data
            const jobData = await this.client.get(`${JOB_DATA_PREFIX}${jobId}`);

            if (!jobData) {
                console.warn(`⚠️ Job ${jobId} found in queue but no data exists`);
                return null;
            }

            return JSON.parse(jobData) as VideoAssemblerJob;
        } catch (error) {
            console.error('❌ Error getting next job:', error);
            return null;
        }
    }

    /**
     * Update job status and progress
     */
    async updateJobProgress(
        jobId: string,
        status: JobStatus,
        progress: number,
        message: string,
        additionalData?: Partial<VideoAssemblerJob>
    ): Promise<void> {
        try {
            // Get current job data
            const jobData = await this.client.get(`${JOB_DATA_PREFIX}${jobId}`);

            if (!jobData) {
                console.warn(`⚠️ Cannot update job ${jobId} - not found`);
                return;
            }

            const job: VideoAssemblerJob = JSON.parse(jobData);

            // Update job
            const updatedJob: VideoAssemblerJob = {
                ...job,
                status,
                progress,
                message,
                updatedAt: Date.now(),
                ...additionalData,
            };

            // Save updated job data
            await this.client.set(
                `${JOB_DATA_PREFIX}${jobId}`,
                JSON.stringify(updatedJob)
            );

            // Also publish progress update for real-time subscriptions
            const progressUpdate: JobProgress = {
                status,
                progress,
                message,
                timestamp: Date.now(),
            };

            await this.client.publish(
                `${JOB_PROGRESS_PREFIX}${jobId}`,
                JSON.stringify(progressUpdate)
            );

            console.log(`📊 Job ${jobId}: ${status} (${progress}%) - ${message}`);
        } catch (error) {
            console.error(`❌ Error updating job ${jobId}:`, error);
        }
    }

    /**
     * Mark job as completed with results
     */
    async completeJob(
        jobId: string,
        results: Partial<VideoAssemblerJob>
    ): Promise<void> {
        await this.updateJobProgress(
            jobId,
            'completed',
            100,
            'Video generation completed successfully!',
            results
        );
    }

    /**
     * Mark job as failed with error
     */
    async failJob(jobId: string, error: string): Promise<void> {
        await this.updateJobProgress(
            jobId,
            'failed',
            0,
            `Job failed: ${error}`,
            { error }
        );
    }

    /**
     * Get job by ID
     */
    async getJob(jobId: string): Promise<VideoAssemblerJob | null> {
        try {
            const jobData = await this.client.get(`${JOB_DATA_PREFIX}${jobId}`);

            if (!jobData) {
                return null;
            }

            return JSON.parse(jobData) as VideoAssemblerJob;
        } catch (error) {
            console.error(`❌ Error getting job ${jobId}:`, error);
            return null;
        }
    }

    /**
     * Check queue length
     */
    async getQueueLength(): Promise<number> {
        return await this.client.llen(JOB_QUEUE_KEY);
    }

    /**
     * Close Redis connections
     */
    async close(): Promise<void> {
        await this.client.quit();
        await this.subscriber.quit();
        console.log('🔌 Redis connections closed');
    }
}

export default RedisService;
