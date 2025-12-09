import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

// Gemini client singleton
class GeminiClient {
    private static instance: GeminiClient;
    private genAI: GoogleGenerativeAI;
    private apiKey: string;

    private constructor() {
        this.apiKey = process.env.GEMINI_API_KEY || "";

        if (!this.apiKey) {
            throw new Error(
                "GEMINI_API_KEY is not set. Please add it to your .env.local file."
            );
        }

        this.genAI = new GoogleGenerativeAI(this.apiKey);
    }

    public static getInstance(): GeminiClient {
        if (!GeminiClient.instance) {
            GeminiClient.instance = new GeminiClient();
        }
        return GeminiClient.instance;
    }

    /**
     * Get a specific Gemini model
     * @param modelName - The name of the model (default: gemini-2.0-flash-exp)
     */
    public getModel(modelName: string = "gemini-2.5-flash"): GenerativeModel {
        return this.genAI.getGenerativeModel({ model: modelName });
    }

    /**
     * Get the Google Generative AI instance
     */
    public getGenAI(): GoogleGenerativeAI {
        return this.genAI;
    }
}

export default GeminiClient;
