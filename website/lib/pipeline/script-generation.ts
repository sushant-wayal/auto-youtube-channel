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
        return `You are a technical explainer AI creating professional, calm, educational video content.

Create content for a ${duration}-minute YouTube video about:
"${videoIdea}"

Return ONLY valid JSON in the exact format below.
This output feeds an automated video rendering pipeline.

========================
DESIGN PHILOSOPHY
========================

The visual style is PROFESSIONAL EXPLAINER - think Stripe, Linear, Notion docs.
- Calm, clean, intentional
- Layout-first thinking (margins, hierarchy, breathing room)
- Minimal color palette (warm neutrals with indigo accent)
- Slow, predictable animations (fade in, subtle scale, gentle slide)
- NO flashy effects, NO particles, NO glows

========================
THEME COLORS (Built-in)
========================

The renderer automatically applies this palette - you usually don't need to specify colors:
- Background: warm white (#FAFAF9)
- Surface/boxes: stone (#F5F5F4) with subtle border
- Text primary: zinc-900 (#18181B)
- Text secondary: zinc-600 (#52525B)
- Text muted: zinc-400 (#A1A1AA)
- Accent: indigo (#6366F1) - use sparingly for emphasis
- Accent soft: indigo-100 (#E0E7FF) - for highlighted boxes
- Warning: amber (#F59E0B) - for callouts/constraints
- Warning soft: amber-100 (#FEF3C7) - for warning boxes
- Connectors: zinc-400 (#A1A1AA)

IMPORTANT: Omit fill/stroke to use smart defaults. Only specify colors for:
- Accent boxes (fill: "#E0E7FF", stroke: "#A5B4FC")
- Warning boxes (fill: "#FEF3C7", stroke: "#F59E0B")
- Emphasized text (fill: "#6366F1")

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
      "sceneTitle": "Brief descriptive title for this section (3-7 words)",
      "baseDuration": 20.0,
      "holdDuration": 2.0,
      "narration": "Full narration text for this scene, matching the duration.",
      "actions": [
        { "t": 0.5, "op": "text", "x": 640, "y": 80, "value": "Scene Title", "size": "title" },
        { "t": 1.0, "op": "text", "x": 640, "y": 130, "value": "Subtitle or context", "size": "subtitle" },
        { "t": 2.0, "op": "rect", "x": 200, "y": 250, "w": 280, "h": 140, "r": 16 },
        { "t": 2.5, "op": "text", "x": 340, "y": 300, "value": "Component A", "size": "body" },
        { "t": 3.0, "op": "line", "x1": 490, "y1": 320, "x2": 590, "y2": 320, "arrow": true }
      ]
    }
  ],

  "shorts": [
    {
      "id": "short-1",
      "hook": "Why do databases look like cylinders?",
      "hookText": "Everyone draws databases wrong.",
      "narration": "Databases are drawn as cylinders because they represent stored data.",
      "baseDuration": 12.0,
      "actions": [
        { "t": 0.3, "op": "rect", "x": 260, "y": 400, "w": 200, "h": 120, "r": 12 },
        { "t": 0.5, "op": "text", "x": 360, "y": 200, "value": "The Answer", "size": "title" }
      ]
    }
  ]
}

========================
CANVAS SIZE
========================
- Long-form: 1280x720 (center content around x=640)
- Shorts: 720x1280 (center content around x=360, more vertical space)

========================
TEXT SIZE SYSTEM
========================

Use the "size" property instead of "fontSize" for responsive scaling:
- "title": Main headings (auto-scaled: 48px long-form, 56px shorts)
- "subtitle": Secondary headings (32px / 36px)
- "body": Box labels, descriptions (22px / 26px)
- "label": Small annotations, notes (16px / 18px)

The renderer automatically adjusts sizes for shorts vs long-form.
Only use explicit fontSize if you need a specific pixel size.

========================
SCENE RULES (MAIN VIDEO)
========================

- max 10 scenes, min 15 seconds baseDuration per scene
- each scene MUST have a "sceneTitle" field: short descriptive title (3-7 words)
- sceneTitle should capture the key concept/topic of that scene section
- sceneTitle will be used for YouTube chapter timestamps
- narration ~130-150 words per scene for ${duration} min video
- narration length should match baseDuration + holdDuration
- all action.t < baseDuration
- actions should be evenly distributed across the duration
- leave visual breathing room (margins of ~100px from edges)
- position text INSIDE or BELOW boxes, not overlapping edges

========================
LAYOUT PRINCIPLES
========================

- Horizontal flow: left-to-right for processes/steps
- Vertical hierarchy: title at top, content in middle, notes at bottom
- Consistent spacing: ~40-60px gaps between elements
- Boxes should be 200-300px wide, 100-160px tall
- Keep text centered within boxes (text x = box x + box w/2)
- Use r: 12-20 for rounded corners (modern look)

========================
CONNECTOR RULES
========================

Lines automatically curve with playful variants. Control with:
- arrow: true - adds arrowhead at endpoint
- dashed: true - makes line dashed (for optional/async flows)
- curve: 0-3 - explicit curve type (0=arc up, 1=arc down, 2=S-curve, 3=wave)

If curve is omitted, a consistent random curve is auto-selected per line.
Connectors default to zinc-400 color - usually no need to specify stroke.

========================
NARRATION RULES
========================

- Conversational YouTube explainer tone
- [PAUSE=1.5s] - timed silence (max 2 seconds)
- ... - natural thinking hesitation
- [excited] - prosody/tone shift

========================
SHORTS RULES (CRITICAL)
========================

- 3-5 shorts maximum, 8-12 seconds each
- Shorts entry test: visual motion at t <= 0.5s, text at t <= 0.8s
- Start with concrete fact, not metaphor
- Strong hook in first sentence of narration
- End with visual punchline (bold text, freeze, contrast)
- Must be replayable and standalone

**SHORTS VISUAL HOOK (NEW):**
- Each short MUST have a "hookText" field (separate from hook and narration)
- hookText: 1-2 short declarative sentences that create visual tension
- hookText should:
  - Assert or imply something is wrong/unexpected
  - NOT explain the reason yet (that's for narration)
  - Be bold and direct, not a question
  - Avoid "what/why/how" openings
  - Avoid metaphors
- Examples of good hookText:
  - "This system is lying."
  - "This looks correct. It isn't."
  - "This works. Until it doesn't."
  - "Everyone does this wrong."
- hookText appears visually BEFORE narration starts

========================
ALLOWED ACTION OPS
========================

"line": { t, op: "line", x1, y1, x2, y2 }
  - Optional: stroke, strokeWidth, dashed, arrow, curve (0-3)
  - Curves automatically applied if curve omitted

"rect": { t, op: "rect", x, y, w, h }
  - Optional: r (corner radius, default 12), stroke, strokeWidth, fill
  - Defaults to theme.surface with subtle border
  - For accent: fill: "#E0E7FF", stroke: "#A5B4FC"
  - For warning: fill: "#FEF3C7", stroke: "#F59E0B"

"ellipse": { t, op: "ellipse", cx, cy, rx, ry }
  - Optional: stroke, strokeWidth, fill
  - Same fill defaults as rect

"path": { t, op: "path", d }
  - SVG path string for complex shapes
  - Optional: stroke, strokeWidth, fill, dashed

"text": { t, op: "text", x, y, value }
  - Optional: size ("title"|"subtitle"|"body"|"label"), fontSize, fontWeight, fill, align
  - Defaults: size="body", align="center", fill=theme.textPrimary
  - For emphasis: fill: "#6366F1" (accent)
  - For secondary: fill: "#52525B" (textSecondary)

"group": { t, op: "group", children: [...] }
  - Groups multiple actions

"transform": { t, op: "transform", translate: [dx, dy], children: [...] }
  - Transforms children by offset

========================
STRICT RULES
========================

- NO HTML, JavaScript, or CSS
- Primitives ONLY (rect, ellipse, line, text, path, group, transform)
- Max 50 actions per scene/short
- Return ONLY raw JSON - no markdown, no comments
- Escape quotes properly
- Coordinates must fit canvas (1280x720 or 720x1280)

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
