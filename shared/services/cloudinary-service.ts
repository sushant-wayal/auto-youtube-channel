/**
 * Shared Cloudinary Service
 * Handles file uploads and management for all workers
 */

import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import config from '../config';
import fs from 'fs';
import path from 'path';

export interface CloudinaryUploadResult {
    publicId: string;
    secureUrl: string;
    format: string;
    duration?: number;
    bytes: number;
}

export class CloudinaryVideoSizeLimitError extends Error {
    constructor(
        public readonly fileSizeBytes: number,
        public readonly maxSizeBytes: number
    ) {
        super(
            `Video is ${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MiB, above this Cloudinary account's ` +
            `video upload limit of ${(maxSizeBytes / (1024 * 1024)).toFixed(1)} MiB.`
        );
        this.name = 'CloudinaryVideoSizeLimitError';
    }
}

// Keep a margin below Cloudinary's 100 MB single-request limit because the
// effective limit can vary by account. Large uploads are split into 20 MB parts.
const CHUNKED_UPLOAD_THRESHOLD_BYTES = 50 * 1024 * 1024;
const VIDEO_UPLOAD_CHUNK_SIZE_BYTES = 20 * 1000 * 1000;

class CloudinaryService {
    private static instance: CloudinaryService;

    private constructor() {
        cloudinary.config({
            cloud_name: config.cloudinary.cloudName,
            api_key: config.cloudinary.apiKey,
            api_secret: config.cloudinary.apiSecret,
        });
        console.error('✅ Cloudinary configured');
    }

    static getInstance(): CloudinaryService {
        if (!CloudinaryService.instance) {
            CloudinaryService.instance = new CloudinaryService();
        }
        return CloudinaryService.instance;
    }

    /**
     * Upload a video file to Cloudinary
     */
    async uploadVideo(
        filePath: string,
        folder: string,
        publicId?: string
    ): Promise<CloudinaryUploadResult> {
        console.error(`☁️ Uploading video to Cloudinary: ${filePath}`);

        try {
            const uploadOptions = {
                resource_type: 'video',
                folder: `video-gen/${folder}`,
                public_id: publicId,
                overwrite: true,
            } as const;
            const fileSizeBytes = (await fs.promises.stat(filePath)).size;

            let result: UploadApiResponse;
            if (fileSizeBytes >= CHUNKED_UPLOAD_THRESHOLD_BYTES) {
                const accountMaxBytes = await this.getAccountVideoSizeLimit();
                if (accountMaxBytes && fileSizeBytes > accountMaxBytes) {
                    throw new CloudinaryVideoSizeLimitError(fileSizeBytes, accountMaxBytes);
                }
                console.error(`📦 Video is ${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB; uploading in chunks.`);
                result = await this.uploadVideoInChunks(filePath, uploadOptions);
            } else {
                try {
                    result = await cloudinary.uploader.upload(filePath, uploadOptions);
                } catch (error) {
                    if (!this.isPayloadTooLarge(error)) throw error;

                    console.error('⚠️ Cloudinary returned HTTP 413; retrying this video with chunked upload.');
                    result = await this.uploadVideoInChunks(filePath, uploadOptions);
                }
            }

            console.error(`✅ Video uploaded: ${result.secure_url}`);

            return {
                publicId: result.public_id,
                secureUrl: result.secure_url,
                format: result.format,
                duration: result.duration,
                bytes: result.bytes,
            };
        } catch (error) {
            const details = this.formatUploadError(error);
            console.error(`❌ Cloudinary video upload failed: ${details}`);
            if (error instanceof CloudinaryVideoSizeLimitError) throw error;
            if (this.isPayloadTooLarge(error)) {
                const size = (await fs.promises.stat(filePath).catch(() => ({ size: 0 }))).size;
                throw new CloudinaryVideoSizeLimitError(size, 104857600);
            }
            throw new Error(`Failed to upload video: ${details}`);
        }
    }

    private uploadVideoInChunks(
        filePath: string,
        options: {
            readonly resource_type: 'video';
            readonly folder: string;
            readonly public_id: string | undefined;
            readonly overwrite: true;
        }
    ): Promise<UploadApiResponse> {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_large(
                filePath,
                { ...options, chunk_size: VIDEO_UPLOAD_CHUNK_SIZE_BYTES },
                (error, result) => {
                    if (error) {
                        reject(error);
                    } else if (result) {
                        resolve(result);
                    } else {
                        reject(new Error('Cloudinary completed the chunked upload without a result.'));
                    }
                }
            );

            const streamWithErrors = uploadStream as unknown as {
                on?: (event: 'error', listener: (error: Error) => void) => unknown;
            };
            streamWithErrors.on?.('error', reject);
        });
    }

    private isPayloadTooLarge(error: unknown): boolean {
        if (!error || typeof error !== 'object') return false;
        const details = error as { http_code?: unknown; statusCode?: unknown };
        return Number(details.http_code ?? details.statusCode) === 413;
    }

    private async getAccountVideoSizeLimit(): Promise<number | null> {
        try {
            const usage = await cloudinary.api.usage();
            const limit = Number(usage?.media_limits?.video_max_size_bytes);
            return Number.isFinite(limit) && limit > 0 ? limit : null;
        } catch (error) {
            // The upload attempt remains authoritative if the optional Admin API
            // preflight is unavailable or rate-limited.
            console.warn('⚠️ Could not read the Cloudinary video upload limit; proceeding with chunked upload.');
            return null;
        }
    }

    private formatUploadError(error: unknown): string {
        if (error instanceof Error) {
            const details = error as Error & { http_code?: unknown; name?: string };
            const httpCode = details.http_code ? ` (HTTP ${details.http_code})` : '';
            return `${details.message}${httpCode}`;
        }
        if (error && typeof error === 'object') {
            const details = error as { message?: unknown; http_code?: unknown; name?: unknown };
            return [details.name, details.message, details.http_code ? `HTTP ${details.http_code}` : '']
                .filter(Boolean)
                .join(': ') || JSON.stringify(error);
        }
        return String(error);
    }

    /**
     * Upload an audio file to Cloudinary
     */
    async uploadAudio(
        filePath: string,
        folder: string,
        publicId?: string
    ): Promise<CloudinaryUploadResult> {
        console.error(`☁️ Uploading audio to Cloudinary: ${filePath}`);

        try {
            const result: UploadApiResponse = await cloudinary.uploader.upload(filePath, {
                resource_type: 'video', // Cloudinary uses 'video' for audio files too
                folder: `video-gen/${folder}`,
                public_id: publicId,
                overwrite: true,
            });

            console.error(`✅ Audio uploaded: ${result.secure_url}`);

            return {
                publicId: result.public_id,
                secureUrl: result.secure_url,
                format: result.format,
                duration: result.duration,
                bytes: result.bytes,
            };
        } catch (error) {
            console.error('❌ Cloudinary audio upload failed:', error);
            throw new Error(`Failed to upload audio: ${error}`);
        }
    }

    /**
     * Upload an image file to Cloudinary
     */
    async uploadImage(
        filePath: string,
        folder: string,
        publicId?: string
    ): Promise<CloudinaryUploadResult> {
        console.error(`☁️ Uploading image to Cloudinary: ${filePath}`);

        try {
            const result: UploadApiResponse = await cloudinary.uploader.upload(filePath, {
                resource_type: 'image',
                folder: `video-gen/${folder}`,
                public_id: publicId,
                overwrite: true,
            });

            console.error(`✅ Image uploaded: ${result.secure_url}`);

            return {
                publicId: result.public_id,
                secureUrl: result.secure_url,
                format: result.format,
                bytes: result.bytes,
            };
        } catch (error) {
            console.error('❌ Cloudinary image upload failed:', error);
            throw new Error(`Failed to upload image: ${error}`);
        }
    }

    /**
     * Download a file from URL to local path
     */
    async downloadFile(url: string, outputPath: string): Promise<void> {
        console.error(`⬇️ Downloading file from: ${url}`);

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Ensure directory exists
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(outputPath, buffer);
            console.error(`✅ Downloaded to: ${outputPath}`);
        } catch (error) {
            console.error('❌ File download failed:', error);
            throw new Error(`Failed to download file: ${error}`);
        }
    }

    /**
     * Delete a file from Cloudinary
     */
    async deleteFile(publicId: string, resourceType: 'video' | 'image' = 'video'): Promise<void> {
        try {
            await cloudinary.uploader.destroy(publicId, {
                resource_type: resourceType,
            });
            console.error(`🗑️ Deleted from Cloudinary: ${publicId}`);
        } catch (error) {
            console.error('❌ Cloudinary delete failed:', error);
        }
    }

    /**
     * Delete multiple files from Cloudinary
     */
    async deleteFiles(publicIds: string[], resourceType: 'video' | 'image' = 'video'): Promise<void> {
        try {
            await cloudinary.api.delete_resources(publicIds, {
                resource_type: resourceType,
            });
            console.error(`🗑️ Deleted ${publicIds.length} files from Cloudinary`);
        } catch (error) {
            console.error('❌ Cloudinary bulk delete failed:', error);
        }
    }

    /**
     * Extract Cloudinary public ID from a URL
     */
    static extractPublicId(url: string): string | null {
        try {
            const uploadIndex = url.indexOf('/upload/');
            if (uploadIndex === -1) return null;
            let pathAfterUpload = url.slice(uploadIndex + '/upload/'.length);
            // Strip version (e.g. v1766232798/) or transformations
            pathAfterUpload = pathAfterUpload.replace(/^(?:[a-zA-Z0-9_,-]+\/)*v\d+\//, '');
            // Strip extension (e.g. .mp4, .jpg, .webm, etc.)
            const dotIndex = pathAfterUpload.lastIndexOf('.');
            if (dotIndex !== -1) {
                pathAfterUpload = pathAfterUpload.slice(0, dotIndex);
            }
            return pathAfterUpload;
        } catch {
            return null;
        }
    }

    /**
     * Delete files by their full Cloudinary URLs
     */
    async deleteFilesByUrls(urls: string[], resourceType: 'video' | 'image' = 'video'): Promise<void> {
        const publicIds = urls
            .map(u => CloudinaryService.extractPublicId(u))
            .filter((id): id is string => Boolean(id));

        if (publicIds.length === 0) return;

        // Process in chunks of 100
        for (let i = 0; i < publicIds.length; i += 100) {
            const chunk = publicIds.slice(i, i + 100);
            await this.deleteFiles(chunk, resourceType);
        }
    }

    /**
     * Clean up intermediate and scene files for a job
     */
    async cleanupJobFiles(jobId: string): Promise<void> {
        try {
            // Delete video/audio assets in the job folder
            await cloudinary.api.delete_resources_by_prefix(`video-gen/${jobId}`, {
                resource_type: 'video',
            });
            // Delete any scene clips prefixed with jobId
            await cloudinary.api.delete_resources_by_prefix(`video-gen/scenes/${jobId}`, {
                resource_type: 'video',
            });
            console.error(`🧹 Cleaned up intermediate files for job: ${jobId}`);
        } catch (error) {
            console.error('❌ Cleanup failed:', error);
        }
    }
}

export default CloudinaryService;
