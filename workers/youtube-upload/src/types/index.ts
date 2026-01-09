/**
 * Type definitions for the video generation worker
 */

// Job Status
export type JobStatus =
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed';

// Job Progress Update
export interface JobProgress {
    status: JobStatus;
    progress: number; // 0-100
    message: string;
    stage?: string;
    timestamp: number;
}

// Job Data stored in Redis
export interface YoutubeUploadJob {
    jobId: string;
    videoId: string;
    videoIdea: string;
    narration: string;
    videoUrl?: string;
    isShort?: boolean;
    title?: string;
    description?: string;
    tags?: string[];
    thumbnailUrl?: string;
    privacyStatus?: "public" | "unlisted" | "private";
    scheduledPublishTime?: string; // ISO 8601 timestamp for scheduled publishing
    createdAt: number;
    updatedAt: number;
    status: JobStatus;
    progress: number;
    message: string;

    // Results (populated as job progresses)
    uploadedVideoId?: string;

    // Error info
    error?: string;
}
