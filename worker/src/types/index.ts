/**
 * Type definitions for the video generation worker
 */

// Job Status
export type JobStatus =
    | 'pending'
    | 'processing'
    | 'script_generating'
    | 'voiceover_generating'
    | 'assets_generating'
    | 'video_assembling'
    | 'shorts_generating'
    | 'uploading'
    | 'completed'
    | 'failed';

// Short Step Status
export type ShortStepStatus = 'idle' | 'running' | 'completed' | 'error';

// Short Step Progress
export interface ShortStepProgress {
    status: ShortStepStatus;
    progress: number;
    message: string;
}

// Short Generation Progress (tracks each step within a short)
export interface ShortGenerationProgress {
    shortIndex: number;
    status: ShortStepStatus;
    voiceOverStep: ShortStepProgress;
    assetsStep: ShortStepProgress;
    assemblyStep: ShortStepProgress;
    uploadStep: ShortStepProgress;
}

// Short Video Result
export interface ShortVideoResult {
    shortIndex: number;
    shortVideoId: string;
    videoUrl: string;
    duration: number;
}

// Job Progress Update
export interface JobProgress {
    status: JobStatus;
    progress: number; // 0-100
    message: string;
    stage?: string;
    timestamp: number;
}

// Job Data stored in Redis
export interface VideoGenerationJob {
    jobId: string;
    videoIdea: string;
    createdAt: number;
    updatedAt: number;
    status: JobStatus;
    progress: number;
    message: string;

    // Results (populated as job progresses)
    script?: {
        title: string;
        description: string;
        tags: string[];
        narration: string;
        shorts: Array<{ hook: string; script: string }>;
    };
    voiceOverUrl?: string;
    mainVideoUrl?: string;
    thumbnailUrl?: string;
    shortsVideos?: ShortVideoResult[];

    // Detailed shorts progress (for real-time UI updates)
    shortsProgress?: ShortGenerationProgress[];

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
