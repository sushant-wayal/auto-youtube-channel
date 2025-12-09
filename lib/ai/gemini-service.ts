import GeminiClient from "./gemini-client";
import {
    GenerateContentResult,
    GenerativeModel,
} from "@google/generative-ai";

export interface GeminiConfig {
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
}

class GeminiService {
    private client: GeminiClient;

    constructor() {
        this.client = GeminiClient.getInstance();
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
            const model = this.getConfiguredModel(config);
            const result = await model.generateContent(prompt);
            const response = result.response;
            return response.text();
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
            const model = this.getConfiguredModel(config);
            const result = await model.generateContentStream(prompt);

            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                yield chunkText;
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
    ) {
        const model = this.getConfiguredModel(config);
        return model.startChat({
            history: history?.map((msg) => ({
                role: msg.role,
                parts: [{ text: msg.parts }],
            })),
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
            const model = this.getConfiguredModel(config);

            const imageParts = images.map((img) => ({
                inlineData: {
                    mimeType: img.mimeType,
                    data: img.data,
                },
            }));

            const result = await model.generateContent([prompt, ...imageParts]);
            const response = result.response;
            return response.text();
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
            const model = this.getConfiguredModel(config);
            const result = await model.countTokens(prompt);
            return result.totalTokens;
        } catch (error) {
            console.error("Error counting tokens:", error);
            throw new Error(`Failed to count tokens: ${error}`);
        }
    }

    /**
     * Get a configured model with generation settings
     */
    private getConfiguredModel(config?: GeminiConfig): GenerativeModel {
        const modelName = config?.model || "gemini-2.5-flash";
        const model = this.client.getModel(modelName);

        // If additional config is provided, we need to get a new model instance with config
        if (config?.temperature !== undefined ||
            config?.maxOutputTokens !== undefined ||
            config?.topP !== undefined ||
            config?.topK !== undefined) {
            return this.client.getGenAI().getGenerativeModel({
                model: modelName,
                generationConfig: {
                    temperature: config.temperature,
                    maxOutputTokens: config.maxOutputTokens,
                    topP: config.topP,
                    topK: config.topK,
                },
            });
        }

        return model;
    }
}

export default GeminiService;
