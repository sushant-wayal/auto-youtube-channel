import path from "path";
import fs from "fs";
import Redis from "ioredis";

import { SceneHtmlRenderer } from "./scene-rendring/action-flow-to-html";
import { HtmlToVideoService } from "./scene-rendring/htmlToVideoService";
import { acquireSceneHtmlTicket } from "./scene-html-ticket-queue";
import { ActionIR, SceneIR } from "../types";
import CloudinaryService from '../../../../shared/services/cloudinary-service';
import type { SoundEvent } from '../../../../workers/video-assembler/src/lib/assests/sfx-mixer';

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
  ): Promise<{ urls: string[]; timings: number[]; animationStopTimes: number[]; perSceneSoundEvents: SoundEvent[][] }> {

    fs.mkdirSync(outputDir, { recursive: true });

    const urls: string[] = [];
    const timings: number[] = [];
    const animationStopTimes: number[] = [];
    const perSceneSoundEvents: SoundEvent[][] = [];

    const redis = new Redis(process.env.REDIS_URL!);

    try {
      for (let i = 0; i < this.scenes.length; i++) {
        const scene = this.scenes[i];
        // Version the cache and include the render mode. Older AI runs could
        // cache code-rendered fallback clips under the same key as AI output.
        const cacheKey = `render_cache:v2:${this.renderMethod}:${this.jobId}:${scene.id}`;

        const cached = await redis.hgetall(cacheKey);
        if (cached && cached.url && cached.timing && cached.animationStopTime) {
          console.error(`🎬 Skipping scene ${i + 1} of ${this.scenes.length} (already rendered).`);
          urls.push(cached.url);
          timings.push(Number(cached.timing));
          animationStopTimes.push(Number(cached.animationStopTime));
          // Restore sound events from cache (stored as JSON string)
          try {
            const cachedEvents: SoundEvent[] = cached.soundEvents
              ? JSON.parse(cached.soundEvents)
              : [];
            perSceneSoundEvents.push(cachedEvents);
          } catch {
            perSceneSoundEvents.push([]);
          }
          if (!this.isShort) {
            await redis.rpush('pipeline:status:sceneUrls', cached.url);
            await redis.expire('pipeline:status:sceneUrls', 86400 * 7);
          }
          continue;
        }

        console.error(`🎬 Rendering scene ${i + 1} of ${this.scenes.length}...`);

        const resolvedTheme = scene.sceneTheme && scene.sceneTheme !== "auto"
          ? scene.sceneTheme
          : (i % 2 === 0 ? "light" : "dark");

        const sceneDuration = scene.baseDuration + (scene.holdDuration ?? 0);
        let duration = this.renderMethod === "ai" ? Math.min(sceneDuration, 120) : sceneDuration;
        let html: string;
        let animationStopTime: number;
        let plannedSoundEvents: SoundEvent[] | undefined;

        if (this.renderMethod === "ai") {
          const generated = await this.generateAiSceneHtml(scene, duration);
          html = generated.html;
          animationStopTime = generated.animationStopTime;
          plannedSoundEvents = generated.soundEvents;
        } else {
          const rendered = this.htmlRenderer.render({
              duration: scene.baseDuration,
              actions: this.getSceneActions(scene, width, height, resolvedTheme),
              sceneTheme: resolvedTheme,
          }, height, width);
          html = rendered.html;
          animationStopTime = rendered.animationStopTime;
        }

        const outPath = path.join(
          outputDir,
          `scene_${String(i).padStart(3, "0")}.mp4`
        );

        const renderRes = await this.videoRenderer.render({
          html,
          width: width,
          height: height,
          fps: fps,
          duration,
          output: outPath,
          soundEvents: plannedSoundEvents,
        });

        const soundEvents = renderRes?.soundEvents || [];

        const result = await this.cloudinaryService.uploadVideo(
          outPath,
          "scenes",
          `${this.jobId}_scene_${scene.id}`
        );

        fs.unlinkSync(outPath);

        urls.push(result.secureUrl);
        timings.push(duration);
        animationStopTimes.push(animationStopTime);
        perSceneSoundEvents.push(soundEvents);

        await redis.hset(cacheKey, {
          url: result.secureUrl,
          timing: duration,
          animationStopTime: animationStopTime,
          soundEvents: JSON.stringify(soundEvents),
        });
        await redis.expire(cacheKey, 86400); // 1 day expiration for safety
        if (!this.isShort) {
          await redis.rpush('pipeline:status:sceneUrls', result.secureUrl);
          await redis.expire('pipeline:status:sceneUrls', 86400 * 7);
        }
      }

      fs.rmSync(outputDir, { recursive: true, force: true });

      // Cleanup redis keys since all scenes rendered successfully
      const pipeline = redis.multi();
      for (const scene of this.scenes) {
        pipeline.del(`render_cache:v2:${this.renderMethod}:${this.jobId}:${scene.id}`);
      }
      await pipeline.exec();
    } finally {
      await redis.quit();
    }

    return { urls, timings, animationStopTimes, perSceneSoundEvents };
  }

  private async generateAiSceneHtml(
    scene: SceneIR,
    duration: number
  ): Promise<{ html: string; animationStopTime: number; soundEvents?: SoundEvent[] }> {
    // Keep the FIFO wait in the long-running renderer worker, not inside a
    // five-minute Vercel request. The website's project limiter still reserves
    // a slot for each actual Gemini call (direction, HTML, or direct fallback).
    const releaseTicket = await acquireSceneHtmlTicket(`${this.jobId}/${scene.id}`);
    let response: Response;
    try {
      response = await fetch(`${this.websiteDomain}/api/generate-scene-html`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId: scene.id,
          sceneTitle: scene.sceneTitle,
          narration: scene.narration || "",
          duration,
          isShort: this.isShort,
          allowEmptyNarration: true,
        }),
        signal: AbortSignal.timeout(270_000),
      });
    } finally {
      await releaseTicket();
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`AI scene HTML generation failed (${response.status}): ${errorBody || response.statusText}`);
    }

    const data = await response.json() as {
      html?: string;
      soundEvents?: SoundEvent[];
      error?: string;
      generationMode?: "storyboard" | "direct-html-fallback";
    };
    if (!data.html) {
      throw new Error(data.error || "AI scene HTML generation returned no HTML");
    }

    if (data.generationMode === "direct-html-fallback") {
      console.warn(`[SceneRender] Scene ${scene.id} used Gemini's direct HTML fallback after storyboard generation failed.`);
    }

    return {
      html: data.html,
      soundEvents: data.soundEvents,
      // AI scenes often render a long looping/timeline visual. Let assembly
      // choose the final length from narration audio instead of visual length.
      animationStopTime: -1,
    };
  }

  private getSceneActions(
    scene: SceneIR,
    width: number,
    height: number,
    theme: "light" | "dark",
  ): ActionIR[] {
    if (Array.isArray(scene.actions) && scene.actions.length > 0) return scene.actions;

    // Never render a content scene as only the subtle background grid. This is
    // an emergency fallback for malformed/older script data, not the normal art
    // direction; narration and title still produce a readable visual card.
    console.warn(`[SceneRender] Scene ${scene.id} has no fallback actions; generating a title-and-narration card.`);

    const dark = theme === "dark";
    const sourceTitle = scene.sceneTitle?.trim()
      || scene.narration?.trim().split(/[.!?]/, 1)[0]
      || "Key idea";
    const title = sourceTitle.replace(/\s+/g, " ").trim();
    const firstSentence = scene.narration?.trim().split(/(?<=[.!?])\s+/, 1)[0] || "";
    const description = firstSentence && firstSentence.toLowerCase() !== title.toLowerCase()
      ? firstSentence
      : scene.narration?.trim() || "A clear visual summary of this scene.";
    const maxChars = height > width ? 20 : 32;
    const wrap = (text: string, limit: number, maxLines: number): string[] => {
      const words = text.split(/\s+/).filter(Boolean);
      const lines: string[] = [];
      let line = "";
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (candidate.length > limit && line) {
          lines.push(line);
          line = word;
          if (lines.length === maxLines) break;
        } else {
          line = candidate;
        }
      }
      if (line && lines.length < maxLines) lines.push(line);
      return lines.length ? lines : ["Key idea"];
    };

    const titleLines = wrap(title, maxChars, 2);
    const descriptionLines = wrap(description, maxChars + 8, 2);
    const titleSize = Math.round(Math.min(84, Math.max(48, Math.min(width, height) * 0.075)));
    const bodySize = Math.round(Math.min(40, Math.max(26, Math.min(width, height) * 0.035)));
    const cardY = height * 0.27;
    const titleStartY = height * (titleLines.length === 1 ? 0.41 : 0.37);
    const titleGap = titleSize * 1.18;
    const descriptionStartY = Math.max(height * 0.56, titleStartY + titleLines.length * titleGap + bodySize * 0.65);
    const textColor = dark ? "#F1F5F9" : "#18181B";
    const mutedColor = dark ? "#CBD5E1" : "#52525B";
    const actions: ActionIR[] = [
      {
        t: 0,
        op: "rect",
        x: width * 0.09,
        y: cardY,
        w: width * 0.82,
        h: height * 0.48,
        r: 28,
        fill: dark ? "#1E293B" : "#FFFFFF",
        stroke: dark ? "#475569" : "#E4E4E7",
        strokeWidth: 2,
      },
    ];

    titleLines.forEach((value, index) => actions.push({
      t: 0.2 + index * 0.12,
      op: "text",
      x: width / 2,
      y: titleStartY + index * titleGap,
      value,
      fontSize: titleSize,
      fontWeight: 700,
      fill: textColor,
      align: "center",
      baseline: "middle",
      typewriter: false,
    }));

    actions.push({
      t: 0.5,
      op: "line",
      x1: width * 0.34,
      y1: descriptionStartY - bodySize * 0.85,
      x2: width * 0.66,
      y2: descriptionStartY - bodySize * 0.85,
      stroke: dark ? "#818CF8" : "#6366F1",
      strokeWidth: 4,
    });

    descriptionLines.forEach((value, index) => actions.push({
      t: 0.65 + index * 0.12,
      op: "text",
      x: width / 2,
      y: descriptionStartY + index * bodySize * 1.25,
      value,
      fontSize: bodySize,
      fill: mutedColor,
      align: "center",
      baseline: "middle",
      typewriter: false,
    }));

    return actions;
  }
}
