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

export interface SceneIR {
    id: string;
    baseDuration: number;
    holdDuration: number;
    narration: string;
    actions: ActionIR[];
}

export type ActionIR =
    | { t: number; op: "line"; x1: number; y1: number; x2: number; y2: number; stroke?: string; strokeWidth?: number; dashed?: boolean; arrow?: boolean; curve?: number; dashLength?: number; dashGap?: number }
    | { t: number; op: "rect"; x: number; y: number; w: number; h: number; r?: number; stroke?: string | false; strokeWidth?: number; fill?: string | false }
    | { t: number; op: "ellipse"; cx: number; cy: number; rx: number; ry: number; stroke?: string | false; strokeWidth?: number; fill?: string | false }
    | { t: number; op: "path"; d: string; stroke?: string; strokeWidth?: number; fill?: string; dashed?: boolean; dashLength?: number; dashGap?: number }
    | { t: number; op: "text"; x: number; y: number; value: string; fontSize?: number; size?: "title" | "subtitle" | "body" | "label"; fontWeight?: number; fill?: string; align?: "left" | "center" | "right"; baseline?: "top" | "middle" | "bottom"; typewriter?: boolean }
    | { t: number; op: "group"; children: ActionIR[] }
    | { t: number; op: "transform"; translate?: [number, number]; children: ActionIR[] };

export interface VideoScript {
    title: string;
    description: string;
    tags: string[];
    narration: string;
    scenes: SceneIR[];
    shorts: {
        id: string;
        hook: string;
        narration: string;
        baseDuration: number;
        holdDuration: number;
        actions: ActionIR[];
    }[]
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
