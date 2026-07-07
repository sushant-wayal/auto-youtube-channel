import { YouTubeService } from './services/youtube-service';
import { validateConfig } from '../../../shared/config';
import { generateTimestamps, canGenerateTimestamps } from './utils/timestamp-generator';

/**
 * Pure function: uploads a video to YouTube and returns the YouTube videoId
 * @param videoUrl string (Cloudinary video URL)
 * @param isShort boolean
 * @param title string
 * @param description string
 * @param tags string[]
 * @param thumbnailUrl string (optional)
 * @param privacyStatus string (optional)
 * @param sceneTitles string[] (optional) - scene titles for chapters
 * @param sceneDurations number[] (optional) - actual scene durations from assembly
 * @param hasIntro boolean (optional) - whether video has intro
 * @param introDuration number (optional) - intro duration in seconds
 * @param introTitle string (optional) - title for intro chapter
 * @param hasOutro boolean (optional) - whether video has outro
 * @param outroDuration number (optional) - outro duration in seconds
 * @param outroTitle string (optional) - title for outro chapter
 * @param seriesTitle string (optional) - series title for playlist generation
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
    sceneTitles,
    sceneDurations,
    hasIntro = false,
    introDuration = 8,
    introTitle = 'Intro',
    hasOutro = false,
    outroDuration = 8,
    outroTitle = 'Outro',
    seriesTitle,
}: {
    videoUrl: string;
    isShort?: boolean;
    title: string;
    description: string;
    tags?: string[];
    thumbnailUrl?: string;
    privacyStatus?: 'public' | 'unlisted' | 'private';
    scheduledPublishTime?: string; // ISO 8601 timestamp for scheduled publishing
    sceneTitles?: string[];  // Scene titles from script
    sceneDurations?: number[];  // Actual scene durations from video assembly
    hasIntro?: boolean;  // Whether video has intro
    introDuration?: number;  // Intro duration (default: 8)
    introTitle?: string;  // Title for intro chapter
    hasOutro?: boolean;  // Whether video has outro
    outroDuration?: number;  // Outro duration (default: 8)
    outroTitle?: string;  // Title for outro chapter
    seriesTitle?: string;  // Series title for playlist generation
}): Promise<{ videoId: string }> {
    validateConfig(['youtube']);

    let finalDescription = description;

    // Generate timestamps for long-form videos only (not shorts)
    if (!isShort && sceneTitles && sceneDurations && sceneTitles.length > 0 && sceneDurations.length > 0) {
        if (canGenerateTimestamps(sceneTitles, sceneDurations, hasIntro, hasOutro)) {
            try {
                const timestamps = generateTimestamps(sceneTitles, sceneDurations, {
                    introTitle: hasIntro ? introTitle : undefined,
                    introDuration: hasIntro ? introDuration : undefined,
                    outroTitle: hasOutro ? outroTitle : undefined,
                    outroDuration: hasOutro ? outroDuration : undefined,
                });
                if (timestamps) {
                    finalDescription = `${description}\n\n📚 Chapters:\n${timestamps}`;
                    const chapterCount = sceneTitles.length + (hasIntro ? 1 : 0) + (hasOutro ? 1 : 0);
                    console.error(`📊 Generated ${chapterCount} chapter timestamps`);
                }
            } catch (error) {
                console.error('⚠️ Failed to generate timestamps:', error);
                // Continue without timestamps
            }
        } else {
            console.error('⚠️ Cannot generate timestamps: insufficient scenes or durations');
        }
    }

    const youtubeService = new YouTubeService();
    // Use a random string for jobId
    const jobId = `job-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const uploadedVideoId = await youtubeService.upload({
        jobId,
        videoUrl,
        isShort,
        title,
        description: finalDescription,  // Use description with timestamps
        tags,
        thumbnailUrl,
        privacyStatus,
        scheduledPublishTime,
        seriesTitle,
    });
    return { videoId: uploadedVideoId };
}
