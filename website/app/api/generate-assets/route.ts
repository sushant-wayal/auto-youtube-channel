import { NextRequest, NextResponse } from "next/server";
import VideoGenerationPipeline from "@/lib/pipeline";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoId, title, narration } = body;

    if (!videoId || !title || !narration) {
      return NextResponse.json(
        { error: "Missing required fields: videoId, title, narration" },
        { status: 400 }
      );
    }

    console.log("🎬 Assets generation API called");
    console.log(`Video ID: ${videoId}`);

    // Initialize pipeline
    const pipeline = new VideoGenerationPipeline();

    // Generate assets
    const assets = await pipeline.generateAssets(videoId, title, narration);

    return NextResponse.json({
      success: true,
      assets,
    });
  } catch (error) {
    console.error("Error in generate-assets API:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate assets",
      },
      { status: 500 }
    );
  }
}
