import { NextRequest, NextResponse } from "next/server";
import VideoAssemblyService from "@/lib/video/video-assembly";
import path from "path";

export interface ShortAssemblyRequest {
    shortVideoId: string;
    shortIndex: number;
    voiceOverPath: string;
    fullNarration: string;
    assets: {
        videoId: string;
        clips: string[];
        clipTimings?: number[];
        music: string;
        branding: {
            logo?: string;
            intro?: string;
            outro?: string;
        };
    };
}

export interface ShortAssemblyResult {
    videoId: string;
    outputPath: string;
    duration: number;
    clipCount: number;
}

export async function POST(request: NextRequest) {
    try {
        const body: ShortAssemblyRequest = await request.json();
        const { shortVideoId, shortIndex, voiceOverPath, fullNarration, assets } = body;

        if (!shortVideoId || shortIndex === undefined || !voiceOverPath || !assets) {
            return NextResponse.json(
                { error: "Missing required fields: shortVideoId, shortIndex, voiceOverPath, assets" },
                { status: 400 }
            );
        }

        console.log(`\n🎥 Assembling short #${shortIndex + 1}...`);

        // Convert relative path back to absolute
        const absoluteVoiceOverPath = path.join(process.cwd(), 'videos', voiceOverPath);

        // Assemble the short video
        const assemblyService = new VideoAssemblyService();
        const assembledVideo = await assemblyService.assembleVideo({
            videoId: shortVideoId,
            clips: assets.clips,
            clipTimings: assets.clipTimings,
            narration: fullNarration,
            narrationAudio: absoluteVoiceOverPath,
            music: assets.music,
            branding: assets.branding,
            isShort: true, // Flag to indicate vertical format
        });

        console.log(`✅ Short #${shortIndex + 1} assembled: ${assembledVideo.duration.toFixed(1)}s`);

        const result: ShortAssemblyResult = {
            videoId: shortVideoId,
            outputPath: assembledVideo.outputPath,
            duration: assembledVideo.duration,
            clipCount: assembledVideo.clipCount,
        };

        return NextResponse.json({
            success: true,
            result,
        });
    } catch (error) {
        console.error("❌ Error assembling short video:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to assemble short video" },
            { status: 500 }
        );
    }
}

export const maxDuration = 180;
