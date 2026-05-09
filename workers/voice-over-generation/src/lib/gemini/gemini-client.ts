import { GoogleGenAI } from "@google/genai";

// Gemini client singleton
class GeminiClient {
    private static instance: GeminiClient;
    private genAI1: GoogleGenAI;
    private apiKey1: string;
    private genAI2: GoogleGenAI;
    private apiKey2: string;
    private lastUsedKey: number = 1;

    private constructor() {
        this.apiKey1 = process.env.GEMINI_API_KEY_1 || "";
        this.apiKey2 = process.env.GEMINI_API_KEY_2 || "";

        if (!this.apiKey1 || !this.apiKey2) {
            throw new Error(
                "GEMINI_API_KEY_1 or GEMINI_API_KEY_2 is not set. Please add them to your .env.local file."
            );
        }

        this.genAI1 = new GoogleGenAI({
            apiKey: this.apiKey1,
            // Force the client to use the Alpha API version
            apiVersion: 'v1alpha'
        });

        this.genAI2 = new GoogleGenAI({
            apiKey: this.apiKey2,
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
        // Simple round-robin between two API keys to distribute load
        this.lastUsedKey = this.lastUsedKey === 1 ? 2 : 1;
        console.error(`Using Gemini API Key ${this.lastUsedKey}`);
        if (this.lastUsedKey === 1) {
            return this.genAI1;
        } else {
            return this.genAI2;
        }
    }

    /**
     * Get API key for direct API usage
     */
    public getApiKey(): string {
        return this.lastUsedKey === 1 ? this.apiKey1 : this.apiKey2;
    }
}

export default GeminiClient;
