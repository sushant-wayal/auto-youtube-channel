// Types for the video generation pipeline

export interface SceneIR {
    id: string;
    sceneTitle?: string;  // Short title for YouTube chapters
    sceneTheme?: "light" | "dark" | "auto";
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
    | { t: number; op: "text"; x: number; y: number; value: string; fontSize?: number; size?: "title" | "subtitle" | "body" | "label"; fontWeight?: number; fill?: string; align?: "left" | "center" | "right"; baseline?: "top" | "middle" | "bottom"; typewriter?: boolean; monospace?: boolean }
    | { t: number; op: "codeBlock"; x: number; y: number; w: number; h: number; lines: string[]; language?: string; theme?: "light" | "dark"; fontSize?: number; showLineNumbers?: boolean; highlightLine?: number; maxVisibleLines?: number; cursor?: boolean }
    | { t: number; op: "progressBar"; x: number; y: number; w: number; h: number; value: number; max?: number; label?: string; r?: number; fill?: string | false; trackFill?: string; stroke?: string | false; strokeWidth?: number }
    | { t: number; op: "badge"; x: number; y: number; value: string; style?: "neutral" | "accent" | "warning" | "success" | "danger"; fontSize?: number; fontWeight?: number; paddingX?: number; paddingY?: number; fill?: string; stroke?: string; textColor?: string; icon?: string }
    | { t: number; op: "icon"; x: number; y: number; name: string; size?: number; stroke?: string; strokeWidth?: number; fill?: string | false }
    | { t: number; op: "table"; x: number; y: number; w: number; h: number; headers: string[]; rows: string[][]; striped?: boolean; headerFill?: string; gridStroke?: string; textColor?: string; fontSize?: number; align?: "left" | "center" | "right" }
    | { t: number; op: "numberCounter"; x: number; y: number; from: number; to: number; prefix?: string; suffix?: string; decimals?: number; fontSize?: number; size?: "title" | "subtitle" | "body" | "label"; fontWeight?: number; fill?: string; align?: "left" | "center" | "right" }
    | { t: number; op: "highlight"; x: number; y: number; w: number; h: number; style?: "underline" | "box"; r?: number; fill?: string; opacity?: number }
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
        scenes: SceneIR[];
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
    sceneDurations?: number[];  // Actual duration of each scene after assembly
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
