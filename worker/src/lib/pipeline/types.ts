// Types for the video generation pipeline

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
