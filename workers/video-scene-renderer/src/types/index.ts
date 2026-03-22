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
    sceneTheme?: "light" | "dark" | "auto";
    baseDuration: number;
    holdDuration: number;
    actions: ActionIR[];
}

export type ActionIR =
    | { t: number; op: "line"; x1: number; y1: number; x2: number; y2: number; stroke?: string; strokeWidth?: number; dashed?: boolean; arrow?: boolean; curve?: number; dashLength?: number; dashGap?: number }
    | { t: number; op: "rect"; x: number; y: number; w: number; h: number; r?: number; stroke?: string | false; strokeWidth?: number; fill?: string | false }
    | { t: number; op: "ellipse"; cx: number; cy: number; rx: number; ry: number; stroke?: string | false; strokeWidth?: number; fill?: string | false }
    | { t: number; op: "path"; d: string; stroke?: string; strokeWidth?: number; fill?: string; dashed?: boolean; dashLength?: number; dashGap?: number }
    | { t: number; op: "text"; x: number; y: number; value: string; fontSize?: number; size?: "title" | "subtitle" | "body" | "label"; fontWeight?: number; fill?: string; align?: "left" | "center" | "right"; baseline?: "top" | "middle" | "bottom"; typewriter?: boolean; monospace?: boolean }
    | { t: number; op: "codeBlock"; x: number; y: number; w: number; h: number; lines: string[]; language: string; theme?: "light" | "dark"; fontSize?: number; showLineNumbers?: boolean; highlightLine?: number; maxVisibleLines?: number; cursor?: boolean }
    | { t: number; op: "progressBar"; x: number; y: number; w: number; h: number; value: number; max?: number; label?: string; r?: number; fill?: string | false; trackFill?: string; stroke?: string | false; strokeWidth?: number }
    | { t: number; op: "badge"; x: number; y: number; value: string; style?: "neutral" | "accent" | "warning" | "success" | "danger"; fontSize?: number; fontWeight?: number; paddingX?: number; paddingY?: number; fill?: string; stroke?: string; textColor?: string; icon?: string }
    | { t: number; op: "icon"; x: number; y: number; name: string; size?: number; stroke?: string; strokeWidth?: number; fill?: string | false }
    | { t: number; op: "table"; x: number; y: number; w: number; h: number; headers: string[]; rows: string[][]; striped?: boolean; headerFill?: string; gridStroke?: string; textColor?: string; fontSize?: number; align?: "left" | "center" | "right" }
    | { t: number; op: "numberCounter"; x: number; y: number; from: number; to: number; prefix?: string; suffix?: string; decimals?: number; fontSize?: number; size?: "title" | "subtitle" | "body" | "label"; fontWeight?: number; fill?: string; align?: "left" | "center" | "right" }
    | { t: number; op: "highlight"; x: number; y: number; w: number; h: number; style?: "underline" | "box"; r?: number; fill?: string; opacity?: number }
    | { t: number; op: "group"; children: ActionIR[] }
    | { t: number; op: "transform"; translate?: [number, number]; children: ActionIR[] };


