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
export async function runFFmpeg(options: FFmpegOptions): Promise<void> {
    return new Promise((resolve, reject) => {
        const args: string[] = [];

        // Add overwrite flag
        if (options.overwrite !== false) {
            args.push('-y');
        }

        // Add input files (with optional flags)
        for (const input of options.inputs) {
            if (typeof input === 'string') {
                // Simple string input
                args.push('-i', input);
            } else {
                // Object with flags and path
                if (input.flags && input.flags.length > 0) {
                    args.push(...input.flags);
                }
                args.push('-i', input.path);
            }
        }

        // Add custom arguments
        args.push(...options.args);

        // Add output file
        args.push(options.output);

        console.log('🎬 Running FFmpeg (packaged binary):', 'ffmpeg', args.join(' '));

        const ffmpeg = spawn(ffmpegPath, args);

        let stderr = '';

        ffmpeg.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                console.error('FFmpeg stderr:', stderr);
                reject(new Error(`FFmpeg exited with code ${code}`));
            }
        });

        ffmpeg.on('error', (error) => {
            reject(new Error(`Failed to start FFmpeg: ${error.message}`));
        });
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
