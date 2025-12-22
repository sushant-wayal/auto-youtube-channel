import path from "path";
import fs from "fs";

import { SceneHtmlRenderer } from "./scene-rendring/action-flow-to-html";
import { HtmlToVideoService } from "./scene-rendring/htmlToVideoService";
import { SceneIR } from "../types";
import CloudinaryService from "../services/cloudinary-service";
import RedisService from "../services/redis-service";

export class ClipsRenderService {
  private htmlRenderer;
  private videoRenderer;
  private cloudinaryService;
	private redisService;
	private scenes: SceneIR[];
	private jobId: string;

	constructor(scenes: SceneIR[], jobId: string) {
		this.scenes = scenes;
		this.jobId = jobId;
		this.cloudinaryService = CloudinaryService.getInstance();
		this.redisService = RedisService.getInstance();
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
			await this.redisService.updateJobProgress(
				this.jobId,
				"processing",
				5 + Math.floor((90 * i) / this.scenes.length),
				`Rendering scene ${i + 1} of ${this.scenes.length}...`
			);

      const scene = this.scenes[i];

      const { html, animationStopTime } = this.htmlRenderer.render({
        duration : scene.baseDuration,
        actions: scene.actions
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
				`scene_${scene.id}`
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
