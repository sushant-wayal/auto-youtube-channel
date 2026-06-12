# Scene Rendering System

> Programmatic video scene generation using HTML5 Canvas and Puppeteer

This document explains how scenes are defined, rendered, and converted to video clips.

---

## Overview

The scene rendering system converts declarative scene definitions (`SceneIR`) into MP4 video clips by:

1. **Parsing scene actions** — Extract visual primitives (ActionIR) from scene definition
2. **Generating HTML** — Create self-contained HTML page with Canvas 2D animations
3. **Capturing frames** — Use Puppeteer to call `window.renderFrame(t)` for each frame
4. **Encoding video** — Use FFmpeg to convert PNG frames → H.264 MP4

```
SceneIR → HTML+JS (Canvas 2D) → Puppeteer frames → FFmpeg → MP4 → Cloudinary URL
```

### Two Rendering Modes

| Mode | How HTML is Generated | When to Use |
|------|-----------------------|-------------|
| `code` | `SceneHtmlRenderer` converts ActionIR locally | Default; fast, deterministic |
| `ai` | Gemini via `/api/generate-scene-html` | Richer/freer visuals; slower, rate-limited |

Set via `SCENE_RENDER_METHOD` env var.

---

## Scene Definition (SceneIR)

Each scene is defined with:

```typescript
interface SceneIR {
  id: string;               // Unique scene identifier (e.g., "scene-1", "hook")
  sceneTitle?: string;      // Title for YouTube chapters
  sceneTheme?: "light" | "dark" | "auto";  // Visual theme
  baseDuration: number;     // Animation duration in seconds
  holdDuration: number;     // Hold time after animations complete
  narration?: string;       // Per-scene narration text (empty = silence for hook)
  actions: ActionIR[];      // Visual primitives to render
}
```

### Duration Calculation

- **Total scene duration** = `baseDuration + holdDuration`
- Actions animate at their `t` property (time offset from scene start)
- The renderer calculates `animationStopTime` (when the last animation finishes)
- The assembler uses `max(animationStop + 0.5s, narrationDuration)` as final clip length

---

## Visual Primitives (ActionIR)

All visual elements are defined as **ActionIR** objects. The current implementation in
`action-flow-to-html.ts` handles these `op` values:

### `text` — Text Label

```typescript
{
  t: number;          // Start time (seconds from scene start)
  op: "text";
  x: number;          // X position (0–width)
  y: number;          // Y position (0–height)
  value: string;      // Text content
  size?: "title" | "subtitle" | "body" | "label";  // Preset scale
  fontSize?: number;  // Override px size
  fontWeight?: number;
  fill?: string;      // Text color (defaults to theme textPrimary)
  align?: "left" | "center" | "right";
  baseline?: "top" | "middle" | "bottom";
  monospace?: boolean; // Use JetBrains Mono instead of Inter
}
```

**Responsive Size Presets:**

| Size | Long-form Landscape | Short Portrait |
|------|--------------------|-----------------------|
| `title` | ~H×0.067 | ~W×0.070 |
| `subtitle` | ~H×0.045 | ~W×0.047 |
| `body` | ~H×0.030 | ~W×0.032 |
| `label` | ~H×0.022 | ~W×0.024 |

### `code` — Syntax-Highlighted Code Block

```typescript
{
  t: number;
  op: "code";           // ← Note: the op is "code", not "codeBlock"
  x: number;
  y: number;
  w?: number;           // Width (defaults to auto)
  h?: number;           // Height (defaults to auto)
  code: string;         // Code content (newline-separated lines)
  language: string;     // js, ts, py, go, rs, sql, javascript, typescript, python, golang, rust
  fontSize?: number;
}
```

Code blocks are revealed line-by-line with a fade-in animation. Each line is tokenized and color-coded.

### `line` — Animated Connector

```typescript
{
  t: number;
  op: "line";
  x1: number; y1: number; // Start point
  x2: number; y2: number; // End point
  stroke?: string;        // Color (defaults to theme accent)
  strokeWidth?: number;   // Default: 2
  dashed?: boolean;
  arrow?: boolean;        // Arrow head at end point
  curve?: "none" | "arc-up" | "arc-down" | "s-curve" | "wave";
}
```

Lines draw from start to end point over their animation duration. Curve shapes use seeded Bézier curves for consistency across frames.

### `icon` — Named SVG Icon

```typescript
{
  t: number;
  op: "icon";
  x: number;
  y: number;
  name: string;     // One of the 18 built-in icon names (see table below)
  size?: number;    // Icon size in pixels (default: 48)
  stroke?: string;  // Stroke color
  fill?: string;    // Fill color (false = no fill)
  strokeWidth?: number;
}
```

**Available Icons (18 total):**

| Name | Description |
|------|-------------|
| `check` | Checkmark circle |
| `cross` | X mark |
| `warning` | Warning triangle |
| `info` | Information circle |
| `arrowRight` | Right arrow |
| `arrowLeft` | Left arrow |
| `arrowUp` | Up arrow |
| `arrowDown` | Down arrow |
| `plus` | Plus sign |
| `minus` | Minus sign |
| `clock` | Clock |
| `database` | Database cylinder |
| `server` | Server rack |
| `cpu` | CPU chip |
| `lock` | Padlock |
| `unlock` | Open padlock |
| `cloud` | Cloud |
| `bug` | Bug |
| `chartUp` | Upward chart arrow |
| `chartDown` | Downward chart arrow |

> **Note:** The older docs listed many additional primitives (`rect`, `ellipse`, `path`, `progressBar`, `badge`, `table`, `numberCounter`, `highlight`, `group`, `transform`). These may be defined in the TypeScript types (`src/types/index.ts`) for use by the script-generation Gemini prompt, but **only `text`, `code`, `line`, and `icon` are actively rendered** in `action-flow-to-html.ts`. Other ops are gracefully ignored.

---

## Theme System

Themes alternate automatically: even-indexed scenes get `light`, odd-indexed scenes get `dark`.

### Light Theme

```javascript
{
  bg: "#FAFAF9",             // Warm white (Zinc-50)
  surface: "#F5F5F4",        // Zinc-100
  textPrimary: "#18181B",    // Zinc-900
  textSecondary: "#52525B",  // Zinc-600
  accent: "#6366F1",         // Indigo-500
  accentSoft: "#E0E7FF",     // Indigo-100
  warning: "#F59E0B",        // Amber-500
  success: "#10B981",        // Emerald-500
  danger: "#EF4444",         // Red-500
  border: "#E5E5E5",
}
```

### Dark Theme

```javascript
{
  bg: "#0F172A",             // Slate-900
  surface: "#1E293B",        // Slate-800
  textPrimary: "#F1F5F9",    // Slate-100
  textSecondary: "#CBD5E1",  // Slate-300
  accent: "#818CF8",         // Indigo-400
  accentSoft: "rgba(129, 140, 248, 0.2)",
  warning: "#FBBF24",        // Amber-400
  success: "#34D399",        // Emerald-400
  danger: "#F87171",         // Red-400
  border: "#334155",         // Slate-700
}
```

### Background Decorations

Every scene canvas has these layered behind the actions:
- Engineering-paper grid (very subtle)
- Circuit node dots at grid intersections
- Corner bracket accents (all 4 corners)
- Floating tech symbols: `{}` `<>` `[]` `=>` `//` `&&` `( )` `**` (semi-transparent)
- Circuit trace lines (thin L-shaped decorations)
- Soft radial vignette (darkens edges slightly)

---

## Syntax Highlighting

The built-in tokenizer in `action-flow-to-html.ts` supports:

**Languages:** `javascript` / `js`, `typescript` / `ts`, `python` / `py`, `go` / `golang`, `rust` / `rs`, `sql`

**Token types and colors:**

| Type | Dark Theme | Light Theme |
|------|------------|-------------|
| `keyword` | `#C084FC` (purple) | `#7C3AED` (purple) |
| `string` | `#86EFAC` (green) | `#15803D` (green) |
| `number` | `#FDBA74` (orange) | `#EA580C` (orange) |
| `comment` | `#64748B` (gray) | `#64748B` (gray) |
| `function` | `#60A5FA` (blue) | `#2563EB` (blue) |
| `operator` | `#FB923C` (orange) | `#C2410C` (dark orange) |
| `punctuation` | `#94A3B8` (gray) | `#475569` (gray) |
| `type` | `#34D399` (emerald) | `#059669` (emerald) |
| `builtin` | `#FCD34D` (yellow) | `#CA8A04` (yellow) |
| `variable` | `#E2E8F0` (white) | `#0F172A` (dark) |

---

## Animation System

### Duration Assignment

Each action's animation duration is determined by the **gap-window algorithm**:
- Duration = gap between this action's `t` and the next action's `t`
- Last action gets the remaining `baseDuration - t` as its duration

### Easing Functions

| Easing | Description |
|--------|-------------|
| `linear` | Constant speed |
| `easeIn` | Accelerates from slow |
| `easeOut` | Decelerates to stop |
| `easeInOut` | Slow start and end |

### Animation Effects per Primitive

| Primitive | Effect |
|-----------|--------|
| `text` | Fade in (opacity 0→1) |
| `code` | Line-by-line fade in (sequential) |
| `line` | Progressive draw (start→end) |
| `icon` | Fade in (opacity 0→1) |

---

## Rendering Pipeline (Technical)

### 1. HTML Generation (`SceneHtmlRenderer`)

`action-flow-to-html.ts` generates a complete self-contained HTML document:

```html
<!DOCTYPE html>
<html>
<head>
  <style>/* Google Fonts: Inter + JetBrains Mono */</style>
</head>
<body style="margin:0;overflow:hidden;">
  <canvas id="canvas" width="{W}" height="{H}"></canvas>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    // Theme + color constants
    // Background drawing functions (grid, nodes, symbols, vignette)
    // Per-action draw functions (drawText, drawCode, drawLine, drawIcon)
    // Easing functions

    window.renderFrame = function(t) {
      // t = current time in seconds
      // Draws everything at time t in one synchronous pass
      drawBackground(ctx);
      actions.forEach(action => {
        if (t >= action.t) drawAction(ctx, action, t - action.t);
      });
    };

    // Called immediately to ensure first frame is visible
    window.renderFrame(0);
  </script>
</body>
</html>
```

Key property: `window.renderFrame(t)` is a **pure, synchronous** function that draws the entire scene state at time `t`. Puppeteer calls this once per frame.

### 2. Frame Capture (`HtmlToVideoService`)

`htmlToVideoService.ts`:

```typescript
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
const page = await browser.newPage();
await page.setViewport({ width, height });
await page.setContent(html);
// Wait for fonts to load
await page.evaluate(() => document.fonts.ready);

const totalFrames = Math.ceil(duration * fps);
for (let frame = 0; frame < totalFrames; frame++) {
  const t = frame / fps;
  await page.evaluate((time) => window.renderFrame(time), t);
  await page.screenshot({ path: `frames/frame-${frame.toString().padStart(6,'0')}.png` });
}

await browser.close();
```

### 3. FFmpeg Encoding

```bash
ffmpeg \
  -framerate 30 \
  -i frames/frame-%06d.png \
  -c:v libx264 \
  -preset medium \
  -crf 16 \
  -pix_fmt yuv420p \
  -threads 1 \
  output.mp4
```

CRF 16 = high quality (lower is better). `threads 1` = CI memory constraint.

---

## Video Dimensions

| Format | Width | Height | FPS | Aspect |
|--------|-------|--------|-----|--------|
| Long-form | 1920 | 1080 | 30 | 16:9 |
| Shorts | 1080 | 1920 | 30 | 9:16 |

---

## AI Scene Mode (Rate-Limit Queue)

When `SCENE_RENDER_METHOD=ai`, the system uses a Redis-based queue to serialize Gemini calls:

```
Redis keys:
  html_queue:turn         — ticket counter (INCR atomically)
  html_queue:processing   — lease key (deleted after 22s cooldown)
  html_queue:last_enquiry — timestamp of last request

Flow for each scene:
  1. Worker acquires a ticket (waits if another scene is processing)
  2. POST /api/generate-scene-html with scene narration
  3. Website calls Gemini → returns animated HTML
  4. Worker starts 22-second background cooldown timer
  5. When cooldown ends: INCR turn + DEL processing (next scene can proceed)
  6. Worker renders the received HTML with Puppeteer → FFmpeg
```

The 22-second cooldown prevents rate-limit errors from Gemini's per-minute request quota.

---

## Example Scene Definition

```typescript
const scene: SceneIR = {
  id: "caching-intro",
  sceneTitle: "Why Caching Breaks",
  baseDuration: 6,
  holdDuration: 1,
  narration: "Caching seems simple, but there's one detail most developers miss.",
  actions: [
    // Title fades in at 0s
    {
      t: 0,
      op: "text",
      x: 960, y: 200,
      value: "The Caching Problem",
      size: "title",
      align: "center",
    },
    // Subtitle at 0.8s
    {
      t: 0.8,
      op: "text",
      x: 960, y: 300,
      value: "Why your cache keeps lying to you",
      size: "subtitle",
      align: "center",
    },
    // Code block at 1.5s
    {
      t: 1.5,
      op: "code",
      x: 200, y: 380,
      code: "const cached = cache.get(key);\nif (cached) return cached;\nconst fresh = await db.query(key);\ncache.set(key, fresh, TTL);\nreturn fresh;",
      language: "typescript",
    },
    // Warning icon at 3.5s
    {
      t: 3.5,
      op: "icon",
      x: 860, y: 650,
      name: "warning",
      size: 64,
      stroke: "#FBBF24",
    },
    // Connector at 4s
    {
      t: 4,
      op: "line",
      x1: 960, y1: 640,
      x2: 1200, y2: 640,
      stroke: "#818CF8",
      strokeWidth: 3,
      arrow: true,
      curve: "arc-up",
    },
  ],
};
```

---

## Next: [03-video-assembly.md](./03-video-assembly.md)
