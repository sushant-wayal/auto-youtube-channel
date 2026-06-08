import path from "path";
import fs from "fs";

import { SceneHtmlRenderer } from "./scene-rendring/action-flow-to-html";
import { HtmlToVideoService } from "./scene-rendring/htmlToVideoService";
import { SceneIR } from "../types";
import CloudinaryService from '../../../../shared/services/cloudinary-service';

export class ClipsRenderService {
  private htmlRenderer;
  private videoRenderer;
  private cloudinaryService;
  private scenes: SceneIR[];
  private jobId: string;
  private renderMethod: "code" | "ai";
  private isShort: boolean;
  private websiteDomain: string;

  constructor(
    scenes: SceneIR[],
    jobId: string,
    options?: {
      renderMethod?: "code" | "ai";
      isShort?: boolean;
      websiteDomain?: string;
    }
  ) {
    this.scenes = scenes;
    this.jobId = jobId;
    this.renderMethod = options?.renderMethod || "code";
    this.isShort = options?.isShort === true;
    this.websiteDomain = options?.websiteDomain || "http://localhost:3000";
    this.cloudinaryService = CloudinaryService.getInstance();
    this.htmlRenderer = new SceneHtmlRenderer();
    this.videoRenderer = new HtmlToVideoService();
  }

  async renderScenes(
    width: number,
    height: number,
    fps: number,
    outputDir: string
  ): Promise<{ urls: string[]; timings: number[]; animationStopTimes: number[] }> {

    fs.mkdirSync(outputDir, { recursive: true });

    const urls: string[] = [];
    const timings: number[] = [];
    const animationStopTimes: number[] = [];

    for (let i = 0; i < this.scenes.length; i++) {
      console.error(`🎬 Rendering scene ${i + 1} of ${this.scenes.length}...`);

      const scene = this.scenes[i];
      const resolvedTheme = scene.sceneTheme && scene.sceneTheme !== "auto"
        ? scene.sceneTheme
        : (i % 2 === 0 ? "light" : "dark");

      const sceneDuration = scene.baseDuration + (scene.holdDuration ?? 0);
      const duration = this.renderMethod === "ai" ? Math.min(sceneDuration, 120) : sceneDuration;
      const { html, animationStopTime } = this.renderMethod === "ai"
        ? await this.generateAiSceneHtml(scene, duration)
        : this.htmlRenderer.render({
          duration: scene.baseDuration,
          actions: scene.actions,
          sceneTheme: resolvedTheme,
        }, height, width);

      const outPath = path.join(
        outputDir,
        `scene_${String(i).padStart(3, "0")}.mp4`
      );

      await this.videoRenderer.render({
        html,
        width: width,
        height: height,
        fps: fps,
        duration,
        output: outPath
      });

      const result = await this.cloudinaryService.uploadVideo(
        outPath,
        "scenes",
        `${this.jobId}_scene_${scene.id}`
      );

      fs.unlinkSync(outPath);

      urls.push(result.secureUrl);
      timings.push(duration);
      animationStopTimes.push(animationStopTime);
    }

    fs.rmSync(outputDir, { recursive: true, force: true });

    return { urls, timings, animationStopTimes };
  }

  private async generateAiSceneHtml(
    scene: SceneIR,
    duration: number
  ): Promise<{ html: string; animationStopTime: number }> {
    const response = await fetch(`${this.websiteDomain}/api/generate-scene-html`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sceneId: scene.id,
        narration: scene.narration || "",
        duration,
        isShort: this.isShort,
        allowEmptyNarration: true,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`AI scene HTML generation failed (${response.status}): ${errorBody || response.statusText}`);
    }

    const data = await response.json() as { html?: string; error?: string };
    if (!data.html) {
      throw new Error(data.error || "AI scene HTML generation returned no HTML");
    }

    return {
      html: data.html,
      animationStopTime: duration,
    };
  }
}
