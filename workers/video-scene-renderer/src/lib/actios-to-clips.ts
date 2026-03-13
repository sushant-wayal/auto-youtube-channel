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

  constructor(scenes: SceneIR[], jobId: string) {
    this.scenes = scenes;
    this.jobId = jobId;
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

      const { html, animationStopTime } = this.htmlRenderer.render({
        duration: scene.baseDuration,
        actions: scene.actions,
        sceneTheme: resolvedTheme,
      }, height, width);

      const outPath = path.join(
        outputDir,
        `scene_${String(i).padStart(3, "0")}.mp4`
      );

      const duration = scene.baseDuration + scene.holdDuration;

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
}
