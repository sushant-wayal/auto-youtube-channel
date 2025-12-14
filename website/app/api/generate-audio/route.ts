import { NextRequest, NextResponse } from "next/server";
import VideoGenerationPipeline from "@/lib/pipeline";
import { VideoScript } from "@/lib/pipeline/types";

export async function POST(request: NextRequest) {
    console.log("🎬 Audio generation API called");

    try {
        const body = await request.json();
        console.log("📦 Request body received");

        const { script } = body;

        if (!script || !script.narration) {
            console.error("❌ Invalid request: missing script or narration");
            return NextResponse.json(
                { error: "Script with narration is required" },
                { status: 400 }
            );
        }

        console.log("📝 Script received:");
        console.log("  - Title:", script.title);
        console.log("  - Narration length:", script.narration.length, "characters");

        console.log("🚀 Starting pipeline audio generation...");
        const pipeline = new VideoGenerationPipeline();
        const audioUrl = await pipeline.generateAudio(script as VideoScript);

        console.log("✅ Audio generation completed!");
        console.log("🔗 Audio URL:", audioUrl);

        return NextResponse.json({ audioUrl });
    } catch (error) {
        console.error("❌ Audio generation error:", error);
        console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");

        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to generate audio" },
            { status: 500 }
        );
    }
}

export const maxDuration = 300; // 5 minutes timeout for long audio generation
