import { GoogleGenAI } from "@google/genai";

/**
 * Gemini AI Client (Singleton)
 * Manages Gemini API connections with key rotation support
 */
class GeminiClient {
    private static instance: GeminiClient;
    private genAI1: GoogleGenAI;
    private apiKey1: string;
    private genAI2: GoogleGenAI | null = null;
    private apiKey2: string | null = null;
    private lastUsedKey: number = 1;

    private constructor() {
        this.apiKey1 = process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY || "";
        this.apiKey2 = process.env.GEMINI_API_KEY_2 || null;

        if (!this.apiKey1) {
            throw new Error("GEMINI_API_KEY_1 or GEMINI_API_KEY is required");
        }

        this.genAI1 = new GoogleGenAI({
            apiKey: this.apiKey1,
            apiVersion: 'v1alpha'
        });

        if (this.apiKey2) {
            this.genAI2 = new GoogleGenAI({
                apiKey: this.apiKey2,
                apiVersion: 'v1alpha'
            });
        }
    }

    public static getInstance(): GeminiClient {
        if (!GeminiClient.instance) {
            GeminiClient.instance = new GeminiClient();
        }
        return GeminiClient.instance;
    }

    public getGenAI(): GoogleGenAI {
        if (this.genAI2) {
            // Round-robin between keys
            this.lastUsedKey = this.lastUsedKey === 1 ? 2 : 1;
            console.error(`Using Gemini API Key ${this.lastUsedKey}`);
            return this.lastUsedKey === 1 ? this.genAI1 : this.genAI2;
        }
        return this.genAI1;
    }
}

export default GeminiClient;
