/**
 * FFmpeg Utility
 * Wrapper for executing FFmpeg commands with proper error handling
 * Uses @ffmpeg-installer/ffmpeg for Vercel compatibility
 */

import { spawn } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

const ffmpegPath = ffmpegInstaller.path;
const ffprobePath = ffprobeInstaller.path;

console.log('📦 FFmpeg binary path:', ffmpegPath);
console.log('📦 FFprobe binary path:', ffprobePath);

export interface FFmpegOptions {
    inputs: string[] | Array<{ flags?: string[], path: string }>;
    output: string;
    args: string[];
    overwrite?: boolean;
}

/**
 * Execute an FFmpeg command
 * @param options FFmpeg command options
 * @returns Promise that resolves when FFmpeg completes
 */
export async function runFFmpeg(
  options: FFmpegOptions
): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        const args: string[] = [];

    if (options.overwrite !== false) args.push("-y");

        for (const input of options.inputs) {
      if (typeof input === "string") {
        args.push("-i", input);
            } else {
        if (input.flags?.length) args.push(...input.flags);
        args.push("-i", input.path);
            }
        }

        args.push(...options.args);
        args.push(options.output);

        const ffmpeg = spawn(ffmpegPath, args);

    let stdout = "";
    let stderr = "";

    ffmpeg.stdout.on("data", d => {
      stdout += d.toString();
    });

    ffmpeg.stderr.on("data", d => {
      stderr += d.toString();
        });

    ffmpeg.on("close", code => {
      if (code === 0 || options.args.join(" ").includes("astats")) {
        resolve({ stdout, stderr });
            } else {
        reject(new Error(stderr || stdout));
            }
        });

    ffmpeg.on("error", reject);
    });
}

/**
 * Check if FFmpeg is available
 */
export async function checkFFmpeg(): Promise<boolean> {
    return new Promise((resolve) => {
        const ffmpeg = spawn(ffmpegPath, ['-version']);

        ffmpeg.on('close', (code) => {
            resolve(code === 0);
        });

        ffmpeg.on('error', () => {
            resolve(false);
        });
    });
}

/**
 * Get video duration in seconds
 */
export async function getVideoDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
        const args = [
            '-i', filePath,
            '-show_entries', 'format=duration',
            '-v', 'quiet',
            '-of', 'csv=p=0'
        ];

        const ffprobe = spawn(ffprobePath, args);
        let output = '';

        ffprobe.stdout.on('data', (data) => {
            output += data.toString();
        });

        ffprobe.on('close', (code) => {
            if (code === 0) {
                const duration = parseFloat(output.trim());
                resolve(duration);
            } else {
                reject(new Error(`ffprobe exited with code ${code}`));
            }
        });

        ffprobe.on('error', (error) => {
            reject(new Error(`Failed to start ffprobe: ${error.message}`));
        });
    });
}
