import { NextRequest, NextResponse } from "next/server";
import VideoAssemblyService from "@/lib/video/video-assembly";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { videoId, clips, narration, music, branding } = body;

        if (!videoId || !clips || !Array.isArray(clips) || clips.length === 0) {
            return NextResponse.json(
                { error: "Missing required fields: videoId and clips array" },
                { status: 400 }
            );
        }

        console.log("🎬 Video assembly API called");
        console.log(`Video ID: ${videoId}`);
        console.log(`Clips: ${clips.length}`);
        console.log(`Narration: ${narration ? '✓' : '✗'}`);

        // Initialize assembly service
        const assemblyService = new VideoAssemblyService();

        // Assemble the video
        const result = await assemblyService.assembleVideo({
            videoId,
            clips,
            narration,
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
