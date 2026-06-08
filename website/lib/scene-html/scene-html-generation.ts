import { GeminiService } from "@/lib/ai";

export interface SceneHtmlGenerationInput {
  narration: string;
  isShort?: boolean;
  sceneId?: string;
  duration?: number;
}

const BASE_SYSTEM_PROMPT = `You are an elite motion designer and front-end visualization engineer.

Your task is to generate a SINGLE self-contained HTML file that visually explains the provided narration segment.

GOAL:
Create highly engaging technology explainer visuals suitable for a modern educational YouTube channel.

OUTPUT RULES:

- Output ONLY valid HTML.
- Do not wrap output in markdown.
- Do not explain anything.
- Do not include code fences.
- Return a complete HTML document.

TECHNICAL REQUIREMENTS:

- Single HTML file.
- Inline CSS only.
- Inline JavaScript only.
- No external libraries.
- No CDN imports.
- No network requests.
- No audio.
- Must render correctly in Chromium.
- Expose window.renderFrame(seconds) and make every animation deterministic from that time value.
- CSS animations are allowed, but window.renderFrame(seconds) must pause and seek them with document.getAnimations().

VISUAL STYLE:

Theme:
- Premium technology education channel
- Clean light mode
- Modern SaaS aesthetic
- Apple + Linear + Stripe inspired
- Rich but minimal
- Professional engineering feel

Colors:
- White background
- Subtle light gray surfaces
- Soft shadows
- Dark text
- Blue accent color
- Occasional purple accent
- Never use dark mode

Typography:
- Large headings
- Clean hierarchy
- Minimal text
- High readability

ANIMATION RULES:

Animations are critical.

Every scene must contain motion.

Use:
- smooth transforms
- opacity transitions
- flowing connections
- animated counters
- moving packets
- pulsing highlights
- scaling elements
- animated arrows
- timeline movement

Avoid:
- shaking
- flashing
- strobing
- chaotic movement

Animation style:
- smooth
- premium
- deliberate
- satisfying

EXPLANATION RULES:

Do NOT merely display text.

Always visualize concepts.

Examples:

If narration discusses:
- database -> show records, indexes, queries
- cache -> show cache hits and misses
- api -> show request/response flow
- redis -> show memory access
- kafka -> show message streams
- aws lambda -> show cold start lifecycle
- load balancer -> show traffic distribution
- dns -> show lookup chain
- microservices -> show service communication
- networking -> show packets moving
- queues -> show items entering and leaving

Create visual metaphors whenever useful.

SCREEN COMPOSITION:

- Fill most of screen
- Large central focus
- Clear visual hierarchy
- Minimal empty space
- No tiny diagrams

TEXT RULES:

- Very little text
- Maximum 20% of screen area
- Visuals should carry the explanation

QUALITY BAR:

The result should feel closer to:
- Linear
- Stripe
- Vercel
- Apple keynote visuals

and not:
- PowerPoint
- school diagrams
- stock infographics

IMPORTANT:

The generated HTML should be visually impressive even if viewed without narration.

Use the narration only as guidance for what concept to visualize.`;

export class SceneHtmlGenerationService {
  private gemini = new GeminiService();

  async generateSceneHtml(input: SceneHtmlGenerationInput): Promise<string> {
    const prompt = this.buildPrompt(input);
    const response = await this.gemini.generateText(prompt, {
      model: "gemini-3-flash-preview",
      temperature: 0.75,
      topP: 0.95
    });

    return sanitizeGeneratedHtml(response, input);
  }

  private buildPrompt(input: SceneHtmlGenerationInput): string {
    const width = input.isShort ? 1080 : 1920;
    const height = input.isShort ? 1920 : 1080;
    const format = input.isShort ? "vertical YouTube Shorts" : "landscape long-form YouTube";
    const maxDuration = Math.min(Math.max(input.duration ?? 30, 1), 120);

    return `${BASE_SYSTEM_PROMPT}

SCREEN DIMENSIONS:
- Render for ${format}.
- Exact viewport: ${width}x${height}.
- Make the root layout fill the full viewport.
- Use responsive CSS tied to these dimensions; do not rely on scrolling.
- Keep all essential visual elements inside the safe area.

TIMING:
- The scene may be rendered for up to ${maxDuration.toFixed(2)} seconds.
- All animation must look good when sampled by repeatedly calling window.renderFrame(seconds).
- Define window.renderFrame(seconds) even if you also use CSS keyframes.

NARRATION SEGMENT:
${input.narration || "(silent scene; create a visual-only motion hook)"}`;
  }
}

export function sanitizeGeneratedHtml(raw: string, input: Partial<SceneHtmlGenerationInput> = {}): string {
  let html = raw.trim();

  html = html
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const docMatch = html.match(/<!doctype html[\s\S]*<\/html>/i) || html.match(/<html[\s\S]*<\/html>/i);
  if (docMatch) {
    html = docMatch[0].trim();
  }

  if (!/<html[\s>]/i.test(html)) {
    html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
  }

  if (!/<!doctype html>/i.test(html)) {
    html = `<!DOCTYPE html>\n${html}`;
  }

  html = html
    .replace(/<script\b[^>]*\bsrc\s*=\s*["'][^"']*["'][^>]*>\s*<\/script>/gi, "")
    .replace(/<link\b[^>]*\bhref\s*=\s*["']https?:\/\/[^"']*["'][^>]*>/gi, "")
    .replace(/@import\s+url\([^)]*\)\s*;?/gi, "")
    .replace(/@import\s+["'][^"']*["']\s*;?/gi, "")
    .replace(/\bfetch\s*\(/gi, "void(")
    .replace(/\bXMLHttpRequest\b/g, "BlockedXMLHttpRequest")
    .replace(/\bWebSocket\b/g, "BlockedWebSocket")
    .replace(/\bEventSource\b/g, "BlockedEventSource");

  html = ensureHeadMetadata(html, input);
  html = ensureRenderFrameHook(html);

  if (!/<\/html>\s*$/i.test(html)) {
    html = `${html}\n</html>`;
  }

  return html;
}

function ensureHeadMetadata(html: string, input: Partial<SceneHtmlGenerationInput>): string {
  const width = input.isShort ? 1080 : 1920;
  const height = input.isShort ? 1920 : 1080;
  const metadata = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#fff;}body{min-width:${width}px;min-height:${height}px;}</style>`;

  if (/<head[\s\S]*?>/i.test(html)) {
    return html.replace(/<head[\s\S]*?>/i, match => `${match}${metadata}`);
  }

  return html.replace(/<html[\s\S]*?>/i, match => `${match}<head>${metadata}</head>`);
}

function ensureRenderFrameHook(html: string): string {
  const hook = `<script>
(function(){
  const originalRenderFrame = typeof window.renderFrame === "function" ? window.renderFrame.bind(window) : null;
  window.renderFrame = function(seconds) {
    const ms = Math.max(0, Number(seconds) || 0) * 1000;
    if (typeof originalRenderFrame === "function") originalRenderFrame(seconds);
    if (document.getAnimations) {
      document.getAnimations().forEach(function(animation) {
        try {
          animation.pause();
          animation.currentTime = ms;
        } catch (_) {}
      });
    }
    document.documentElement.style.setProperty("--scene-time", String(seconds));
  };
})();
</script>`;

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${hook}</body>`);
  }

  return html.replace(/<\/html>/i, `<body>${hook}</body></html>`);
}

export default SceneHtmlGenerationService;
