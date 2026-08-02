import { GeminiService } from "@/lib/ai";
import { VideoScript } from "./types";
import { promises as fs } from "fs";
import path from "path";
import { SeriesContext, buildSeriesContextPrompt } from "./series-context";
import { formatYouTubeTitle } from "@/lib/title-formatter";

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
    duration: number = 7,
    sceneRenderMethod?: "code" | "ai",
    seriesContext?: SeriesContext
  ): Promise<VideoScript> {
    const renderMethod = sceneRenderMethod ?? this.getSceneRenderMethod();
    const prompt = this.buildScriptPrompt(videoIdea, duration, renderMethod, seriesContext);

    try {
      const response = await this.gemini.generateText(prompt, {
        temperature: 0.8,
        topP: 0.95,
      });

      const script = this.parseScriptResponse(response, videoIdea, renderMethod);
      return script;
    } catch (error) {
      console.error("Error generating script:", error);
      throw new Error(`Failed to generate script: ${error}`);
    }
  }

  private getSceneRenderMethod(): "code" | "ai" {
    return process.env.SCENE_RENDER_METHOD === "ai" ? "ai" : "code";
  }

  private buildScriptPrompt(videoIdea: string, duration: number, renderMethod: "code" | "ai", seriesContext?: SeriesContext): string {
    const aiRenderOverride = renderMethod === "ai"
      ? `
========================
SCENE_RENDER_METHOD=ai OVERRIDE
========================

The scene renderer will generate final HTML from each scene narration separately.

For every long-form scene:
- Still write high-quality narration.
- Keep sceneTitle/baseDuration/holdDuration/id exactly as requested.
- Set "actions" to an empty array: [].
- Do NOT spend tokens creating visual actions.
- Ignore all action-count requirements below; they apply only when SCENE_RENDER_METHOD=code.

For YouTube Shorts when SCENE_RENDER_METHOD=ai:
- Do NOT generate a silent hook scene (id: "hook") followed by a content scene.
  NOTE: This refers to removing the HOOK SCENE object inside the "scenes" array — do NOT confuse this with the "hook" field on the short object.
  The "hook" field on each short (e.g., "Why databases round-trip on every read?") is the YouTube video TITLE and MUST always be present.
- Instead, each short MUST contain only a SINGLE scene in the "scenes" array (e.g., exactly 1 scene total per short).
- This single scene should have:
  - "id": "content"
  - "baseDuration": 10.0 to 15.0 (the total duration for the entire short)
  - "holdDuration": 0.5
  - "narration": The full narration explaining the concept (do not make the narration empty)
  - "actions": []
- Ignore all hook scene requirements and content scene rules below; they apply only when SCENE_RENDER_METHOD=code.
`
      : "";

    return `You are a technical storyteller AI creating curiosity-driven, tension-led, technically accurate video content for developers and engineers.

Create content for a ${duration}-minute YouTube video about:
"${videoIdea}"

Return ONLY valid JSON in the exact format below.
This output feeds an automated video rendering pipeline.
${aiRenderOverride}
${buildSeriesContextPrompt(seriesContext)}

========================
DESIGN PHILOSOPHY
========================

The visual style is PROFESSIONAL STORYTELLING - think Stripe, Linear, Notion docs, but structured around discovery.
- Curious, clean, intentional
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
  "title": "Compelling, high-CTR YouTube title (STRICTLY <= 100 characters, recommended 50-70 chars for mobile)",
  "description": "2-3 sentence YouTube description",
  "tags": ["tag1", "tag2", "tag3"],

  "scenes": [
    {
      "id": "scene-1",
      "sceneTitle": "Brief descriptive title for this section (3-7 words)",
      "sceneTheme": "light",
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
      "hook": "Why databases round-trip on every read?",
      "instagramCaption": "Your cache hit rate can quietly multiply database load.\\n\\nUnderstanding this one concept can save your production database from buckling under pressure.\\n\\nSave this before tuning your next production cache.\\n\\n#SoftwareEngineering #Databases #Caching",
      "scenes": [
        {
          "id": "hook",
          "sceneTheme": "dark",
          "baseDuration": 1.2,
          "holdDuration": 0.0,
          "narration": "",
          "actions": [
            { "t": 0.0, "op": "rect", "x": 260, "y": 300, "w": 200, "h": 100, "fill": "#E0E7FF", "r": 12 },
            { "t": 0.0, "op": "text", "x": 360, "y": 340, "value": "CACHE", "size": "body" },
            { "t": 0.1, "op": "ellipse", "cx": 360, "cy": 150, "rx": 20, "ry": 20, "fill": "#F59E0B" },
            { "t": 0.1, "op": "transform", "targetId": "request", "duration": 0.3, "cy": 250, "ease": "easeInQuad" },
            { "t": 0.45, "op": "line", "x1": 360, "y1": 400, "x2": 360, "y2": 500, "arrow": true, "stroke": "#EF4444", "strokeWidth": 3 },
            { "t": 0.5, "op": "rect", "x": 260, "y": 550, "w": 200, "h": 120, "stroke": "#3B82F6", "strokeWidth": 3 },
            { "t": 0.5, "op": "text", "x": 360, "y": 600, "value": "DATABASE", "size": "body" },
            { "t": 0.35, "op": "text", "x": 360, "y": 850, "value": "YOUR CACHE MISS COSTS", "size": "title", "fontWeight": "bold" }
          ]
        },
        {
          "id": "content",
          "sceneTheme": "dark",
          "baseDuration": 10.0,
          "holdDuration": 0.5,
          "narration": "Cache misses force expensive database round-trips. Every miss adds latency and load. That's why cache hit rates matter so much.",
          "actions": [
            { "t": 0.3, "op": "rect", "x": 160, "y": 400, "w": 400, "h": 300, "fill": "#F5F5F4", "r": 12 },
            { "t": 0.5, "op": "text", "x": 360, "y": 200, "value": "Cache Hit Rate", "size": "title" },
            { "t": 1.0, "op": "text", "x": 360, "y": 500, "value": "99%", "size": "title", "fill": "#10B981" },
            { "t": 1.5, "op": "text", "x": 360, "y": 600, "value": "vs", "size": "body" },
            { "t": 2.0, "op": "text", "x": 360, "y": 700, "value": "90%", "size": "title", "fill": "#EF4444" }
          ]
        }
      ]
    }
  ]
}

========================
CANVAS SIZE
========================
- Long-form: 1920x1080 (center content around x=960)
- Shorts: 1080x1920 (center content around x=540, more vertical space)

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
- each scene MUST contain at least 4 actions and at most 35 actions
- each scene MUST include at least 1 non-text shape (rect/ellipse/path/line)
- each scene MUST include at least 1 connector or spatial relationship cue (line/path)
- avoid text-only scenes except intro/outro emphasis moments
- each scene MUST have a "sceneTitle" field: short descriptive title (3-7 words)
- sceneTitle should capture the key concept/topic of that scene section
- sceneTitle will be used for YouTube chapter timestamps
- narration ~130-150 words per scene for ${duration} min video
- calculate duration according to the narration considering avg narration speed as 2.6 words/sec (baseDuration = narration word count / 2.6)
- narration length should match baseDuration + holdDuration
- The long-form video MUST follow this story-first structure:
  1. Unexpected Problem
  2. Why Common Intuition Fails
  3. Hidden Mechanism
  4. Real-World Consequence
  5. Resolution / Takeaway
- Start with tension, not definitions, historical background, or textbook explanations
- The intro must create an unanswered question that is not resolved immediately
- Delay key reveals so the viewer feels discovery unfolding over time
- Every 30-45 seconds, introduce at least one surprise, contradiction, question, consequence, or reveal
- all action.t < baseDuration
- actions should be evenly distributed across the duration
- leave visual breathing room (margins of ~100px from edges)
- position text INSIDE or BELOW boxes, not overlapping edges

VISUAL DENSITY DISTRIBUTION (MANDATORY):
- At least 1 sparse scene: 4-8 actions, high whitespace, one key message
- At least 1 medium scene: 9-16 actions, standard explainer layout
- At least 1 dense scene: 17-30 actions, comparison or multi-step system view
- Do not keep all scenes at the same complexity level

========================
LAYOUT PRINCIPLES
========================

- Horizontal flow: left-to-right for processes/steps
- Vertical hierarchy: title at top, content in middle, notes at bottom
- Consistent spacing: ~40-60px gaps between elements
- Boxes should be 200-300px wide, 100-160px tall
- Keep text centered within boxes (text x = box x + box w/2)
- Use r: 12-20 for rounded corners (modern look)

SCENE THEME VARIATION (OPTIONAL BUT RECOMMENDED):
- sceneTheme can be "light", "dark", or omitted (auto)
- Use "dark" for deep-dive technical scenes (code internals, low-level architecture, debugging)
- Use "light" for overview, summary, or conceptual framing scenes
- Avoid setting the same theme for every scene

LAYOUT VARIETY REQUIREMENTS (MANDATORY):
- Across the full video, include at least one scene for each pattern:
  1) Left-to-right process flow (3+ connected nodes)
  2) Two-column comparison (before/after or good/bad)
  3) Single focal callout card with supporting annotation
- Use clear alignment grids; avoid random floating placement
- Keep safe area: 8% inset from all edges for primary text and key nodes
- Accent usage rule: highlight exactly one primary concept per scene with accent color

TEXT HIERARCHY RULES (MANDATORY):
- Every scene should start with a visible heading or anchor label by t <= 1.2s
- Use title/subtitle/body/label tiers intentionally; avoid using only one text size
- No paragraph blocks longer than 10 words per text action; split into chunks
- If two text actions overlap in time, keep at least 28px vertical separation

ANIMATION STAGING RULES (MANDATORY):
- Do not drop all elements at t=0; stagger entries by 0.25-0.60s
- Reveal order should be: structure first, labels second, emphasis third
- At least one scene must include a 3-step causal chain with distinct timings
- Keep animation semantic: movement must explain relationships, not decorate
- Reserve typewriter-style reveals for key takeaway lines only

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

- Conversational YouTube storyteller tone for engineers
- Keep technical accuracy, but favor curiosity, tension, and narrative progression over calm explanation
- Never open with a definition, historical background, or textbook-style summary
- Use open loops in the intro and delay the answer until the script has established the problem
- [PAUSE=1.5s] - timed silence (max 2 seconds)
- ... - natural thinking hesitation
- [excited] - prosody/tone shift

========================
SHORTS RULES (CRITICAL)
========================

- 3-5 shorts maximum
- Every short MUST include an "instagramCaption" string written specifically for publishing the corresponding video as an Instagram Reel.
- The caption must be 3-4 paragraphs long, each containing 1-4 sentences. Use standard JSON newlines (\\n\\n) to separate paragraphs.
- The caption must accurately match that short's hook and narration, open with a compelling human-readable line, add useful context or a natural call to action, and be ready to paste without editing.
- Do not use markdown, labels such as "Caption:", fake quotations, or engagement bait.
- The hashtags MUST be placed in their own final paragraph at the very end (making the total 4-5 paragraphs including the hashtag paragraph).
- Use NO MORE THAN 5 hashtags in that last paragraph. Prefer 3-5 highly relevant hashtags over generic tags.
- Never include #fyp, #viral, #explorepage, or unrelated trending hashtags.
- Each short is divided into TWO phases:
  1. HOOK SCENE (0.8-1.5 seconds): Silent visual-only scroll-stopper
  2. CONTENT SCENE (8-12 seconds): Narrated explanation with visuals

========================
HOOK SCENE REQUIREMENTS (CRITICAL)
========================

The FIRST scene in EVERY short MUST be a HOOK SCENE with these EXACT properties:

{
  "id": "hook",
  "baseDuration": 1.2,    // Between 0.8-1.5 seconds ONLY (prefer 1.0-1.5s)
  "holdDuration": 0.0,    // MUST be 0.0
  "narration": "",        // MUST be EMPTY string
  "actions": [...]        // Visual animation actions ONLY
}

HOOK SCENE ANIMATION RULES (MANDATORY):
1. First action at t ≤ 0.1s (instant motion to grab attention)
2. Visible change by t ≤ 0.2s (immediate visual impact)
3. Hook text appears by t ≤ 0.3s (as text action in actions array)
4. Total duration 0.8-1.5s MAXIMUM (never exceed 1.5s)
5. ≤ 8 actions total (ultra-simple and digestible)
6. Strong visual contrast at final frame

SINGLE-MOTION CLARITY RULE (CRITICAL):
- Show EXACTLY ONE object/element as the focus
- Show EXACTLY ONE motion/transformation
- Show EXACTLY ONE clear consequence/result
- Pattern: [object appears] → [motion/change] → [consequence]
- Example: queue → fills up → turns red + "FULL"
- Example: request → misses cache → falls to database
- Example: token bucket → depletes → blocks request
- NO multiple diagrams competing for attention
- NO complex multi-step sequences
- NO abstract metaphors that require interpretation

PACING GUIDELINES (CRITICAL):
- Ultra-fast YES, but crystal clear
- Space actions with 0.15-0.25s gaps minimum
- Show cause → effect → result in simple progression
- Maximum 2-3 visual elements total (including text)
- Viewer must grasp the tension in <1 second
- Scroll-worthy = immediate understanding + emotional hook
- If viewer needs to replay to understand, it's TOO COMPLEX
- Clarity and speed trump sophistication

HOOK SCENE VISUAL CONTENT:

**CRITICAL: The visual hook MUST be directly related to the video topic.**

The examples below are INSPIRATION ONLY - do NOT blindly copy them.
CREATE a topic-specific mechanical behavior that represents YOUR specific concept.

Example system behaviors (adapt to your topic):
  * Request missing cache → falling to database (for caching topics)
  * Single write → splitting into retries (for retry logic topics)
  * Memory container → filling to overflow (for memory/buffer topics)
  * Two values → diverging then converging (for consistency topics)
  * Queue → growing rapidly (for queue/backpressure topics)
  * Disk write → delayed persistence (for durability topics)
  * Token bucket → depleting on requests (for rate limiting topics)
  * Rate limiter → blocking excess requests (for API throttling topics)
  * Circuit breaker → opening under load (for resilience topics)
  * Network packet → timing out (for network/latency topics)
  * Lock → blocking concurrent access (for concurrency topics)

The hook animation must:
- Represent the ACTUAL system behavior from YOUR video topic
- Be immediately recognizable as related to the concept
- Show cause-and-effect of the specific technical problem/pattern
- NOT be randomly chosen - must connect to the video content

- Use ONLY primitives: line, rect, ellipse, path, text, transform
- NO cinematic effects (zoom, pulse, glow, shake)
- NO particles, logos, symbols, metaphors
- NO generic animations that could apply to any topic
- Everything must be concrete, mechanical, and topic-specific

FORBIDDEN IN HOOK SCENE (NEVER DO THESE):
- Generic text zoom-in
- Abstract particles/sparkles
- Pulsing/glowing effects
- Decorative motion without meaning
- Symbolic representations
- Metaphorical animations
- Multiple objects moving simultaneously
- Scene transitions or multi-part sequences
- Slow cinematic build-up
- Complex diagrams with many components
- Anything requiring >1 second to comprehend
- Narration or audio cues (hook must work silently)

**HOOK TEXT REQUIREMENTS (MANDATORY):**
- Hook scene MUST include a text action that displays attention-grabbing text
- Text MUST start with "YOU" or "YOUR" (direct address to viewer - non-negotiable)
- Text MUST be ≤ 4 words maximum (brevity = impact)
- Text must directly address the viewer in second-person POV
- Text MUST include a concrete technical noun from the video topic
- Text MUST relate to the SAME system behavior shown in hook animation
- Text should:
  - Be specific to the technical concept being explained
  - Include the actual subject matter (e.g., database, clock, cache, API, server, token, React, CSS)
  - Make a direct claim about that technical element
  - Create immediate tension or realization
  - NO vague phrases allowed
  - NO generic statements like "YOU ARE DOING THIS WRONG", "YOU SHOULD STOP", "THIS IS BAD"
  - NO abstract or filler words like "this", "that", "thing"
  - NO questions - use direct assertions only
  - NO metaphors or indirect language

- Examples of CORRECT hook text (4 words max, specific + technical noun):
  - "YOUR DATABASE LIED" (3 words - data consistency)
  - "YOUR CLOCK DRIFTED" (3 words - distributed time sync)
  - "YOUR CACHE STALE" (3 words - caching invalidation)
  - "YOUR API LEAKED" (3 words - API security)
  - "YOU LOST DATA" (3 words - data loss)
  - "YOUR REQUEST BLOCKED" (3 words - rate limiting)
  - "YOUR TOKENS EXPIRED" (3 words - auth security)
  - "YOUR QUEUE FULL" (3 words - backpressure)

- Examples of INCORRECT hook text (DO NOT USE):
  - "YOU'RE DOING THIS WRONG" (too vague, no technical noun)
  - "YOU SHOULD STOP THIS" (too generic, no specificity)
  - "THIS IS BAD" (not POV, no technical noun)
  - "YOUR CODE IS BROKEN" (too generic, "code" is not specific enough)
  - "This system is broken" (not POV, not starting with YOU/YOUR)
  - "Everyone makes this mistake" (third-person)

- Hook text appears as a text action in the actions array by t ≤ 0.4s (large, centered, readable)

========================
CONTENT SCENE (SECOND SCENE IN SHORTS)
========================

After the hook scene, the SECOND scene is the content scene:

{
  "id": "content",
  "baseDuration": 10.0,   // 8-12 seconds
  "holdDuration": 0.5,
  "narration": "Full narration explaining the concept...",
  "actions": [...]        // Supporting visuals
}

CONTENT SCENE RULES:
- Narration starts here (NOT in hook scene)
- Visual motion at t ≤ 0.5s
- Text at t ≤ 0.8s
- Strong hook in first sentence of narration
- End with visual punchline (bold text, freeze, contrast)
- Must be standalone and replayable

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

"codeBlock": { t, op: "codeBlock", x, y, w, h, lines, language }
  - lines is an array of code lines, e.g. ["const cache = new Map()", "return cache.get(key)"]
  - language is REQUIRED - use "javascript", "typescript", "python", "java", "go", "rust", "cpp", "c", "php", "ruby", or "sql"
  - Optional: theme ("light"|"dark"), fontSize, showLineNumbers, highlightLine, cursor
  - Use for technical/code explanation scenes, not decorative filler

"progressBar": { t, op: "progressBar", x, y, w, h, value }
  - Optional: max (default 100), label, fill, trackFill, stroke, strokeWidth, r
  - Use to show percentages, utilization, completion, queue growth

"badge": { t, op: "badge", x, y, value }
  - Optional: style ("neutral"|"accent"|"warning"|"success"|"danger"), icon, fontSize
  - Use for labels/tags/status chips like "CACHE HIT", "P95", "CRITICAL"

"icon": { t, op: "icon", x, y, name }
  - Optional: size, stroke, strokeWidth, fill
  - Supported names: check, cross, warning, info, arrowRight, arrowLeft, arrowUp, arrowDown, plus, minus, clock, database, server, cpu, lock, unlock, cloud, bug, chartUp, chartDown

"table": { t, op: "table", x, y, w, h, headers, rows }
  - headers: ["Metric", "Before", "After"]
  - rows: [["Latency", "180ms", "42ms"], ["Error Rate", "2.1%", "0.2%"]]
  - Optional: striped, headerFill, gridStroke, textColor, fontSize, align
  - Use for explicit comparisons and benchmark scenes

"numberCounter": { t, op: "numberCounter", x, y, from, to }
  - Optional: prefix, suffix, decimals, size/fontSize, fontWeight, fill, align
  - Use for KPI or cost counters, e.g. from 0 to 99 with suffix "%"

"highlight": { t, op: "highlight", x, y, w, h }
  - Optional: style ("underline"|"box"), fill, opacity, r
  - Use to emphasize critical terms or key result regions

"group": { t, op: "group", children: [...] }
  - Groups multiple actions

"transform": { t, op: "transform", translate: [dx, dy], children: [...] }
  - Transforms children by offset

========================
STRICT RULES
========================

- NO HTML, JavaScript, or CSS
- Primitives ONLY (rect, ellipse, line, text, path, codeBlock, progressBar, badge, icon, table, numberCounter, highlight, group, transform)
- Max 50 actions per scene/short
- Do not reuse identical layouts across consecutive scenes
- At least 70% of scenes must include both text and non-text primitives
- Return ONLY raw JSON - no markdown, no comments
- Escape quotes properly
- Coordinates must fit canvas (1920x1080 or 1080x1920)

If the format is violated, the output will be rejected.
`;
  }

  private parseScriptResponse(response: string, videoIdea: string, renderMethod: "code" | "ai" = "code"): VideoScript {
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

      const script = {
        title: formatYouTubeTitle(parsed.title || videoIdea, 100),
        description: parsed.description || "",
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        narration: this.preprocessNarration(narration),
        scenes: Array.isArray(parsed.scenes) ? parsed.scenes : [],
        shorts: Array.isArray(parsed.shorts)
          ? parsed.shorts.slice(0, 5).map((short: any) => ({
              ...short,
              hook: short.hook ? formatYouTubeTitle(short.hook, 100) : short.hook,
              instagramCaption: this.normalizeInstagramCaption(short.instagramCaption),
            }))
          : [], // Max 5 shorts
      };

      return renderMethod === "ai" ? this.stripVisualActions(script) : script;
    } catch (error) {
      console.error("❌ Error parsing script response:", error);
      console.error("📝 Response length:", response.length);
      console.error("📝 First 200 chars:", response.substring(0, 200));
      console.error("📝 Last 200 chars:", response.substring(Math.max(0, response.length - 200)));

      throw new Error(`Failed to parse generated script: ${error instanceof Error ? error.message : 'Invalid format'}`);
    }
  }

  private stripVisualActions(script: VideoScript): VideoScript {
    return {
      ...script,
      scenes: script.scenes.map(scene => ({ ...scene, actions: [] })),
      shorts: script.shorts.map(short => ({
        ...short,
        scenes: short.scenes.map(scene => ({ ...scene, actions: [] })),
      })),
    };
  }

  /**
   * Keep generated Reel captions paste-ready and enforce the product limit even
   * when the model returns too many hashtags.
   */
  private normalizeInstagramCaption(value: unknown): string {
    if (typeof value !== "string") return "";

    let hashtagCount = 0;
    return value
      .trim()
      .replace(/(^|\s)(#[\p{L}\p{N}_]+)/gu, (match, prefix: string, hashtag: string) => {
        hashtagCount += 1;
        return hashtagCount <= 5 ? `${prefix}${hashtag}` : "";
      })
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
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
