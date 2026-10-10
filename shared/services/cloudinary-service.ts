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
            const result: UploadApiResponse = await cloudinary.uploader.upload(filePath, {
                resource_type: 'video',
                folder: `video-gen/${folder}`,
                public_id: publicId,
                overwrite: true,
            });

            console.error(`✅ Video uploaded: ${result.secure_url}`);

            return {
                publicId: result.public_id,
                secureUrl: result.secure_url,
                format: result.format,
                duration: result.duration,
                bytes: result.bytes,
            };
        } catch (error) {
            console.error('❌ Cloudinary video upload failed:', error);
            throw new Error(`Failed to upload video: ${error}`);
        }
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
