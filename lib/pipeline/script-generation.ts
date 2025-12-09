import { GeminiService } from "@/lib/ai";
import { VideoScript } from "./types";

class ScriptGenerationService {
    private gemini: GeminiService;

    constructor() {
        this.gemini = new GeminiService();
    }

    /**
     * Generate a complete YouTube video script from a video idea
     * @param videoIdea - The main concept/title for the video
     * @param duration - Target duration in minutes (5-10)
     */
    async generateScript(
        videoIdea: string,
        duration: number = 7
    ): Promise<VideoScript> {
        const prompt = this.buildScriptPrompt(videoIdea, duration);

        try {
            const response = await this.gemini.generateText(prompt, {
                temperature: 0.8,
                maxOutputTokens: 8192, // Increased from 4096 to handle longer responses
                topP: 0.95,
            });

            const script = this.parseScriptResponse(response, videoIdea);
            return script;
        } catch (error) {
            console.error("Error generating script:", error);
            throw new Error(`Failed to generate script: ${error}`);
        }
    }

    private buildScriptPrompt(videoIdea: string, duration: number): string {
        return `You are a YouTube script writer. Create a ${duration}-minute video script about: "${videoIdea}"

Return ONLY valid JSON in this exact format:

{
  "title": "SEO title (under 60 chars)",
  "description": "2-3 sentence description",
  "tags": ["keyword1", "keyword2", "keyword3"],
  "narration": "Full script text here. Use natural paragraphs. Add [PAUSE] for pauses. 800-1000 words.",
  "shorts": [
    {"hook": "Catchy question", "script": "15-20 second explanation"}
  ]
}

CRITICAL RULES:
- Return ONLY the JSON object, no markdown, no code blocks, no extra text
- Ensure narration is a single valid JSON string (escape quotes with \\")
- Keep narration under 1000 words to fit in response
- 2-3 shorts maximum
- NO scene descriptions, NO timecodes, NO visual instructions`;
    }

    private parseScriptResponse(response: string, videoIdea: string): VideoScript {
        try {
            let cleanResponse = response.trim();

            // Remove markdown code blocks
            cleanResponse = cleanResponse.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();

            // Log for debugging
            console.log("📝 Attempting to parse JSON, length:", cleanResponse.length);

            // Try to fix common JSON issues
            cleanResponse = this.fixCommonJsonIssues(cleanResponse);

            let parsed;
            try {
                parsed = JSON.parse(cleanResponse);
            } catch (parseError: any) {
                console.error("❌ Initial JSON parse failed:", parseError.message);

                // Try to extract position of error and fix
                const errorMatch = parseError.message.match(/position (\d+)/);
                if (errorMatch) {
                    const errorPos = parseInt(errorMatch[1]);
                    console.log(`🔍 Error at position ${errorPos}`);
                    console.log(`📝 Context: ...${cleanResponse.substring(Math.max(0, errorPos - 50), errorPos + 50)}...`);

                    // Try to fix by truncating at last valid closing brace before error
                    const beforeError = cleanResponse.substring(0, errorPos);
                    const lastValidClosing = Math.max(
                        beforeError.lastIndexOf('"}'),
                        beforeError.lastIndexOf('"]')
                    );

                    if (lastValidClosing > 0) {
                        console.log("🔧 Attempting to salvage JSON by truncating...");
                        // Try to properly close the JSON
                        let salvaged = cleanResponse.substring(0, lastValidClosing + 2);

                        // Check if we're inside an array or object
                        const openBraces = (salvaged.match(/{/g) || []).length;
                        const closeBraces = (salvaged.match(/}/g) || []).length;
                        const openBrackets = (salvaged.match(/\[/g) || []).length;
                        const closeBrackets = (salvaged.match(/\]/g) || []).length;

                        // Close any open arrays
                        for (let i = 0; i < openBrackets - closeBrackets; i++) {
                            salvaged += ']';
                        }

                        // Close any open objects
                        for (let i = 0; i < openBraces - closeBraces; i++) {
                            salvaged += '}';
                        }

                        console.log("🔧 Salvaged JSON length:", salvaged.length);
                        parsed = JSON.parse(salvaged);
                    } else {
                        throw parseError; // Can't salvage, re-throw
                    }
                } else {
                    throw parseError;
                }
            }

            // Validate required fields
            if (!parsed.narration || typeof parsed.narration !== 'string') {
                throw new Error("Missing or invalid 'narration' field");
            }

            if (parsed.narration.length < 300) {
                console.warn("⚠️ Narration is very short, might be truncated");
            }

            // Validation: Reject old format
            if (parsed.scenes || parsed.hook || parsed.outro || parsed.duration) {
                throw new Error("AI returned old format with scenes");
            }

            return {
                title: parsed.title || videoIdea,
                description: parsed.description || "",
                tags: Array.isArray(parsed.tags) ? parsed.tags : [],
                narration: parsed.narration,
                shorts: Array.isArray(parsed.shorts) ? parsed.shorts.slice(0, 3) : [], // Max 3 shorts
            };
        } catch (error) {
            console.error("❌ Error parsing script response:", error);
            console.error("📝 Response length:", response.length);
            console.error("📝 First 200 chars:", response.substring(0, 200));
            console.error("📝 Last 200 chars:", response.substring(Math.max(0, response.length - 200)));

            throw new Error(`Failed to parse generated script: ${error instanceof Error ? error.message : 'Invalid format'}`);
        }
    }

    /**
     * Fix common JSON formatting issues from LLM output
     */
    private fixCommonJsonIssues(json: string): string {
        let fixed = json;

        // Remove any text before the first {
        const firstBrace = fixed.indexOf('{');
        if (firstBrace > 0) {
            fixed = fixed.substring(firstBrace);
        }

        // Remove any text after the last }
        const lastBrace = fixed.lastIndexOf('}');
        if (lastBrace > 0 && lastBrace < fixed.length - 1) {
            fixed = fixed.substring(0, lastBrace + 1);
        }

        // Fix common escape issues in narration
        // Replace unescaped newlines in strings with spaces
        fixed = fixed.replace(/("\w+"\s*:\s*"[^"]*)\n([^"]*")/g, '$1 $2');

        // Fix trailing commas before closing braces/brackets
        fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

        return fixed;
    }

    async refineNarration(
        script: VideoScript,
        feedback: string
    ): Promise<string> {
        const prompt = `You are refining a YouTube video narration.

CURRENT SCRIPT:
Title: ${script.title}
Narration: ${script.narration}

FEEDBACK: ${feedback}

Generate an improved version of the narration that addresses the feedback while maintaining the conversational tone and structure. Keep it 800-1200 words.

Return only the improved narration text, no additional formatting.`;

        try {
            const response = await this.gemini.generateText(prompt, {
                temperature: 0.7,
                maxOutputTokens: 2048,
            });

            return response.trim();
        } catch (error) {
            console.error("Error refining narration:", error);
            throw new Error("Failed to refine narration");
        }
    }
}

export default ScriptGenerationService;
