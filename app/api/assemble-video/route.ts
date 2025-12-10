import { NextRequest, NextResponse } from "next/server";
import VideoAssemblyService from "@/lib/video/video-assembly";
import path from "path";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { videoId, clips, clipTimings, narration, narrationAudio, music, branding } = body;

        if (!videoId || !clips || !Array.isArray(clips) || clips.length === 0) {
            return NextResponse.json(
                { error: "Missing required fields: videoId and clips array" },
                { status: 400 }
            );
        }

        console.log("🎬 Video assembly API called");
        console.log(`Video ID: ${videoId}`);
        console.log(`Clips: ${clips.length}`);
        console.log(`Clip Timings: ${clipTimings ? `${clipTimings.length} timings provided` : '✗ (will calculate from narration)'}`);
        console.log(`Narration: ${narration ? '✓' : '✗'}`);
        console.log(`Narration Audio: ${narrationAudio ? '✓' : '✗'}`);

        // Convert narrationAudio relative path to absolute path if provided
        let narrationAudioPath: string | undefined;
        if (narrationAudio) {
            narrationAudioPath = path.join(process.cwd(), 'videos', narrationAudio);
            console.log(`Using pre-generated voice-over: ${narrationAudioPath}`);
        }

        // Initialize assembly service
        const assemblyService = new VideoAssemblyService();

        // Assemble the video with pre-generated narration audio and clip timings
        const result = await assemblyService.assembleVideo({
            videoId,
            clips,
            clipTimings,  // Pass pre-calculated timings for better narration-video sync
            narration,
            narrationAudio: narrationAudioPath,
            music,
            branding,
        });

        return NextResponse.json({
            success: true,
            result,
        });
    } catch (error) {
        console.error("Error in assemble-video API:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to assemble video",
            },
            { status: 500 }
        );
    }
}

export const maxDuration = 300; // 5 minutes timeout for long video assembly
