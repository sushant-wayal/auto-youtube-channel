import GeminiClient from "./gemini-client";
import type { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";

export interface GeminiConfig {
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
}

class GeminiService {
    private client: GeminiClient;
    private genAI: GoogleGenAI;

    constructor() {
        this.client = GeminiClient.getInstance();
        this.genAI = this.client.getGenAI();
    }

    /**
     * Generate text content from a prompt
     * @param prompt - The input prompt
     * @param config - Optional configuration
     */
    async generateText(
        prompt: string,
        config?: GeminiConfig
    ): Promise<string> {
        try {
            const modelName = config?.model || "gemini-2.5-flash";
            const result = await this.genAI.models.generateContent({
                model: modelName,
                contents: prompt,
                config: {
                    temperature: config?.temperature,
                    maxOutputTokens: config?.maxOutputTokens,
                    topP: config?.topP,
                    topK: config?.topK,
                },
            });
            return result.text || "";
        } catch (error) {
            console.error("Error generating text:", error);
            throw new Error(`Failed to generate text: ${error}`);
        }
    }

    /**
     * Generate content with streaming response
     * @param prompt - The input prompt
     * @param config - Optional configuration
     */
    async *generateTextStream(
        prompt: string,
        config?: GeminiConfig
    ): AsyncGenerator<string, void, unknown> {
        try {
            const modelName = config?.model || "gemini-2.5-flash";
            const response = await this.genAI.models.generateContentStream({
                model: modelName,
                contents: prompt,
                config: {
                    temperature: config?.temperature,
                    maxOutputTokens: config?.maxOutputTokens,
                    topP: config?.topP,
                    topK: config?.topK,
                },
            });

            for await (const chunk of response) {
                const chunkText = chunk.text || "";
                if (chunkText) {
                    yield chunkText;
                }
            }
        } catch (error) {
            console.error("Error generating text stream:", error);
            throw new Error(`Failed to generate text stream: ${error}`);
        }
    }

    /**
     * Start a chat session
     * @param config - Optional configuration
     * @param history - Optional chat history
     */
    startChat(
        config?: GeminiConfig,
        history?: Array<{ role: string; parts: string }>
    ): Chat {
        const modelName = config?.model || "gemini-2.5-flash";
        return this.genAI.chats.create({
            model: modelName,
            history: history?.map((msg) => ({
                role: msg.role as "user" | "model",
                parts: [{ text: msg.parts }],
            })),
            config: {
                temperature: config?.temperature,
                maxOutputTokens: config?.maxOutputTokens,
                topP: config?.topP,
                topK: config?.topK,
            },
        });
    }

    /**
     * Generate content from text and images
     * @param prompt - The text prompt
     * @param images - Array of image data (base64 or buffer)
     * @param config - Optional configuration
     */
    async generateFromMultimodal(
        prompt: string,
        images: Array<{ mimeType: string; data: string }>,
        config?: GeminiConfig
    ): Promise<string> {
        try {
            const modelName = config?.model || "gemini-2.5-flash";

            const imageParts = images.map((img) => ({
                inlineData: {
                    mimeType: img.mimeType,
                    data: img.data,
                },
            }));

            const result = await this.genAI.models.generateContent({
                model: modelName,
                contents: [
                    {
                        role: "user",
                        parts: [{ text: prompt }, ...imageParts],
                    },
                ],
                config: {
                    temperature: config?.temperature,
                    maxOutputTokens: config?.maxOutputTokens,
                    topP: config?.topP,
                    topK: config?.topK,
                },
            });
            return result.text || "";
        } catch (error) {
            console.error("Error generating multimodal content:", error);
            throw new Error(`Failed to generate multimodal content: ${error}`);
        }
    }

    /**
     * Count tokens in a prompt
     * @param prompt - The input prompt
     * @param config - Optional configuration
     */
    async countTokens(
        prompt: string,
        config?: GeminiConfig
    ): Promise<number> {
        try {
            const modelName = config?.model || "gemini-2.5-flash";
            const result = await this.genAI.models.countTokens({
                model: modelName,
                contents: prompt,
            });
            return result.totalTokens || 0;
        } catch (error) {
            console.error("Error counting tokens:", error);
            throw new Error(`Failed to count tokens: ${error}`);
        }
    }
}

/**
 * Sanitize and clean generated script text
 * Removes unwanted formatting, special characters, and ensures proper structure
 */
export function sanitizeScript(script: string): string {
    let sanitized = script;

    // Remove markdown code blocks
    sanitized = sanitized.replace(/```[\w]*\n?/g, '');

    // Remove common AI response prefixes
    sanitized = sanitized.replace(/^(Here's|Here is|Script:|Narration:|Output:)\s*/gim, '');

    // Remove asterisks used for emphasis
    sanitized = sanitized.replace(/\*\*/g, '');
    sanitized = sanitized.replace(/\*/g, '');

    // Remove underscores used for emphasis
    sanitized = sanitized.replace(/__/g, '');
    sanitized = sanitized.replace(/_/g, '');

    // Remove square brackets with content (except [PAUSE])
    sanitized = sanitized.replace(/\[(?!PAUSE\])[^\]]*\]/g, '');

    // Remove parenthetical stage directions
    sanitized = sanitized.replace(/\([^)]*\)/g, '');

    // Remove HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');

    // Remove quotes at the start and end of the entire text
    sanitized = sanitized.replace(/^["']+|["']+$/g, '');

    // Remove multiple consecutive spaces
    sanitized = sanitized.replace(/ +/g, ' ');

    // Remove multiple consecutive newlines (keep max 2)
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

    // Trim whitespace from each line
    sanitized = sanitized.split('\n')
        .map(line => line.trim())
        .join('\n');

    // Remove leading/trailing whitespace
    sanitized = sanitized.trim();

    // Ensure proper sentence spacing
    sanitized = sanitized.replace(/([.!?])\s*([A-Z])/g, '$1 $2');

    // Fix common punctuation issues
    sanitized = sanitized.replace(/\s+([.,!?;:])/g, '$1');
    sanitized = sanitized.replace(/([.,!?;:])\s*$/gm, '$1');

    return sanitized;
}

export default GeminiService;
