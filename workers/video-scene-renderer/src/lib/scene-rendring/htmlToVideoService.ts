import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { spawn } from "child_process";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

interface RenderOptions {
  html: string;
  width: number;
  height: number;
  fps: number;
  duration: number; // seconds
  output: string;   // .mp4
}

export class HtmlToVideoService {
  async render(opts: RenderOptions): Promise<void> {
    const { html, width, height, fps, duration, output } = opts;

    const totalFrames = Math.ceil(duration * fps);
    const framesDir = path.resolve(".frames_tmp");

    fs.rmSync(framesDir, { recursive: true, force: true });
    fs.mkdirSync(framesDir, { recursive: true });

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.setViewport({ width, height });

    await page.setContent(html, { waitUntil: "load" });
    await page.waitForFunction(
      "typeof document === 'undefined' || !document.fonts || document.fonts.status === 'loaded'"
    );
    await page.evaluate(() => {
      // @ts-ignore
      if (typeof window.renderFrame !== "function") {
        // @ts-ignore
        window.renderFrame = () => { };
      }
    });

    // crash early if renderer JS errors
    page.on("pageerror", (err: any) => {
      const message = typeof err === "object" && err !== null && "message" in err
        ? (err as { message: string }).message
        : String(err);
      throw new Error("Scene JS error: " + message);
    });

    console.error(`🎥 Starting frame rendering: ${totalFrames} frames at ${fps} fps`);

    for (let frame = 0; frame < totalFrames; frame++) {
      const time = frame / fps;

      await page.evaluate((t: number) => {
        // @ts-ignore
        window.renderFrame(t);
      }, time);

      const framePath = path.join(
        framesDir,
        `frame_${String(frame).padStart(5, "0")}.png`
      );

      await page.screenshot({ path: framePath });
    }

    await browser.close();

    await this.encodeVideo(framesDir, fps, output);

    fs.rmSync(framesDir, { recursive: true, force: true });
  }

  private encodeVideo(
    framesDir: string,
    fps: number,
    output: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpegPath = ffmpegInstaller.path;

      const args = [
        "-y",

        // Input
        "-framerate", String(fps),
        "-i", path.join(framesDir, "frame_%05d.png"),

        // Encoding (safe for Railway free tier)
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "16",
        "-pix_fmt", "yuv420p",

        // Resource control
        "-threads", "1",         // IMPORTANT for free tier stability

        // Output flags
        "-movflags", "+faststart",

        output
      ];


      const ffmpeg = spawn(ffmpegPath, args, { stdio: "inherit" });

      ffmpeg.on("error", reject);
      ffmpeg.on("close", code => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
    });
  }
}
