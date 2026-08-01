/**
 * Hugging Face Image Generation Service
 * Uses Hugging Face's inference API for generating YouTube thumbnails
 * Requires HUGGINGFACE_API_KEY environment variable
 * Supports multiple models: SDXL-Turbo, Stable Diffusion XL, Flux, etc.
 */

import fs from "fs";
import path from "path";
import { HfInference } from "@huggingface/inference";

export interface HFImageConfig {
    model?: string;
    style?: "vibrant" | "minimal" | "dramatic" | "professional" | "fun";
    width?: number;
    height?: number;
}

export interface HFThumbnailResult {
    thumbnailPath: string;
    prompt: string;
    videoId: string;
    model: string;
}

// Available models on Hugging Face
export const HF_IMAGE_MODELS = {
    FLUX_SCHNELL: "black-forest-labs/FLUX.1-schnell",
    STABLE_DIFFUSION_3_5: "stabilityai/stable-diffusion-3.5-large",
    STABLE_DIFFUSION_XL: "stabilityai/stable-diffusion-xl-base-1.0",
    PLAYGROUND_V2_5: "playgroundai/playground-v2.5-1024px-aesthetic",
} as const;

class HuggingFaceImageService {
    private readonly apiUrl = "https://api-inference.huggingface.co/models";
    private readonly defaultModel = HF_IMAGE_MODELS.FLUX_SCHNELL;
    private apiKey: string;
    private hf: HfInference;

    constructor() {
        // API key is required for the new router endpoint
        const key = process.env.HUGGINGFACE_API_KEY;
        if (!key) {
            throw new Error(
                "HUGGINGFACE_API_KEY is required for thumbnail generation. " +
                "Get a free API key at https://huggingface.co/settings/tokens"
            );
        }
        this.apiKey = key;
        this.hf = new HfInference(this.apiKey);
    }

    /**
     * Generate a YouTube thumbnail using Hugging Face's inference API
     */
    async generateThumbnail(
        videoId: string,
        title: string,
        description: string,
        narration: string,
        tags: string[],
        config?: HFImageConfig
    ): Promise<HFThumbnailResult> {
        const model = config?.model || this.defaultModel;

        console.log(`\n🎨 === HUGGING FACE THUMBNAIL GENERATION STARTED ===`);
        console.log(`📹 Video ID: ${videoId}`);
        console.log(`📝 Title: ${title}`);
        console.log(`🤖 Model: ${model}`);
        console.log(`🎯 Style: ${config?.style || "minimal"}`);

        try {
            // Build optimized prompt for thumbnail generation
            const prompt = this.buildThumbnailPrompt(title, description, narration, tags, config);

            console.log(`🖼️ Generated prompt for thumbnail...`);
            console.log(`📝 Prompt preview: ${prompt.slice(0, 100)}...`);

            // Make request to Hugging Face API
            const imageBuffer = await this.generateImage(prompt, model);

            // Save the thumbnail
            const thumbnailPath = await this.saveThumbnail(videoId, imageBuffer);

            console.log(`✅ Thumbnail generated successfully!`);
            console.log(`📁 Saved to: ${thumbnailPath}`);
            console.log(`✅ === HUGGING FACE THUMBNAIL GENERATION COMPLETE ===\n`);

            return {
                thumbnailPath,
                prompt,
                videoId,
                model,
            };

        } catch (error: unknown) {
            console.error(`❌ Hugging Face thumbnail generation failed:`, error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to generate thumbnail with Hugging Face: ${errorMessage}`);
        }
    }

    /**
     * Generate image using Hugging Face Inference API
     */
    private async generateImage(prompt: string, model: string): Promise<Buffer> {
        console.log(`🚀 Sending request to Hugging Face API via SDK...`);
        console.log(`🤖 Model: ${model}`);

        // Retry logic for model loading
        let attempts = 0;
        const maxAttempts = 3;
        let lastError: Error | null = null;

        while (attempts < maxAttempts) {
            attempts++;

            try {
                // Use official SDK which handles retries and rate limits better
                const blob = await this.hf.textToImage({
                    inputs: prompt,
                    model: model,
                    parameters: {
                        num_inference_steps: 4,
                        guidance_scale: 0.0,
                    }
                }, {
                    // @ts-expect-error - wait_for_model is missing from types
                    wait_for_model: true,
                });

                // Convert Blob to Buffer
                const arrayBuffer = await blob.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);

                if (buffer.length < 1000) {
                    // Probably an error response, not an image
                    const text = buffer.toString('utf-8');
                    throw new Error(`Invalid response or too small: ${text}`);
                }

                console.log(`✅ Received image: ${buffer.length} bytes`);
                return buffer;

            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                lastError = error instanceof Error ? error : new Error(errorMessage);
                console.error(`❌ Attempt ${attempts} failed:`, errorMessage);

                if (attempts < maxAttempts) {
                    console.log(`🔄 Retrying in 5 seconds...`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
        }

        throw lastError || new Error("Failed to generate image after multiple attempts");
    }

    /**
     * Build an optimized prompt for thumbnail generation
     */
    private buildThumbnailPrompt(
        title: string,
        description: string,
        narration: string,
        tags: string[],
        config?: HFImageConfig
    ): string {
        // Build a concise but effective prompt
        const prompt = `
Create a high-quality YouTube thumbnail in a dark futuristic engineering style.

TITLE: "${title}"

Design style:
• Dark tech background with glowing blue, purple and neon network lines
• Modern data center / cloud infrastructure vibe
• Cinematic lighting, high contrast, ultra sharp

Layout:
• The TITLE in huge bold white text at the top, thick black outline, dramatic YouTube style
• Center: a glowing technical diagram explaining the concept in the title
• Use arrows, icons, flow diagrams, server/database icons, gears, warning symbols
• Visualize a performance issue, bottleneck, or technical concept dramatically

Graphics style:
• Neon glowing arrows showing data flow
• Tech icons like servers, databases, cache icons, CPU symbols
• Red warning elements for problems, green indicators for success
• Labels explaining the diagram (short phrases like "Concurrent Requests", "Bottleneck", "Blocked", etc.)

Composition:
• Left → system inputs or requests
• Middle → the bottleneck / core concept
• Right → consequences (blocked, crash, slowdown, etc.)
• Clean infographic style but cinematic

Bottom banner:
• Large bold yellow text with a dramatic phrase related to the title

Quality:
• Ultra detailed
• Professional YouTube thumbnail
• 16:9 aspect ratio
• High contrast
• Designed for maximum CTR
• Tech YouTube channel style

Important: Diagram should not be too complex, else it should be clean clear and scroll stopping

Tag: ${tags.slice(0, 3).join(", ")}
        `;


        return prompt;
    }

    /**
     * Get style-specific modifiers for the prompt
     */
    private getStyleModifiers(style: string): string {
        const styles: Record<string, string> = {
            vibrant: "vibrant colors, high contrast, energetic, bold design, neon accents, dynamic composition",
            minimal: "minimalist design, clean layout, muted colors, elegant, sophisticated, simple background",
            dramatic: "dramatic lighting, cinematic, dark moody atmosphere, high contrast, intense shadows",
            professional: "corporate style, business professional, clean design, trustworthy, polished look",
            fun: "playful, colorful, cheerful, whimsical, cartoon style, bright and happy",
        };

        return styles[style] || styles.minimal;
    }

    /**
     * Save the generated thumbnail to disk
     */
    private async saveThumbnail(
        videoId: string,
        imageBuffer: Buffer
    ): Promise<string> {
        // Create the output directory
        const outputDir = path.join("/tmp", "videos", videoId);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Determine file extension based on image type
        let extension = "png";
        if (imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8) {
            extension = "jpg";
        }

        // Save the thumbnail
        const thumbnailPath = path.join(outputDir, `thumbnail.${extension}`);
        fs.writeFileSync(thumbnailPath, imageBuffer);

        console.log(`💾 Saved thumbnail: ${thumbnailPath}`);
        console.log(`📊 File size: ${(imageBuffer.length / 1024).toFixed(2)} KB`);

        // Return relative path for API access
        return `${videoId}/thumbnail.${extension}`;
    }

    /**
     * Get list of available models
     */
    getAvailableModels(): string[] {
        return Object.values(HF_IMAGE_MODELS);
    }
}

export default HuggingFaceImageService;
