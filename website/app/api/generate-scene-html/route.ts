import { NextRequest, NextResponse } from "next/server";
import SceneHtmlGenerationService from "@/lib/scene-html/scene-html-generation";

// Scene ticket waiting is handled by the long-running renderer worker.
// Each Gemini network attempt is still limited by the shared Redis project slot.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const narration = typeof body.narration === "string" ? body.narration : "";

    if (!narration.trim() && body.allowEmptyNarration !== true) {
      return NextResponse.json({ error: "Narration is required" }, { status: 400 });
    }

    const sceneId = typeof body.sceneId === "string" ? body.sceneId : undefined;
    console.log(`[SceneHTML] Generating scene ${sceneId || "unknown"} through the project rate limiter.`);

    const service = new SceneHtmlGenerationService();
    const generatedScene = await service.generateScene({
      narration,
      isShort: body.isShort === true,
      sceneId,
      sceneTitle: typeof body.sceneTitle === "string" ? body.sceneTitle : undefined,
      duration: typeof body.duration === "number" ? body.duration : undefined,
    });

    console.log(`[SceneHTML] Scene ${sceneId || "unknown"} completed via ${generatedScene.generationMode}.`);
    return NextResponse.json({
      html: generatedScene.html,
      soundEvents: generatedScene.soundEvents,
      storyboard: generatedScene.storyboard,
      generationMode: generatedScene.generationMode,
    });
  } catch (error) {
    console.error("Scene HTML generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate scene HTML" },
      { status: 500 },
    );
  }
}
