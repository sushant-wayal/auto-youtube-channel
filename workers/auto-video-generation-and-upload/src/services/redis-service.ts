/**
 * Redis Service
 * Handles job queue management and progress updates
 */

import Redis from 'ioredis';
import config from '../config';
import { AutoVideoGenerationAndUploadJob, JobStatus, JobProgress } from '../types';
import { v4 as uuidv4 } from "uuid";

const JOB_QUEUE_KEY = 'autoVideoGenerationAndUpload:jobs:queue';
const JOB_DATA_PREFIX = 'autoVideoGenerationAndUpload:job:';
const JOB_PROGRESS_PREFIX = 'autoVideoGenerationAndUpload:progress:';

const DAILY_LOCK_PREFIX = 'lock:daily:autoVideoGeneration';
const DAILY_LOCK_TTL_SECONDS = 26 * 60 * 60; // 26 hours

class RedisService {
    client: Redis;
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
     * Acquire daily generation lock
     * Returns true if lock acquired, false if already locked
     */
    async acquireDailyGenerationLock(date: Date = new Date()): Promise<boolean> {
        const yyyy = date.getUTCFullYear();
        const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(date.getUTCDate()).padStart(2, '0');

        const lockKey = `${DAILY_LOCK_PREFIX}:${yyyy}-${mm}-${dd}`;

        const result = await this.client.set(
            lockKey,
            'locked',
            'EX',
            DAILY_LOCK_TTL_SECONDS,
            'NX'
        );

        if (result === 'OK') {
            console.log(`🔒 Daily generation lock acquired: ${lockKey}`);
            return true;
        }

        console.log(`⛔ Daily generation already locked: ${lockKey}`);
        return false;
    }


    /**
     * Get the next pending job from the queue
     */
    async getNextJob(): Promise<AutoVideoGenerationAndUploadJob | null> {
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

            return JSON.parse(jobData) as AutoVideoGenerationAndUploadJob;
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
        additionalData?: Partial<AutoVideoGenerationAndUploadJob>
    ): Promise<void> {
        try {
            // Get current job data
            const jobData = await this.client.get(`${JOB_DATA_PREFIX}${jobId}`);

            if (!jobData) {
                console.warn(`⚠️ Cannot update job ${jobId} - not found`);
                return;
            }

            const job: AutoVideoGenerationAndUploadJob = JSON.parse(jobData);

            // Update job
            const updatedJob: AutoVideoGenerationAndUploadJob = {
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
        results: Partial<AutoVideoGenerationAndUploadJob>
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
    async getJob(jobId: string): Promise<AutoVideoGenerationAndUploadJob | null> {
        try {
            const jobData = await this.client.get(`${JOB_DATA_PREFIX}${jobId}`);

            if (!jobData) {
                return null;
            }

            return JSON.parse(jobData) as AutoVideoGenerationAndUploadJob;
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

    /**
     * Create Job
     */
    async createJob(jobType: string, videoId: string, payload: any): Promise<string> {
        const jobId = uuidv4();
        const createdAt = Date.now();

        const jobData = {
        jobId,
        videoId,
        createdAt,
        updatedAt: createdAt,
        status: "pending",
        progress: 0,
        message: "",
        ...payload,
        };

        let queueKey = "";
        let jobKey = "";

        switch (jobType) {
            case "voiceover":
                queueKey = "voiceOver:jobs:queue";
                jobKey = `voiceOver:job:${jobId}`;
                break;
            case "assets":
                queueKey = "videoScene:jobs:queue";
                jobKey = `videoScene:job:${jobId}`;
                break;
            case "assembly":
                queueKey = "videoAssembler:jobs:queue";
                jobKey = `videoAssembler:job:${jobId}`;
                break;
            case "youtube-upload":
                queueKey = "youtubeUploader:jobs:queue";
                jobKey = `youtubeUploader:job:${jobId}`;
                break;
        }

        await this.client.set(jobKey, JSON.stringify(jobData));
        await this.client.rpush(queueKey, jobId);

        return jobId;
    }

    /**
     * Get Job progress
     */
    async getJobStatus(jobId: string): Promise<JobProgress | null> {
        const prefixes = [
            "voiceOver:job:",
            "clipCollector:job:",
            "videoAssembler:job:",
            "youtubeUploader:job:",
            "videoScene:job:"
        ];

        let jobData: string | null = null;

        for (const prefix of prefixes) {
            jobData = await this.client.get(`${prefix}${jobId}`);
            if (jobData) break;
        }

        return jobData ? JSON.parse(jobData) as JobProgress : null;
    }

    /**
     * Get job progress by polling
     */
    async pollJobProgress(jobId: string, interval: number = 2000): Promise<JobProgress> {
        return new Promise((resolve, reject) => {
            const poll = setInterval(async () => {
                try {
                    const jobStatus = await this.getJobStatus(jobId);
                    if (jobStatus) {
                        if (jobStatus.status === 'completed' || jobStatus.status === 'failed') {
                            console.log(`✅ Job ${jobId} ${jobStatus.status}`);
                            clearInterval(poll);
                            resolve({
                                ...jobStatus,
                            });
                        } else if (jobStatus.status != 'pending') {
                            console.log(`⏳ Job ${jobId} is ${jobStatus.status}: ${jobStatus.message} (${jobStatus.progress}%)`);
                        }
                    } else {
                        clearInterval(poll);
                        reject(new Error('Job not found'));
                    }
                } catch (error) {
                    clearInterval(poll);
                    reject(error);
                }
            }, interval);
        });
    }
}

export default RedisService;
