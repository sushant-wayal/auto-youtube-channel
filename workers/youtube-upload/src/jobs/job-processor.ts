import { YouTubeService } from '../services/youtube-service';

// Import worker services
import RedisService from '../services/redis-service';

import { YoutubeUploadJob } from '../types';

class JobProcessor {
    private redisService: RedisService;

    constructor() {
        this.redisService = RedisService.getInstance();
    }

    async processJob(job: YoutubeUploadJob): Promise<void> {
        const { jobId, videoIdea, videoUrl, title, description, tags, thumbnailUrl, privacyStatus } = job;
        console.log(`\n🎬 === PROCESSING JOB: ${jobId} ===`);
        console.log(`📝 Video Idea: ${videoIdea}`);

        const youtubeService = new YouTubeService();

        const videoId = `video-${Date.now()}`;

        try {

            console.log(`🎬 Starting assets collection...`);

            await this.redisService.updateJobProgress(
                jobId, 'processing', 10, 'Downloading video and thumbnail...'
            );

            const uploadedVideoId = await youtubeService.upload({
                jobId,
                videoUrl: videoUrl!,
                title: title || `Auto Video ${Date.now()}`,
                description: description || 'Automatically uploaded video',
                tags: tags || [],
                thumbnailUrl: thumbnailUrl,
                privacyStatus: privacyStatus || 'public'
            });

            await this.redisService.updateJobProgress(
                jobId, 'processing', 90, 'Finalizing upload...'
            );
            console.log(`✅ Video uploaded with ID: ${videoId}`);

            await this.redisService.completeJob(jobId, {
                videoId,
                uploadedVideoId
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
