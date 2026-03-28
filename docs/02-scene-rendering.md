# Scene Rendering System

> Programmatic video scene generation using HTML5 Canvas and Puppeteer

This document explains how scenes are defined, rendered, and converted to video clips.

---

## Overview

The scene rendering system converts declarative scene definitions (`SceneIR`) into video clips by:

1. **Parsing scene actions** - Extract visual primitives from scene definition
2. **Generating HTML** - Create HTML page with Canvas-based animations
3. **Capturing frames** - Use Puppeteer to screenshot each frame
4. **Encoding video** - Use FFmpeg to convert frames to MP4

```
SceneIR → HTML+JS → Puppeteer → Frames → FFmpeg → MP4 → Cloudinary URL
```

---

## Scene Definition (SceneIR)

Each scene is defined with:

```typescript
interface SceneIR {
  id: string;               // Unique scene identifier
  sceneTheme?: "light" | "dark" | "auto";  // Visual theme
  baseDuration: number;     // Animation duration in seconds
  holdDuration: number;     // Hold time after animations complete
  actions: ActionIR[];      // Visual primitives to render
}
```

### Duration Calculation

- **Total Duration** = `baseDuration + holdDuration`
- Actions are scheduled using their `t` (time) property
- Actions animate at their `t` time offset
- After all animations complete, the scene "holds" for `holdDuration`

---

## Visual Primitives (ActionIR)

All visual elements are defined as **ActionIR** objects. Each has:
- `t` - Time offset (seconds from scene start)
- `op` - Operation type (primitive name)
- Position/size properties
- Style properties

### Primitive Reference

#### Line
```typescript
{
  t: number;          // Start time
  op: "line";
  x1: number;         // Start X
  y1: number;         // Start Y
  x2: number;         // End X
  y2: number;         // End Y
  stroke?: string;    // Line color
  strokeWidth?: number;
  dashed?: boolean;   // Dashed line
  dashLength?: number;
  dashGap?: number;
  arrow?: boolean;    // Arrow head at end
  curve?: number;     // Curve amount (0 = straight)
}
```

#### Rectangle
```typescript
{
  t: number;
  op: "rect";
  x: number;          // Top-left X
  y: number;          // Top-left Y
  w: number;          // Width
  h: number;          // Height
  r?: number;         // Border radius
  stroke?: string | false;
  strokeWidth?: number;
  fill?: string | false;
}
```

#### Ellipse
```typescript
{
  t: number;
  op: "ellipse";
  cx: number;         // Center X
  cy: number;         // Center Y
  rx: number;         // Radius X
  ry: number;         // Radius Y
  stroke?: string | false;
  strokeWidth?: number;
  fill?: string | false;
}
```

#### Path (SVG-style)
```typescript
{
  t: number;
  op: "path";
  d: string;          // SVG path data (M, L, C, etc.)
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  dashed?: boolean;
  dashLength?: number;
  dashGap?: number;
}
```

#### Text
```typescript
{
  t: number;
  op: "text";
  x: number;
  y: number;
  value: string;      // Text content
  fontSize?: number;
  size?: "title" | "subtitle" | "body" | "label";  // Preset sizes
  fontWeight?: number;
  fill?: string;      // Text color
  align?: "left" | "center" | "right";
  baseline?: "top" | "middle" | "bottom";
  typewriter?: boolean;  // Typewriter animation effect
  monospace?: boolean;   // Use monospace font
}
```

**Size Presets (Landscape):**
| Size | Font Size |
|------|-----------|
| `title` | 72px |
| `subtitle` | 48px |
| `body` | 32px |
| `label` | 24px |

**Size Presets (Portrait/Shorts):**
| Size | Font Size |
|------|-----------|
| `title` | 96px |
| `subtitle` | 64px |
| `body` | 48px |
| `label` | 36px |

#### Code Block
```typescript
{
  t: number;
  op: "codeBlock";
  x: number;
  y: number;
  w: number;          // Width
  h: number;          // Height
  lines: string[];    // Code lines
  language: string;   // Programming language
  theme?: "light" | "dark";
  fontSize?: number;
  showLineNumbers?: boolean;
  highlightLine?: number;  // Line to highlight
  maxVisibleLines?: number;
  cursor?: boolean;   // Show blinking cursor
}
```

**Supported Languages:**
- JavaScript / TypeScript
- Python
- Java
- Go
- Rust
- C / C++
- PHP
- Ruby
- SQL

#### Progress Bar
```typescript
{
  t: number;
  op: "progressBar";
  x: number;
  y: number;
  w: number;
  h: number;
  value: number;      // Current value
  max?: number;       // Max value (default: 100)
  label?: string;
  r?: number;         // Border radius
  fill?: string;      // Bar fill color
  trackFill?: string; // Track background color
  stroke?: string;
  strokeWidth?: number;
}
```

#### Badge
```typescript
{
  t: number;
  op: "badge";
  x: number;
  y: number;
  value: string;      // Badge text
  style?: "neutral" | "accent" | "warning" | "success" | "danger";
  fontSize?: number;
  fontWeight?: number;
  paddingX?: number;
  paddingY?: number;
  fill?: string;
  stroke?: string;
  textColor?: string;
  icon?: string;      // Icon name to include
}
```

#### Icon
```typescript
{
  t: number;
  op: "icon";
  x: number;
  y: number;
  name: string;       // Icon identifier
  size?: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string | false;
}
```

**Available Icons:**
| Name | Description |
|------|-------------|
| `check` | Checkmark |
| `cross` | X mark |
| `warning` | Warning triangle |
| `info` | Information circle |
| `database` | Database icon |
| `server` | Server icon |
| `cloud` | Cloud icon |
| `lock` | Lock/security |
| `user` | User icon |
| `code` | Code brackets |
| `api` | API icon |
| `arrow-right` | Right arrow |
| `arrow-left` | Left arrow |

#### Table
```typescript
{
  t: number;
  op: "table";
  x: number;
  y: number;
  w: number;
  h: number;
  headers: string[];  // Column headers
  rows: string[][];   // Row data
  striped?: boolean;  // Alternating row colors
  headerFill?: string;
  gridStroke?: string;
  textColor?: string;
  fontSize?: number;
  align?: "left" | "center" | "right";
}
```

#### Number Counter
```typescript
{
  t: number;
  op: "numberCounter";
  x: number;
  y: number;
  from: number;       // Starting value
  to: number;         // Ending value
  prefix?: string;    // e.g., "$"
  suffix?: string;    // e.g., "%"
  decimals?: number;  // Decimal places
  fontSize?: number;
  size?: "title" | "subtitle" | "body" | "label";
  fontWeight?: number;
  fill?: string;
  align?: "left" | "center" | "right";
}
```

#### Highlight
```typescript
{
  t: number;
  op: "highlight";
  x: number;
  y: number;
  w: number;
  h: number;
  style?: "underline" | "box";
  r?: number;         // Border radius (for box)
  fill?: string;
  opacity?: number;
}
```

#### Group
```typescript
{
  t: number;
  op: "group";
  children: ActionIR[];  // Nested actions
}
```

#### Transform
```typescript
{
  t: number;
  op: "transform";
  translate?: [number, number];  // [x, y] offset
  children: ActionIR[];
}
```

---

## Themes

### Light Theme
```javascript
{
  bg: "#FAFAF9",          // Background
  surface: "#F5F5F4",     // Card surfaces
  textPrimary: "#18181B", // Primary text
  textSecondary: "#52525B", // Secondary text
  accent: "#6366F1",      // Accent color (indigo)
  accentSoft: "#E0E7FF",  // Soft accent
  warning: "#F59E0B",     // Warning (amber)
  success: "#10B981",     // Success (emerald)
  danger: "#EF4444",      // Danger (red)
  border: "#E5E5E5",      // Borders
}
```

### Dark Theme
```javascript
{
  bg: "#0F172A",          // Background (slate-900)
  surface: "#1E293B",     // Card surfaces
  textPrimary: "#F1F5F9", // Primary text
  textSecondary: "#CBD5E1", // Secondary text
  accent: "#818CF8",      // Accent (indigo-400)
  accentSoft: "rgba(129, 140, 248, 0.2)",
  warning: "#FBBF24",     // Warning (amber-400)
  success: "#34D399",     // Success (emerald-400)
  danger: "#F87171",      // Danger (red-400)
  border: "#334155",      // Borders
}
```

---

## Syntax Highlighting

Code blocks are tokenized and colored based on language:

### Token Types

| Type | Dark Theme | Light Theme |
|------|------------|-------------|
| `keyword` | Purple (#C084FC) | Purple (#7C3AED) |
| `string` | Green (#86EFAC) | Green (#15803D) |
| `number` | Orange (#FDBA74) | Orange (#EA580C) |
| `comment` | Gray (#64748B) | Gray (#64748B) |
| `function` | Blue (#60A5FA) | Blue (#2563EB) |
| `operator` | Orange (#FB923C) | Dark orange (#C2410C) |
| `punctuation` | Light gray (#94A3B8) | Dark gray (#475569) |
| `type` | Emerald (#34D399) | Emerald (#059669) |
| `builtin` | Yellow (#FCD34D) | Yellow (#CA8A04) |
| `variable` | Off-white (#E2E8F0) | Dark slate (#0F172A) |

### Language Aliases

| Alias | Language |
|-------|----------|
| `js` | JavaScript |
| `ts` | TypeScript |
| `py` | Python |
| `rb` | Ruby |
| `cpp`, `c++` | C++ |
| `golang` | Go |
| `rs` | Rust |

---

## Animation System

### Duration Assignment

Actions are assigned durations based on:

1. **Time until next action** - Default behavior
2. **Type-specific defaults**:
   - Text: 0.3s base
   - Code blocks: 0.5s per line
   - Progress bars: 0.8s
   - Number counters: 1.0s

### Easing Functions

| Easing | Description |
|--------|-------------|
| `linear` | Constant speed |
| `easeIn` | Slow start |
| `easeOut` | Slow end |
| `easeInOut` | Slow start and end |

### Animation Effects

- **Fade in** - Default for most primitives
- **Draw** - Lines draw from start to end
- **Typewriter** - Text appears character by character
- **Count up** - Number counters animate value
- **Fill** - Progress bars fill to target value

---

## Rendering Pipeline

### 1. HTML Generation

`SceneHtmlRenderer` class generates HTML with:

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    /* Theme-aware styles */
    /* Font loading (Inter, JetBrains Mono) */
    /* Animation keyframes */
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <script>
    // Canvas setup
    // Action rendering functions
    // Animation loop with requestAnimationFrame
  </script>
</body>
</html>
```

### 2. Frame Capture

`HtmlToVideoService` uses Puppeteer:

```typescript
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width, height });
await page.setContent(html);

// Capture frames at target FPS
for (let frame = 0; frame < totalFrames; frame++) {
  const time = frame / fps;
  await page.evaluate((t) => window.setTime(t), time);
  await page.screenshot({ path: `frame-${frame}.png` });
}
```

### 3. FFmpeg Encoding

Frames are encoded to MP4:

```bash
ffmpeg -framerate 30 -i frame-%04d.png \
  -c:v libx264 -preset fast -crf 22 \
  -pix_fmt yuv420p output.mp4
```

---

## Video Dimensions

| Format | Width | Height | FPS | Aspect |
|--------|-------|--------|-----|--------|
| Long-form | 1920 | 1080 | 30 | 16:9 |
| Shorts | 1080 | 1920 | 30 | 9:16 |

---

## Example Scene

```typescript
const scene: SceneIR = {
  id: "http-intro",
  sceneTheme: "dark",
  baseDuration: 5,
  holdDuration: 2,
  actions: [
    // Title at 0s
    {
      t: 0,
      op: "text",
      x: 960, y: 200,
      value: "Understanding HTTP",
      size: "title",
      align: "center",
    },
    // Subtitle at 0.5s
    {
      t: 0.5,
      op: "text",
      x: 960, y: 280,
      value: "The Foundation of Web Communication",
      size: "subtitle",
      align: "center",
    },
    // Code block at 1s
    {
      t: 1,
      op: "codeBlock",
      x: 200, y: 400,
      w: 700, h: 300,
      language: "javascript",
      lines: [
        "fetch('https://api.example.com/data')",
        "  .then(response => response.json())",
        "  .then(data => console.log(data));",
      ],
      showLineNumbers: true,
    },
    // Arrow at 2s
    {
      t: 2,
      op: "line",
      x1: 950, y1: 500,
      x2: 1100, y2: 500,
      stroke: "#818CF8",
      strokeWidth: 4,
      arrow: true,
    },
    // Server icon at 2.5s
    {
      t: 2.5,
      op: "icon",
      x: 1150, y: 470,
      name: "server",
      size: 60,
      stroke: "#34D399",
    },
  ],
};
```

---

## Next: [03-video-assembly.md](./03-video-assembly.md)
