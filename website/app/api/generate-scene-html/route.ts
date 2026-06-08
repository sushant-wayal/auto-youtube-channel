import { NextRequest, NextResponse } from "next/server";
import SceneHtmlGenerationService from "@/lib/scene-html/scene-html-generation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const narration = typeof body.narration === "string" ? body.narration : "";

    if (!narration.trim() && body.allowEmptyNarration !== true) {
      return NextResponse.json(
        { error: "Narration is required" },
        { status: 400 }
      );
    }

    const service = new SceneHtmlGenerationService();
    const html = await service.generateSceneHtml({
      narration,
      isShort: body.isShort === true,
      sceneId: typeof body.sceneId === "string" ? body.sceneId : undefined,
      duration: typeof body.duration === "number" ? body.duration : undefined,
    });

    return NextResponse.json({ html });
  } catch (error) {
    console.error("Scene HTML generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate scene HTML" },
      { status: 500 }
    );
  }
}
