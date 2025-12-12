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
export interface AudioGenerationJob {
    jobId: string;
    videoIdea: string;
    narration: string;
    createdAt: number;
    updatedAt: number;
    status: JobStatus;
    progress: number;
    message: string;

    voiceOverUrl?: string;

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
