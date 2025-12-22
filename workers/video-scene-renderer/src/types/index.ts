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
export interface VideoSceneRendererJob {
    videoId: string;
    jobId: string;
    videoIdea: string;
    scenes: SceneIR[];
    createdAt: number;
    updatedAt: number;
    status: JobStatus;
    progress: number;
    message: string;
    isShort: boolean;

    // Results (populated as job progresses)
    clipsUrls: string[]; // URLs of collected video clips
    clipTimings: number[]; // Timings for each clip
    animationStopTimes: number[]; // Animation stop times for each scene

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

export interface SceneIR {
    id: string;
    baseDuration: number;
    holdDuration: number;
    actions: ActionIR[];
}

export type ActionIR =
  | { t: number; op: "line"; x1:number;y1:number;x2:number;y2:number; stroke?:string; strokeWidth?:number }
  | { t: number; op: "rect"; x:number;y:number;w:number;h:number;r?:number; stroke?:string; strokeWidth?:string; fill?:string }
  | { t: number; op: "ellipse"; cx:number;cy:number;rx:number;ry:number; fill?:string }
  | { t: number; op: "path"; d:string; stroke?:string; strokeWidth?:number; fill?:string }
  | { t: number; op: "text"; x:number;y:number; value:string; fontSize?: number; align?: "left" | "center" | "right"; fill?:string }
  | { t: number; op: "group"; children: ActionIR[] }
  | { t: number; op: "transform"; translate?:[number,number]; children: ActionIR[] };

