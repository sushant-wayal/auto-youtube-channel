import { GoogleGenAI } from "@google/genai";

// Gemini client singleton
class GeminiClient {
    private static instance: GeminiClient;
    private genAI: GoogleGenAI;
    private apiKey: string;

    private constructor() {
        this.apiKey = process.env.GEMINI_API_KEY || "";

        if (!this.apiKey) {
            throw new Error(
                "GEMINI_API_KEY is not set. Please add it to your .env.local file."
            );
        }

        this.genAI = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
            // Force the client to use the Alpha API version
            apiVersion: 'v1alpha'
        });
    }

    public static getInstance(): GeminiClient {
        if (!GeminiClient.instance) {
            GeminiClient.instance = new GeminiClient();
        }
        return GeminiClient.instance;
    }

    /**
     * Get the Google GenAI instance
     */
    public getGenAI(): GoogleGenAI {
        return this.genAI;
    }

    /**
     * Get API key for direct API usage
     */
    public getApiKey(): string {
        return this.apiKey;
    }
}

export default GeminiClient;
