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
export interface VideoAssemblerJob {
    videoId: string;
    jobId: string;
    videoIdea: string;
    narration: string;
    voiceOverUrl: string;
    clips: string[];
    clipTimings: number[];
    createdAt: number;
    updatedAt: number;
    status: JobStatus;
    progress: number;
    message: string;
    isShort: boolean;

    outputPath?: string;
    duration?: number;
    clipCount?: number;

    // Error info
    error?: string;
}

// Cloudinary Upload Result
export interface CloudinaryUploadResult {
    publicId: string;
    secureUrl: string;
    format: string;
    duration?: number;
    bytes: number;
}
