/**
 * Video Generation Worker
 * Main entry point - polls Redis for jobs and processes them
 */

import config, { validateConfig } from './config';
import RedisService from './services/redis-service';
import JobProcessor from './jobs/job-processor';

class Worker {
    private redisService: RedisService;
    private jobProcessor: JobProcessor;
    private isRunning: boolean = false;
    private pollInterval: number;

    constructor() {
        // Validate configuration first
        validateConfig();

        this.redisService = RedisService.getInstance();
        this.jobProcessor = new JobProcessor();
        this.pollInterval = config.worker.pollInterval;
    }

    /**
     * Start the worker
     */
    async start(): Promise<void> {
        console.log('\n🚀 === AUTO-VIDEO-GENERATION-AND-UPLOAD WORKER STARTED ===');
        console.log(`📡 Redis URL: ${config.redis.url.replace(/:[^:@]+@/, ':****@')}`);
        console.log(`⏱️  Poll interval: ${this.pollInterval}ms`);
        console.log('👂 Listening for jobs...\n');

        this.isRunning = true;

        // Setup graceful shutdown
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());

        // Start polling
        await this.poll();
    }

    /**
     * Poll Redis for new jobs
     */
    private async poll(): Promise<void> {
        while (this.isRunning) {
            try {
                // Check queue length
                const queueLength = await this.redisService.getQueueLength();

                if (queueLength > 0) {
                    console.log(`📬 ${queueLength} job(s) in queue`);
                }

                // Get next job
                const job = await this.redisService.getNextJob();

                if (job) {
                    console.log(`\n📥 Picked up job: ${job.jobId}`);

                    await this.jobProcessor.isDuplicateJob().then(async (isDuplicate) => {
                        if (isDuplicate) {
                            console.log(`⛔ Job ${job.jobId} is a duplicate for today. Marking as failed.`);
                            await this.redisService.failJob(job.jobId, 'Duplicate job for today');
                            return;
                        }
                    });

                    // Process the job
                    await this.jobProcessor.processJob(job);

                    console.log(`\n👂 Continuing to listen for jobs...`);
                }

                // Wait before next poll
                await this.sleep(this.pollInterval);

            } catch (error) {
                console.error('❌ Error in poll loop:', error);
                await this.sleep(this.pollInterval);
            }
        }
    }

    /**
     * Graceful shutdown
     */
    private async shutdown(): Promise<void> {
        console.log('\n🛑 Shutting down worker...');
        this.isRunning = false;

        try {
            await this.redisService.close();
            console.log('✅ Worker shut down gracefully');
            process.exit(0);
        } catch (error) {
            console.error('❌ Error during shutdown:', error);
            process.exit(1);
        }
    }

    /**
     * Sleep helper
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Create and start worker
const worker = new Worker();
worker.start().catch(error => {
    console.error('❌ Failed to start worker:', error);
    process.exit(1);
});
