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
- IMPORTANT: In window.renderFrame, ALWAYS check if elements exist before accessing their .style properties (e.g., if (!el) return;) to avoid null reference errors.

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
- make the animations such that it perfectly time the narration timing
- avoid looping over of things; make sure everything is run exactly once in the one cycle of duration

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
- Avoid HTML such that things overlap on each other; ensure proper layout and spacing

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
- Exact canvas size: ${width}x${height} pixels.
- The root container (#app or equivalent) MUST be exactly ${width}x${height}px.
- DO NOT put display:flex or display:grid on <body> or <html>. Leave them as display:block.
- Position the root container with absolute positioning centered like this:
    #app {
      position: absolute;
      left: 50%; top: 50%;
      margin-left: -${width / 2}px;
      margin-top: -${height / 2}px;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
    }
- If you write a resize() function to scale the canvas, use Math.max (not Math.min):
    const scale = Math.max(window.innerWidth / ${width}, window.innerHeight / ${height});
    app.style.transform = \`scale(\${scale})\`;
    app.style.transformOrigin = 'center center';
- This ensures the visual COVERS the full screen with no black bars or margins.
- Do not rely on scrolling. Everything must stay within the canvas bounds.
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
  html = ensureFullscreenFix(html, input);
  html = ensureRenderFrameHook(html);

  if (!/<\/html>\s*$/i.test(html)) {
    html = `${html}\n</html>`;
  }

  return html;
}

function ensureHeadMetadata(html: string, input: Partial<SceneHtmlGenerationInput>): string {
  const width = input.isShort ? 1080 : 1920;
  const height = input.isShort ? 1920 : 1080;
  // Reset body/html so flex-shrink never collapses the canvas before JS scaling runs.
  const metadata = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;width:100vw;height:100vh;overflow:hidden;background:#fff;display:block!important;flex-shrink:0!important;}body{min-width:${width}px;min-height:${height}px;position:relative;}</style>`;

  if (/<head[\s\S]*?>/i.test(html)) {
    return html.replace(/<head[\s\S]*?>/i, match => `${match}${metadata}`);
  }

  return html.replace(/<html[\s\S]*?>/i, match => `${match}<head>${metadata}</head>`);
}

/**
 * Injects a script that patches two common AI-generation bugs that cause
 * clipping / letterboxing:
 *
 * 1. Any inline `resize()` that used `Math.min` for scaling is overridden so
 *    the canvas always COVERS (fills) the screen rather than fitting inside it.
 *
 * 2. If the AI placed `display:flex; justify-content:center; align-items:center`
 *    on body/html, those are stripped so the container never gets flex-shrunk
 *    before the JS `scale()` transform is applied.
 *
 * 3. Any #app (or the first full-viewport-sized child) is forced to use
 *    absolute centering via negative margins so the scale() origin is correct.
 */
function ensureFullscreenFix(html: string, input: Partial<SceneHtmlGenerationInput>): string {
  const width = input.isShort ? 1080 : 1920;
  const height = input.isShort ? 1920 : 1080;

  const fixScript = `<script>
(function() {
  // ── 1. Patch Math.min → Math.max in all resize-scale calls ──────────────
  // We override window.renderFrame AFTER the page scripts have run so the
  // scale value is always computed with cover semantics.
  var _origResize;
  function _patchedResize() {
    var app = document.getElementById('app') ||
              document.querySelector('[id$="-app"]') ||
              document.querySelector('body > div:first-child');
    if (!app) return;
    var W = ${width}, H = ${height};
    var scale = Math.max(window.innerWidth / W, window.innerHeight / H);
    app.style.transform = 'scale(' + scale + ')';
    app.style.transformOrigin = 'center center';
    // Guarantee absolute centering so transform-origin is correct
    if (getComputedStyle(app).position !== 'absolute') {
      app.style.position = 'absolute';
    }
    app.style.left = '50%';
    app.style.top  = '50%';
    app.style.marginLeft = (-W / 2) + 'px';
    app.style.marginTop  = (-H / 2) + 'px';
    app.style.width  = W + 'px';
    app.style.height = H + 'px';
  }

  // ── 2. Strip flex-centering from body that shrinks the canvas ───────────
  function _stripBodyFlex() {
    [document.documentElement, document.body].forEach(function(el) {
      if (!el) return;
      var s = el.style;
      if (s.display === 'flex' || getComputedStyle(el).display === 'flex') {
        s.display = 'block';
      }
    });
  }

  // ── 3. Apply on load and resize ─────────────────────────────────────────
  window.addEventListener('resize', _patchedResize);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      _stripBodyFlex();
      _patchedResize();
    });
  } else {
    _stripBodyFlex();
    _patchedResize();
  }
  // Re-apply a second time after a tick to catch any late JS mutations
  setTimeout(function() { _stripBodyFlex(); _patchedResize(); }, 0);
  setTimeout(function() { _patchedResize(); }, 100);
})();
</script>`;

  // Inject right before </head> if possible, else before </body>
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${fixScript}</head>`);
  }
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${fixScript}</body>`);
  }
  return html;
}

function ensureRenderFrameHook(html: string): string {
  const hook = `<script>
(function(){
  const originalRenderFrame = typeof window.renderFrame === "function" ? window.renderFrame.bind(window) : null;
  window.renderFrame = function(seconds) {
    const ms = Math.max(0, Number(seconds) || 0) * 1000;
    if (typeof originalRenderFrame === "function") {
      try {
        originalRenderFrame(seconds);
      } catch (err) {
        console.error("AI renderFrame error:", err);
      }
    }
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
