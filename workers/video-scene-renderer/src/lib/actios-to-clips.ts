import path from "path";
import fs from "fs";
import Redis from "ioredis";

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
  private pendingCleanups: Promise<void>[] = [];

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

    const redis = new Redis(process.env.REDIS_URL!);

    try {
      for (let i = 0; i < this.scenes.length; i++) {
        const scene = this.scenes[i];
        const cacheKey = `render_cache:${this.jobId}:${scene.id}`;

        const cached = await redis.hgetall(cacheKey);
        if (cached && cached.url && cached.timing && cached.animationStopTime) {
          console.error(`🎬 Skipping scene ${i + 1} of ${this.scenes.length} (already rendered).`);
          urls.push(cached.url);
          timings.push(Number(cached.timing));
          animationStopTimes.push(Number(cached.animationStopTime));
          continue;
        }

        console.error(`🎬 Rendering scene ${i + 1} of ${this.scenes.length}...`);

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

        await redis.hset(cacheKey, {
          url: result.secureUrl,
          timing: duration,
          animationStopTime: animationStopTime
        });
        await redis.expire(cacheKey, 86400); // 1 day expiration for safety
      }

      fs.rmSync(outputDir, { recursive: true, force: true });

      // Cleanup redis keys since all scenes rendered successfully
      const pipeline = redis.multi();
      for (const scene of this.scenes) {
        pipeline.del(`render_cache:${this.jobId}:${scene.id}`);
      }
      await pipeline.exec();
    } finally {
      await redis.quit();
    }

    // Await all pending rate-limit cooldowns (65 seconds sleep + queue releases)
    if (this.pendingCleanups.length > 0) {
      console.error(`[Queue] Waiting for ${this.pendingCleanups.length} pending rate-limit cooldown(s) to complete...`);
      await Promise.all(this.pendingCleanups);
    }

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

    const data = await response.json() as { html?: string; ticket?: number; error?: string };
    if (!data.html) {
      throw new Error(data.error || "AI scene HTML generation returned no HTML");
    }

    const ticket = data.ticket;
    if (ticket !== undefined) {
      console.error(`[Queue] Received HTML and ticket ${ticket} for scene ${scene.id}.`);
      
      const cleanupPromise = (async () => {
        try {
          console.error(`[Queue] Cooldown: sleeping for 22 seconds for ticket ${ticket}...`);
          await new Promise((resolve) => setTimeout(resolve, 22000));
          
          console.error(`[Queue] Cooldown complete. Advancing queue for ticket ${ticket}...`);
          const redis = new Redis(process.env.REDIS_URL!);
          
          // Atomically increment turn and delete processing key using a pipeline
          const pipeline = redis.multi();
          pipeline.incr("html_queue:turn");
          pipeline.del("html_queue:processing");
          await pipeline.exec();
          
          await redis.quit();
          console.error(`[Queue] Queue advanced and processing lease deleted for ticket ${ticket}.`);
        } catch (err) {
          console.error(`[Queue] Error during cleanup for ticket ${ticket}:`, err);
        }
      })();
      this.pendingCleanups.push(cleanupPromise);
    } else {
      console.error(`[Queue] No ticket returned from API route. Rate limiting might be bypassed.`);
    }

    return {
      html: data.html,
      // AI scenes often render a long looping/timeline visual. Let assembly
      // choose the final length from narration audio instead of visual length.
      animationStopTime: -1,
    };
  }
}
