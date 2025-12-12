import { HfInference } from "@huggingface/inference";

// Hugging Face client singleton
class HuggingFaceClient {
    private static instance: HuggingFaceClient;
    private hf: HfInference;

    private constructor() {
        // Get API key from environment
        const apiKey = process.env.HUGGINGFACE_API_KEY;

        if (apiKey) {
            console.log("✅ Initializing Hugging Face with API token");
            this.hf = new HfInference(apiKey);
        } else {
            console.log("⚠️ No HUGGINGFACE_API_KEY found, using public endpoints");
            this.hf = new HfInference();
        }
    }

    public static getInstance(): HuggingFaceClient {
        if (!HuggingFaceClient.instance) {
            HuggingFaceClient.instance = new HuggingFaceClient();
        }
        return HuggingFaceClient.instance;
    }

    /**
     * Get the Hugging Face Inference instance
     */
    public getHF(): HfInference {
        return this.hf;
    }
}

export default HuggingFaceClient;
