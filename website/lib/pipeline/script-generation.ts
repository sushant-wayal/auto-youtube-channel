import { GeminiService } from "@/lib/ai";
import { VideoScript } from "./types";
import { promises as fs } from "fs";
import path from "path";

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
        return `
        You are a technical explainer AI.

        Create content for a ${duration}-minute YouTube video about:
        "${videoIdea}"

        Return ONLY valid JSON in the exact format below.
        This output feeds an automated video rendering pipeline.

        ========================
        REQUIRED OUTPUT FORMAT
        ========================

        {
        "title": "SEO-friendly title under 60 characters",
        "description": "2-3 sentence YouTube description",
        "tags": ["tag1", "tag2", "tag3"],

        "scenes": [
            {
            "id": "scene-1",
            "baseDuration": 6.0,
            "holdDuration": 2.0,
            "narration": "Full narration text for this scene.",-
            "actions": [
                {
                "t": 0.5,
                "op": "text",
                "x": 520,
                "y": 80,
                "value": "Binary Tree"
                }
            ]
            }
        ],

        "shorts": [
            {
            "id": "short-1",
            "hook": "Why do databases look like cylinders?",
            "narration": "Databases are drawn as cylinders because they represent stored data that persists over time.",
            "baseDuration": 15.0,
            "actions": [
                {
                "t": 0.5,
                "op": "text",
                "x": 360,
                "y": 200,
                "value": "Why databases look like this"
                }
            ]
            }
        ]
        }

        ========================
        CANVAS SIZE
        ========================
        - long-form video: 1280x720
        - shorts: 720x1280

        ========================
        SCENE RULES (MAIN VIDEO)
        ========================

        - Background color: #FAFAFA, so do not use whitish fills, or strokes
        - narration should be of appropriate length for baseDuration + holdDuration
        - It should not be case that scene is of 30 seconds but narration is only 5 seconds long
        - Instead aim that narration length roughly matches baseDuration + holdDuration
        - narration should be appropriately large i.e approx 130-150 words per scene for a ${duration} minute video
        - maximum 10 scenes in total
        - actions should complement the narration
        - scenes are VISUAL ONLY
        - baseDuration is a HARD STOP (no holds)
        - all action.t < baseDuration
        - scene should align with narration flow
        - min 15 seconds baseDuration per scene
        - actions should also be timed to scene completion, add number of actions accordingly, it should be case that a 30 second scene has only 3-4 action ending within 6-7 seconds
        - set the baseDuration and holdDuration to fit narration pacing, so that the scene and narration align well
        - set coordinates of drawing such that if text is contained in a box, text properly fits within the box

        ========================
        NARRATION RULES
        ========================

        - Conversational tone, like a YouTube explainer
        - Timed Pause,[PAUSE=1.5s],Inserts a silence of exactly 1.5 seconds.
        - Soft Pause,...,"Creates a natural, ""thinking"" hesitation."
        - Tone Shift,[excited],Changes the prosody and speed for the following text.
        - Do not use PAUSE for moments longer than 2 seconds.

        ========================
        SHORTS RULES (CRITICAL)
        ========================

        - 3–5 shorts maximum
        - Target length: 8–12 seconds (hard preference)
        - Shorts MUST pass Shorts feed entry test:
            - Visual motion at t ≤ 0.5s
            - On-screen text at t ≤ 0.8s
        - Shorts MUST start with a concrete system fact, not a metaphor
        - Metaphors, if any, come AFTER the fact
        - The start of narration must be strong to hook viewers quickly
        - Shorts must end with a strong visual “punchline”:
            - freeze frame
            - bold text
            - or contrast reveal
        - Shorts must feel replayable
        - Shorts must be understandable standalone
        - Shorts must clearly relate to the main video topic
        - Each short has:
            - its OWN narration
            - its OWN actions
        - Shorts reuse the SAME primitive rules as scenes

        ========================
        ALLOWED ACTION OPS
        ========================

        - "line" (x1, y1, x2, y2, optional stroke, optional strokeWidth, optional fill)
        - "rect" (x, y, w, h, optional r, optional stroke, optional strokeWidth, optional fill)
        - "ellipse" (cx, cy, rx, ry, optional stroke, optional strokeWidth, optional fill)
        - "path" (d, optional stroke, optional strokeWidth, optional fill)
        - "text" (x, y, value, optional fontSize, optional fill, optional align) // align: "left", "center", "right" ; default "center"
        - "group" (children)
        - "transform" (translate?[number, number], children)

        ========================
        STRICT RULES
        ========================

        - NO HTML
        - NO JavaScript
        - NO CSS
        - NO symbols (e.g. database, DNS)
        - Primitives ONLY
        - Try to create visually interesting scenes using only the allowed ops
        - Coordinates must fit 1280x720 for main video, 720x1280 for shorts
        - Max 50 actions per scene/short
        - Return ONLY raw JSON
        - No markdown, no explanations, no comments
        - Escape all quotes properly

        If the format is violated, the output will be rejected.
        `;
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

            // // Validate required fields
            // if (!parsed.narration || typeof parsed.narration !== 'string') {
            //     throw new Error("Missing or invalid 'narration' field");
            // }

            // if (parsed.narration.length < 300) {
            //     console.warn("⚠️ Narration is very short, might be truncated");
            // }

            const narration = parsed.scenes.map((scene: any) => scene.narration).join(" [PAUSE=8s] ");

            return {
                title: parsed.title || videoIdea,
                description: parsed.description || "",
                tags: Array.isArray(parsed.tags) ? parsed.tags : [],
                narration: this.preprocessNarration(narration),
                scenes: Array.isArray(parsed.scenes) ? parsed.scenes : [],
                shorts: Array.isArray(parsed.shorts) ? parsed.shorts.slice(0, 5) : [], // Max 5 shorts
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
     * Preprocess narration to clean up [PAUSE] markers and sanitize text
     * Replaces [PAUSE] with natural pauses and removes unwanted characters
     */
    private preprocessNarration(narration: string): string {
        // Step 1: Remove markdown formatting
        let processed = narration;
        processed = processed.replace(/\*\*([^*]+)\*\*/g, '$1'); // Bold
        processed = processed.replace(/\*([^*]+)\*/g, '$1'); // Italic
        processed = processed.replace(/__([^_]+)__/g, '$1'); // Underline
        processed = processed.replace(/_([^_]+)_/g, '$1'); // Underline alt

        // Step 2: Remove hashtags
        processed = processed.replace(/#\w+/g, '');

        // Step 3: Clean up multiple punctuation marks
        processed = processed.replace(/[!?]{2,}/g, '!'); // Multiple exclamation/question marks
        processed = processed.replace(/\.{2,}/g, '.'); // Multiple periods (except ellipsis)
        processed = processed.replace(/,\s*,+/g, ','); // Multiple commas

        // Step 4: Fix spacing around punctuation
        processed = processed.replace(/\s+([,.!?;:])/g, '$1'); // Remove space before punctuation
        processed = processed.replace(/([,.!?;:])\s*([,.!?;:])/g, '$1 '); // Fix multiple punctuation
        processed = processed.replace(/,\s*\./g, '.'); // Comma before period

        // Step 5: Clean up quotes
        processed = processed.replace(/[""](?=\s|$)/g, ''); // Remove standalone quotes
        processed = processed.replace(/[""]/g, '"'); // Normalize curly quotes

        // Step 6: Remove URLs
        processed = processed.replace(/https?:\/\/[^\s]+/g, '');

        // Step 7: Remove special characters that TTS might struggle with
        processed = processed.replace(/[<>{}|\\^~`]/g, '');

        // Step 8: Normalize whitespace
        processed = processed.replace(/\s+/g, ' '); // Multiple spaces to single
        processed = processed.replace(/\n\s*\n\s*\n+/g, '\n\n'); // Max 2 newlines
        processed = processed.trim();

        // Step 9: Ensure sentences end with proper punctuation
        processed = processed.replace(/([a-zA-Z0-9])\s*\n/g, '$1.\n');

        // Step 10: Remove any remaining control characters
        processed = processed.replace(/[\x00-\x1F\x7F]/g, '');

        return processed;
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
