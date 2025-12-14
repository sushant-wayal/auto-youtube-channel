import OpenAI from "openai";

// OpenAI TTS client singleton
class OpenAIClient {
    private static instance: OpenAIClient;
    private openai: OpenAI;
    private apiKey: string;

    private constructor() {
        this.apiKey = process.env.OPENAI_API_KEY || "";

        if (!this.apiKey) {
            throw new Error(
                "OPENAI_API_KEY is not set. Please add it to your .env.local file."
            );
        }

        this.openai = new OpenAI({
            apiKey: this.apiKey,
        });
    }

    public static getInstance(): OpenAIClient {
        if (!OpenAIClient.instance) {
            OpenAIClient.instance = new OpenAIClient();
        }
        return OpenAIClient.instance;
    }

    /**
     * Get the OpenAI instance
     */
    public getOpenAI(): OpenAI {
        return this.openai;
    }
}

export default OpenAIClient;
