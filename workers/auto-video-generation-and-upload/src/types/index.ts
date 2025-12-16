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
export interface AutoVideoGenerationAndUploadJob {
    jobId: string;
    videoIdea: string;
    createdAt: number;
    updatedAt: number;
    status: JobStatus;
    progress: number;
    message: string;
    isShort: boolean;

    uploadedVideoUrls?: string[];

    // Error info
    error?: string;
}

export interface VideoScript {
    title: string;
    description: string;
    tags: string[];
    narration: string;
    shorts: Short[];
}

export interface Short {
    hook: string;
    script: string;
}

type ThumbnailProvider = "gemini" | "huggingface";

export interface ThumbnailResult {
    thumbnailPath: string;
    prompt: string;
    videoId: string;
    provider: ThumbnailProvider;
    model?: string;
}

export interface AssetsCollectionResult {
    clipsUrls: string[];
    clipTimings: number[];
}

export interface VideoGenerationResult {
    thumbnailUrl: string;
    videoUrl: string;
}

export interface YoutubeUploadVideoData {
    videoUrl: string;
    title: string;
    description: string;
    tags: string[];
    thumbnailUrl: string;
    privacyStatus: "public" | "unlisted" | "private";
}
