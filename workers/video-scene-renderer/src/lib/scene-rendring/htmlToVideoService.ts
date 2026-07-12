import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { spawn } from "child_process";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { Writable } from "stream";

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
  }

  /**
   * Fast render path for live streaming:
   * Pipes screenshot buffers DIRECTLY to FFmpeg stdin, eliminating all disk I/O
   * for intermediate PNG frames. This gives ~30-40% speedup on disk-bound runners.
   *
   * ⚠️ LIVE STREAMING ONLY — Do NOT use for the daily long-form pipeline.
   */
  async renderFast(opts: RenderOptions): Promise<void> {
    const { html, width, height, fps, duration, output } = opts;
    const totalFrames = Math.ceil(duration * fps);
    const ffmpegPath = ffmpegInstaller.path;

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
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
        window.renderFrame = () => {};
      }
    });

    page.on("pageerror", (err: any) => {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? (err as { message: string }).message
          : String(err);
      throw new Error("Scene JS error: " + message);
    });

    // Spawn FFmpeg reading raw PNG frames from stdin
    const ffmpegArgs = [
      "-y",
      "-f", "image2pipe",
      "-framerate", String(fps),
      "-i", "pipe:0",          // read frames from stdin
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", "16",
      "-pix_fmt", "yuv420p",
      "-threads", "1",
      "-movflags", "+faststart",
      output,
    ];

    const ffmpegProc = spawn(ffmpegPath, ffmpegArgs, { stdio: ["pipe", "inherit", "inherit"] });
    const stdin = ffmpegProc.stdin as Writable;

    const ffmpegDone = new Promise<void>((resolve, reject) => {
      ffmpegProc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg (fast) exited with code ${code}`));
      });
      ffmpegProc.on("error", reject);
    });

    console.error(`🎥 [Fast] Rendering ${totalFrames} frames → piping to FFmpeg stdin`);

    try {
      for (let frame = 0; frame < totalFrames; frame++) {
        const time = frame / fps;
        await page.evaluate((t: number) => {
          // @ts-ignore
          window.renderFrame(t);
        }, time);
        // Capture frame as PNG buffer — no disk write
        const buffer = await page.screenshot({ type: "png", captureBeyondViewport: false });
        // Write to FFmpeg stdin — will backpressure automatically
        const canContinue = stdin.write(buffer);
        if (!canContinue) {
          // Wait for drain before continuing to avoid memory bloat
          await new Promise<void>((r) => stdin.once("drain", r));
        }
      }
    } finally {
      await browser.close();
      stdin.end();
    }

    await ffmpegDone;
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
