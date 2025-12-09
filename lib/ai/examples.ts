import GeminiService from "./gemini-service";

/**
 * Example usage of the Gemini Service
 * This file demonstrates various ways to use the Gemini API
 */

// Initialize the service
const geminiService = new GeminiService();

// Example 1: Simple text generation
export async function exampleSimpleTextGeneration() {
    const prompt = "Write a short YouTube video description about coding tutorials.";
    const response = await geminiService.generateText(prompt);
    console.log("Generated text:", response);
    return response;
}

// Example 2: Text generation with custom configuration
export async function exampleWithConfig() {
    const prompt = "Create 5 engaging YouTube video title ideas about web development.";
    const response = await geminiService.generateText(prompt, {
        temperature: 0.9, // Higher temperature for more creative responses
        maxOutputTokens: 1000,
        topP: 0.95,
    });
    console.log("Generated titles:", response);
    return response;
}

// Example 3: Streaming response (useful for real-time UI updates)
export async function exampleStreamingResponse() {
    const prompt = "Write a detailed script for a 5-minute YouTube video about Next.js.";

    console.log("Streaming response:");
    let fullResponse = "";

    for await (const chunk of geminiService.generateTextStream(prompt)) {
        fullResponse += chunk;
        process.stdout.write(chunk); // Print chunks as they arrive
    }

    return fullResponse;
}

// Example 4: Chat conversation
export async function exampleChatSession() {
    const chat = geminiService.startChat({
        temperature: 0.7,
    });

    // First message
    const result1 = await chat.sendMessage("What makes a good YouTube thumbnail?");
    console.log("AI:", result1.response.text());

    // Follow-up message (context is maintained)
    const result2 = await chat.sendMessage("Can you give me 3 specific examples?");
    console.log("AI:", result2.response.text());

    return result2.response.text();
}

// Example 5: Chat with history
export async function exampleChatWithHistory() {
    const chat = geminiService.startChat(
        { temperature: 0.7 },
        [
            { role: "user", parts: "I'm creating a YouTube channel about cooking." },
            { role: "model", parts: "That's great! Cooking channels are very popular on YouTube. What type of cuisine are you focusing on?" },
        ]
    );

    const result = await chat.sendMessage("I want to focus on Italian cuisine. What should my first video be about?");
    console.log("AI:", result.response.text());
    return result.response.text();
}

// Example 6: Multimodal (text + image)
export async function exampleMultimodal(imageBase64: string) {
    const prompt = "Analyze this image and suggest a YouTube video idea based on it.";

    const response = await geminiService.generateFromMultimodal(
        prompt,
        [
            {
                mimeType: "image/jpeg",
                data: imageBase64,
            },
        ]
    );

    console.log("Analysis:", response);
    return response;
}

// Example 7: Token counting (useful for cost estimation)
export async function exampleTokenCounting() {
    const prompt = "Write a comprehensive guide about YouTube SEO and optimization strategies.";
    const tokenCount = await geminiService.countTokens(prompt);
    console.log(`Prompt uses ${tokenCount} tokens`);
    return tokenCount;
}

// Example 8: Using different models
export async function exampleDifferentModel() {
    // Using a different Gemini model
    const response = await geminiService.generateText(
        "Generate 10 YouTube video tags for a video about React hooks.",
        {
            model: "gemini-1.5-flash", // or "gemini-1.5-pro"
            temperature: 0.8,
        }
    );
    console.log("Tags:", response);
    return response;
}
