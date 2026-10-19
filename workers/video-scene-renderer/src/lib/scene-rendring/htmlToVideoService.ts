import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { spawn } from "child_process";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import type { SoundEvent } from "../../../../video-assembler/src/lib/assests/sfx-mixer";

interface RenderOptions {
  html: string;
  width: number;
  height: number;
  fps: number;
  duration: number; // seconds
  output: string;   // .mp4
  /** Planned storyboard SFX; undefined preserves legacy extraction from HTML. */
  soundEvents?: SoundEvent[];
}

const VALID_SOUND_TYPES = new Set<SoundEvent["type"]>([
  "whoosh", "pop", "chime", "swipe", "swoosh", "typewriter", "tick", "expand", "ping", "data",
]);

function normalizeSoundEvents(raw: unknown, duration: number): SoundEvent[] {
  if (!Array.isArray(raw)) return [];

  const events = raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map(item => {
      const t = Number(item.t);
      const type = typeof item.type === "string" ? item.type.toLowerCase() as SoundEvent["type"] : undefined;
      if (!Number.isFinite(t) || t < 0 || t >= duration || !type || !VALID_SOUND_TYPES.has(type)) return null;

      const intensity = Number(item.intensity);
      const requestedDuration = Number(item.duration);
      const eventDuration = (type === "typewriter" || type === "data") && Number.isFinite(requestedDuration) && requestedDuration > 0
        ? Math.min(1.2, Math.max(0.1, requestedDuration))
        : undefined;

      return {
        t,
        type,
        intensity: Number.isFinite(intensity) ? Math.min(1.0, Math.max(0.4, intensity)) : 0.8,
        ...(eventDuration ? { duration: eventDuration } : {}),
      } satisfies SoundEvent;
    })
    .filter(event => event !== null) as SoundEvent[];

  events
    .sort((a, b) => a.t - b.t);

  const accepted: SoundEvent[] = [];
  for (const event of events) {
    const previous = accepted[accepted.length - 1];
    if (previous && event.t - previous.t < 0.2) {
      if ((event.intensity ?? 0) > (previous.intensity ?? 0)) accepted[accepted.length - 1] = event;
      continue;
    }
    if (accepted.length === 8) break;
    accepted.push(event);
  }
  return accepted;
}

export class HtmlToVideoService {
  async render(opts: RenderOptions): Promise<{ soundEvents: SoundEvent[] }> {
    const { html, width, height, fps, duration, output, soundEvents: plannedSoundEvents } = opts;

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

    // Freeze CSS keyframes so they do not auto-play on wall-clock time
    await page.addStyleTag({
      content: `* { animation-play-state: paused !important; }`
    });

    await page.evaluate(() => {
      // @ts-ignore
      if (typeof window.renderFrame !== "function") {
        // @ts-ignore
        window.renderFrame = () => { };
      }
    });

    // Extract sound events embedded in HTML by Gemini (window.SOUND_EVENTS)
    const embeddedSoundEvents = await page.evaluate(() => {
      // @ts-ignore
      const raw = window.SOUND_EVENTS;
      if (!Array.isArray(raw)) return [];
      return raw;
    }).catch(() => []);
    const soundEvents = plannedSoundEvents !== undefined
      ? normalizeSoundEvents(plannedSoundEvents, duration)
      : normalizeSoundEvents(embeddedSoundEvents, duration);

    // crash early if renderer JS errors
    page.on("pageerror", (err: any) => {
      const message = typeof err === "object" && err !== null && "message" in err
        ? (err as { message: string }).message
        : String(err);
      throw new Error("Scene JS error: " + message);
    });

    console.error(`🎥 Starting frame rendering: ${totalFrames} frames at ${fps} fps (found ${soundEvents.length} SFX events)`);

    for (let frame = 0; frame < totalFrames; frame++) {
      const time = frame / fps;

      await page.evaluate((t: number) => {
        // @ts-ignore
        window.renderFrame(t);

        // Force Web Animations API seeking to exact millisecond t * 1000
        // @ts-ignore
        if (typeof document !== 'undefined' && document.getAnimations) {
          // @ts-ignore
          document.getAnimations().forEach((anim: any) => {
            try {
              anim.pause();
              anim.currentTime = t * 1000;
            } catch (e) {}
          });
        }
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

    return { soundEvents };
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
