import { YouTubeService } from './services/youtube-service';
import { validateConfig } from '../../../shared/config';

/**
 * Pure function: uploads a video to YouTube and returns the YouTube videoId
 * @param videoUrl string (Cloudinary video URL)
 * @param isShort boolean
 * @param title string
 * @param description string
 * @param tags string[]
 * @param thumbnailUrl string (optional)
 * @param privacyStatus string (optional)
 * @returns { videoId: string }
 */
export async function uploadToYouTube({
    videoUrl,
    isShort = false,
    title,
    description,
    tags = [],
    thumbnailUrl,
    privacyStatus = 'public',
    scheduledPublishTime,
}: {
    videoUrl: string;
    isShort?: boolean;
    title: string;
    description: string;
    tags?: string[];
    thumbnailUrl?: string;
    privacyStatus?: 'public' | 'unlisted' | 'private';
    scheduledPublishTime?: string; // ISO 8601 timestamp for scheduled publishing
}): Promise<{ videoId: string }> {
    validateConfig(['youtube']);

    const youtubeService = new YouTubeService();
    // Use a random string for jobId
    const jobId = `job-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const uploadedVideoId = await youtubeService.upload({
        jobId,
        videoUrl,
        isShort,
        title,
        description,
        tags,
        thumbnailUrl,
        privacyStatus,
        scheduledPublishTime,
    });
    return { videoId: uploadedVideoId };
}
