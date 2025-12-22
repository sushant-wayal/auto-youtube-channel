// Types for the video generation pipeline

export interface SceneIR {
    id: string;
    baseDuration: number;
    holdDuration: number;
    narration: string;
    actions: ActionIR[];
}

export type ActionIR =
  | { t: number; op: "line"; x1:number;y1:number;x2:number;y2:number; stroke?:string; strokeWidth?:number; fill?:string }
  | { t: number; op: "rect"; x:number;y:number;w:number;h:number;r?:number; stroke?:string; strokeWidth?:number; fill?:string }
  | { t: number; op: "ellipse"; cx:number;cy:number;rx:number;ry:number; stroke?:string; strokeWidth?:number; fill?:string }
  | { t: number; op: "path"; d:string; stroke?:string; strokeWidth?:number; fill?:string }
  | { t: number; op: "text"; x:number;y:number; value:string; fontSize?:number; fill?:string; align?: "left" | "center" | "right" }
  | { t: number; op: "group"; children: ActionIR[] }
  | { t: number; op: "transform"; translate?:[number,number]; children: ActionIR[] };

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

export interface GenerationProgress {
    stage: "script" | "assets" | "assembly" | "thumbnail" | "audio" | "visuals" | "editing" | "rendering" | "complete";
    message: string;
    progress: number; // 0-100
}

export interface VideoAssets {
    videoId: string;
    clips: string[];
    clipTimings?: number[];  // Pre-calculated durations for each clip (in seconds)
    music: string;
    branding: {
        logo?: string;
        intro?: string;
        outro?: string;
    };
}

export interface VideoAssemblyResult {
    videoId: string;
    outputPath: string;
    duration: number;
    clipCount: number;
}

export interface ThumbnailResult {
    thumbnailPath: string;
    prompt: string;
    videoId: string;
    provider: "gemini" | "huggingface";
    model?: string;
}

export interface VideoGenerationResult {
    script?: VideoScript;
    assets?: VideoAssets;
    video?: VideoAssemblyResult;
    thumbnail?: ThumbnailResult;
    audioUrl?: string;
    videoUrl?: string;
    error?: string;
}
