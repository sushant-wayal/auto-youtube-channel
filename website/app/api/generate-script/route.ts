import { NextRequest, NextResponse } from "next/server";
import VideoGenerationPipeline from "@/lib/pipeline";
import { promises as fs } from "fs";
import path from "path";
import { MOCK_SCRIPT } from "@/app/constants";

export async function POST(request: NextRequest) {
    try {
        const { videoIdea, sceneRenderMethod, seriesContext } = await request.json();

        if (!videoIdea || typeof videoIdea !== "string") {
            return NextResponse.json(
                { error: "Video idea is required" },
                { status: 400 }
            );
        }

        if (
            sceneRenderMethod !== undefined &&
            sceneRenderMethod !== "code" &&
            sceneRenderMethod !== "ai"
        ) {
            return NextResponse.json(
                { error: "sceneRenderMethod must be either 'code' or 'ai'" },
                { status: 400 }
            );
        }

        console.log(
            "📝 Script generation requested for:",
            videoIdea,
            `(render method: ${sceneRenderMethod || "environment fallback"})`
        );

        // Check if we should use mock data (set USE_MOCK_SCRIPT=true in .env.local to enable)
        const useMock = process.env.USE_MOCK_SCRIPT === "true";

        if (useMock) {
            console.log("🎭 Using MOCK script (Gemini API bypassed)");
            console.log("   To use real AI: remove USE_MOCK_SCRIPT from .env.local");

            // Add a small delay to simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));

            return NextResponse.json({ script: MOCK_SCRIPT });
        }

        // Real AI generation
        console.log("🤖 Using Gemini AI for script generation");
        const pipeline = new VideoGenerationPipeline();
        const script = await pipeline.generateScriptOnly(videoIdea, sceneRenderMethod, seriesContext);

        return NextResponse.json({ script });
    } catch (error) {
        console.error("Script generation error:", error);
        
        return NextResponse.json(
            { error: "AI script generation failed" },
            { status: 500 }
        );
    }
}
