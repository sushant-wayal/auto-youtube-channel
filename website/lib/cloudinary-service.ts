/**
 * Cloudinary Service
 * Handles file uploads and management for intermediate and final video files
 */

import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import fs from 'fs';
import path from 'path';

interface CloudinaryUploadResult {
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
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
            api_key: process.env.CLOUDINARY_API_KEY || '',
            api_secret: process.env.CLOUDINARY_API_SECRET || '',
        });
        console.log('✅ Cloudinary configured');
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
        console.log(`☁️ Uploading video to Cloudinary: ${filePath}`);

        try {
            const result: UploadApiResponse = await cloudinary.uploader.upload(filePath, {
                resource_type: 'video',
                folder: `video-gen/${folder}`,
                public_id: publicId,
                overwrite: true,
            });

            console.log(`✅ Video uploaded: ${result.secure_url}`);

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
        console.log(`☁️ Uploading audio to Cloudinary: ${filePath}`);

        try {
            const result: UploadApiResponse = await cloudinary.uploader.upload(filePath, {
                resource_type: 'video', // Cloudinary uses 'video' for audio files too
                folder: `video-gen/${folder}`,
                public_id: publicId,
                overwrite: true,
            });

            console.log(`✅ Audio uploaded: ${result.secure_url}`);

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
        console.log(`☁️ Uploading image to Cloudinary: ${filePath}`);

        try {
            const result: UploadApiResponse = await cloudinary.uploader.upload(filePath, {
                resource_type: 'image',
                folder: `video-gen/${folder}`,
                public_id: publicId,
                overwrite: true,
            });

            console.log(`✅ Image uploaded: ${result.secure_url}`);

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
        console.log(`⬇️ Downloading file from: ${url}`);

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
            console.log(`✅ Downloaded to: ${outputPath}`);
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
            console.log(`🗑️ Deleted from Cloudinary: ${publicId}`);
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
            console.log(`🗑️ Deleted ${publicIds.length} files from Cloudinary`);
        } catch (error) {
            console.error('❌ Cloudinary bulk delete failed:', error);
        }
    }

    /**
     * Clean up intermediate files for a job
     */
    async cleanupJobFiles(jobId: string): Promise<void> {
        try {
            // Delete all files in the job folder
            await cloudinary.api.delete_resources_by_prefix(`video-gen/${jobId}/intermediate`, {
                resource_type: 'video',
            });
            console.log(`🧹 Cleaned up intermediate files for job: ${jobId}`);
        } catch (error) {
            console.error('❌ Cleanup failed:', error);
        }
    }
}

export default CloudinaryService;
