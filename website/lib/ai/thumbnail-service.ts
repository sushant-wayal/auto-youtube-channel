/**
 * Thumbnail Generation Service
 * Supports multiple backends: Gemini (disabled by default) and Hugging Face (free)
 * 
 * Environment Variables:
 * - THUMBNAIL_PROVIDER: "gemini" | "huggingface" (default: "huggingface")
 * - HUGGINGFACE_API_KEY: Optional, improves rate limits for HuggingFace
 * - GEMINI_API_KEY: Required if using Gemini provider
 */

import GeminiClient from "./gemini-client";
import HuggingFaceImageService, { HFImageConfig, HF_IMAGE_MODELS } from "./huggingface-image-service";
import type { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import CloudinaryService from "../cloudinary-service";

export type ThumbnailProvider = "gemini" | "huggingface";

export interface ThumbnailConfig {
    style?: "vibrant" | "minimal" | "dramatic" | "professional" | "fun";
    aspectRatio?: "16:9" | "1:1";
    includeText?: boolean;
    provider?: ThumbnailProvider; // Override default provider
    model?: string; // For HuggingFace: specific model to use
}

export interface ThumbnailResult {
    thumbnailPath: string;
    prompt: string;
    videoId: string;
    provider: ThumbnailProvider;
    model?: string;
}

class ThumbnailService {
    private genAI: GoogleGenAI;
    private hfService: HuggingFaceImageService;
    private readonly GEMINI_MODEL = "imagen-3.0-generate-002";
    private defaultProvider: ThumbnailProvider;

    constructor() {
        this.genAI = GeminiClient.getInstance().getGenAI();
        this.hfService = new HuggingFaceImageService();

        // Determine default provider from environment variable
        const envProvider = process.env.THUMBNAIL_PROVIDER?.toLowerCase();
        this.defaultProvider = envProvider === "gemini" ? "gemini" : "huggingface";

        console.log(`🎨 ThumbnailService initialized with provider: ${this.defaultProvider}`);
    }

    /**
     * Generate a YouTube thumbnail based on video context
     * Automatically selects provider based on environment config or override
     */
    async generateThumbnail(
        videoId: string,
        title: string,
        description: string,
        narration: string,
        tags: string[],
        config?: ThumbnailConfig
    ): Promise<ThumbnailResult> {
        const provider = config?.provider || this.defaultProvider;

        console.log(`\n🎨 === THUMBNAIL GENERATION ===`);
        console.log(`📹 Video ID: ${videoId}`);
        console.log(`🔧 Provider: ${provider}`);

        let result: ThumbnailResult;
        if (provider === "gemini") {
            result = await this.generateWithGemini(videoId, title, description, narration, tags, config);
        } else {
            result = await this.generateWithHuggingFace(videoId, title, description, narration, tags, config);
        }

        const cloudinaryService = CloudinaryService.getInstance();
        const uploadResult = await cloudinaryService.uploadImage(
            result.thumbnailPath,
            "thumbnails",
            `${videoId}-thumbnail`
        );

        result.thumbnailPath = uploadResult.secureUrl;

        return result;
    }

    /**
     * Generate thumbnail using Hugging Face (FREE - default)
     */
    private async generateWithHuggingFace(
        videoId: string,
        title: string,
        description: string,
        narration: string,
        tags: string[],
        config?: ThumbnailConfig
    ): Promise<ThumbnailResult> {
        const hfConfig: HFImageConfig = {
            style: config?.style,
            model: config?.model,
        };

        const result = await this.hfService.generateThumbnail(
            videoId,
            title,
            description,
            narration,
            tags,
            hfConfig
        );

        return {
            thumbnailPath: result.thumbnailPath,
            prompt: result.prompt,
            videoId: result.videoId,
            provider: "huggingface",
            model: result.model,
        };
    }

    /**
     * Generate thumbnail using Gemini (requires billing - disabled by default)
     */
    private async generateWithGemini(
        videoId: string,
        title: string,
        description: string,
        narration: string,
        tags: string[],
        config?: ThumbnailConfig
    ): Promise<ThumbnailResult> {
        console.log(`\n🎨 === GEMINI THUMBNAIL GENERATION STARTED ===`);
        console.log(`📹 Video ID: ${videoId}`);
        console.log(`📝 Title: ${title}`);
        console.log(`🎯 Style: ${config?.style || "vibrant"}`);

        try {
            // Build a detailed prompt for thumbnail generation
            const prompt = this.buildGeminiPrompt(title, description, narration, tags, config);

            console.log(`🖼️ Generated prompt for thumbnail...`);
            console.log(`📏 Aspect ratio: ${config?.aspectRatio || "16:9"}`);

            // Generate the thumbnail using Gemini's image generation
            const result = await this.genAI.models.generateImages({
                model: this.GEMINI_MODEL,
                prompt: prompt,
                config: {
                    numberOfImages: 1,
                    aspectRatio: config?.aspectRatio || "16:9",
                },
            });

            // Check if we got an image
            if (!result.generatedImages || result.generatedImages.length === 0) {
                throw new Error("No thumbnail generated");
            }

            const generatedImage = result.generatedImages[0];

            if (!generatedImage.image?.imageBytes) {
                throw new Error("No image data in response");
            }

            // Save the thumbnail
            const thumbnailPath = await this.saveThumbnail(
                videoId,
                generatedImage.image.imageBytes,
                "base64"
            );

            console.log(`✅ Thumbnail generated successfully!`);
            console.log(`📁 Saved to: ${thumbnailPath}`);
            console.log(`✅ === GEMINI THUMBNAIL GENERATION COMPLETE ===\n`);

            return {
                thumbnailPath,
                prompt,
                videoId,
                provider: "gemini",
            };

        } catch (error: any) {
            console.error(`❌ Gemini thumbnail generation failed:`, error);
            throw new Error(`Failed to generate thumbnail with Gemini: ${error.message || error}`);
        }
    }

    /**
     * Build an optimized prompt for Gemini thumbnail generation
     */
    private buildGeminiPrompt(
        title: string,
        description: string,
        narration: string,
        tags: string[],
        config?: ThumbnailConfig
    ): string {
        // Extract key themes from narration (first 500 chars for context)
        const narrationContext = narration.slice(0, 500);

        // Determine style descriptors
        const styleDescriptors = this.getStyleDescriptors(config?.style || "vibrant");

        // Build the prompt
        const prompt = `Create a stunning YouTube thumbnail image for a video titled "${title}".

Video Description: ${description}

Key Topics: ${tags.slice(0, 5).join(", ")}

Content Context: ${narrationContext}...

Style Requirements:
${styleDescriptors}

Technical Requirements:
- High resolution, crisp and clear
- Eye-catching composition that draws attention
- Professional quality suitable for YouTube
- Bold visual elements that stand out in search results
- Clean background that doesn't distract from the main subject
${config?.includeText === false ? "- NO text or words in the image" : "- Minimal or no text overlay (keep it visual)"}

Create a visually striking, clickable thumbnail that accurately represents the video content and would make viewers want to click and watch.`;

        return prompt;
    }

    /**
     * Get style-specific descriptors for the prompt
     */
    private getStyleDescriptors(style: string): string {
        const styles: Record<string, string> = {
            vibrant: `- Bright, saturated colors
- High contrast and energy
- Dynamic composition
- Bold and attention-grabbing
- Modern and fresh aesthetic`,

            minimal: `- Clean and simple design
- Muted, sophisticated colors
- Plenty of negative space
- Elegant and understated
- Professional minimalist aesthetic`,

            dramatic: `- Dark, moody atmosphere
- High contrast lighting
- Cinematic feel
- Intense and impactful
- Strong shadows and highlights`,

            professional: `- Corporate and polished look
- Business-appropriate colors
- Clean and organized layout
- Trustworthy and authoritative
- Refined and sophisticated`,

            fun: `- Playful and energetic
- Bright, cheerful colors
- Whimsical elements
- Lighthearted and engaging
- Creative and imaginative`,
        };

        return styles[style] || styles.vibrant;
    }

    /**
     * Save the generated thumbnail to disk
     */
    private async saveThumbnail(
        videoId: string,
        imageData: string | Buffer,
        encoding: "base64" | "buffer" = "buffer"
    ): Promise<string> {
        // Create the output directory
        const outputDir = path.join(process.cwd(), "tmp", "videos", videoId);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Save the thumbnail
        const thumbnailPath = path.join(outputDir, "thumbnail.png");

        if (encoding === "base64") {
            const imageBuffer = Buffer.from(imageData as string, "base64");
            fs.writeFileSync(thumbnailPath, imageBuffer);
        } else {
            fs.writeFileSync(thumbnailPath, imageData as Buffer);
        }

        // Return relative path for API access
        return `${videoId}/thumbnail.png`;
    }

    /**
     * Get the current default provider
     */
    getDefaultProvider(): ThumbnailProvider {
        return this.defaultProvider;
    }

    /**
     * Get available Hugging Face models
     */
    getAvailableHFModels(): string[] {
        return Object.values(HF_IMAGE_MODELS);
    }

    /**
     * Generate multiple thumbnail variations (Hugging Face only due to rate limits)
     */
    async generateThumbnailVariations(
        videoId: string,
        title: string,
        description: string,
        narration: string,
        tags: string[],
        count: number = 3
    ): Promise<ThumbnailResult[]> {
        const styles: Array<"vibrant" | "minimal" | "dramatic" | "professional" | "fun"> = [
            "vibrant",
            "dramatic",
            "professional",
            "minimal",
            "fun"
        ];

        const results: ThumbnailResult[] = [];

        for (let i = 0; i < Math.min(count, styles.length); i++) {
            try {
                const result = await this.generateThumbnail(
                    `${videoId}-var${i + 1}`,
                    title,
                    description,
                    narration,
                    tags,
                    {
                        style: styles[i],
                        provider: "huggingface" // Always use HF for variations to avoid costs
                    }
                );
                results.push(result);
            } catch (error) {
                console.error(`Failed to generate variation ${i + 1}:`, error);
            }
        }

        return results;
    }
}

export default ThumbnailService;
