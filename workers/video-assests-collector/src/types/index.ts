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
export interface ClipsCollectorJob {
    jobId: string;
    videoId: string;
    videoIdea: string;
    narration: string;
    createdAt: number;
    updatedAt: number;
    status: JobStatus;
    progress: number;
    message: string;

    // Results (populated as job progresses)
    clipsUrls: string[]; // URLs of collected video clips
    clipTimings: number[]; // Timings for each clip

    // Error info
    error?: string;
}
