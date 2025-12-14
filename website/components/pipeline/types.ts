// Types for pipeline components

import { VideoScript, VideoAssets, VideoAssemblyResult, ThumbnailResult, Short } from "@/lib/pipeline/types";

export type StepStatus = "idle" | "running" | "completed" | "error";

export interface PipelineStep {
    id: string;
    name: string;
    status: StepStatus;
    progress: number;
    message?: string;
    startTime?: number;
    endTime?: number;
}

// Individual short video generation state
export interface ShortGenerationState {
    shortIndex: number;
    short: Short;
    status: StepStatus;
    voiceOverStep: PipelineStep;
    voiceOverPath: string | null;
    assetsStep: PipelineStep;
    assets: VideoAssets | null;
    assemblyStep: PipelineStep;
    assembledVideo: VideoAssemblyResult | null;
    thumbnailStep: PipelineStep;
    thumbnail: ThumbnailResult | null;
}

// Shorts pipeline state (all shorts generated in parallel)
export interface ShortsPipelineState {
    status: StepStatus;
    shorts: ShortGenerationState[];
    completedCount: number;
    totalCount: number;
}

export interface PipelineState {
    // Overall pipeline
    isRunning: boolean;
    currentPhase: "idle" | "script" | "video-thumbnail" | "shorts" | "complete";
    error: string | null;

    // Script Generation (Step 1)
    scriptStep: PipelineStep;
    script: VideoScript | null;

    // Video Generation (Step 2 - Parallel with Thumbnail)
    videoGeneration: {
        status: StepStatus;
        // Voice-over sub-step
        voiceOverStep: PipelineStep;
        voiceOverPath: string | null;
        // Assets sub-step
        assetsStep: PipelineStep;
        assets: VideoAssets | null;
        // Assembly sub-step (depends on voice-over + assets)
        assemblyStep: PipelineStep;
        assembledVideo: VideoAssemblyResult | null;
    };

    // Thumbnail Generation (Step 3 - Parallel with Video)
    thumbnailStep: PipelineStep;
    thumbnail: ThumbnailResult | null;

    // Shorts Generation (Step 4 - After long-form video completes)
    shortsGeneration: ShortsPipelineState;
}

export const createShortGenerationState = (shortIndex: number, short: Short): ShortGenerationState => ({
    shortIndex,
    short,
    status: "idle",
    voiceOverStep: {
        id: `short-${shortIndex}-voiceover`,
        name: "Voice-Over",
        status: "idle",
        progress: 0,
    },
    voiceOverPath: null,
    assetsStep: {
        id: `short-${shortIndex}-assets`,
        name: "Assets",
        status: "idle",
        progress: 0,
    },
    assets: null,
    assemblyStep: {
        id: `short-${shortIndex}-assembly`,
        name: "Assembly",
        status: "idle",
        progress: 0,
    },
    assembledVideo: null,
    thumbnailStep: {
        id: `short-${shortIndex}-thumbnail`,
        name: "Thumbnail",
        status: "idle",
        progress: 0,
    },
    thumbnail: null,
});

export const initialPipelineState: PipelineState = {
    isRunning: false,
    currentPhase: "idle",
    error: null,

    scriptStep: {
        id: "script",
        name: "Script Generation",
        status: "idle",
        progress: 0,
    },
    script: null,

    videoGeneration: {
        status: "idle",
        voiceOverStep: {
            id: "voiceover",
            name: "Voice-Over",
            status: "idle",
            progress: 0,
        },
        voiceOverPath: null,
        assetsStep: {
            id: "assets",
            name: "Video Assets",
            status: "idle",
            progress: 0,
        },
        assets: null,
        assemblyStep: {
            id: "assembly",
            name: "Video Assembly",
            status: "idle",
            progress: 0,
        },
        assembledVideo: null,
    },

    thumbnailStep: {
        id: "thumbnail",
        name: "Thumbnail",
        status: "idle",
        progress: 0,
    },
    thumbnail: null,

    shortsGeneration: {
        status: "idle",
        shorts: [],
        completedCount: 0,
        totalCount: 0,
    },
};
