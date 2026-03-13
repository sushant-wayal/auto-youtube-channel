import { ActionIR } from "../../types";

type SceneHtmlRendererInput = {
  duration: number;
  actions: ActionIR[];
  sceneTheme?: "light" | "dark" | "auto";
};

type Easing = "linear" | "easeIn" | "easeOut" | "easeInOut";

type ScheduledAction = ActionIR & {
  dur?: number;
  easing?: Easing;
  endT?: number;
};


export class SceneHtmlRenderer {
  render(scene: SceneHtmlRendererInput, height: number, width: number): { html: string, animationStopTime: number } {
    // const normalized = this.retimeByGapExpansion(scene.actions, scene.duration);
    const { actions: withDurations, animationStopTime } = this.assignDurations(scene.actions, scene.duration);
    const withTextLifetimes = this.applyTextReplacement(withDurations, scene.duration);
    return {
      html: this.emitHtml(
        { duration: scene.duration, actions: withTextLifetimes },
        height,
        width
      ), animationStopTime
    };
  }

  private applyTextReplacement(
    actions: ScheduledAction[],
    sceneDuration: number
  ): ScheduledAction[] {
    const textBuckets = new Map<string, ScheduledAction[]>();

    for (const a of actions) {
      if (a.op !== "text") continue;

      const key = `${a.x}|${a.y}|${a.align ?? "left"}`;
      if (!textBuckets.has(key)) {
        textBuckets.set(key, []);
      }
      textBuckets.get(key)!.push(a);
    }

    for (const bucket of textBuckets.values()) {
      bucket.sort((a, b) => a.t - b.t);

      for (let i = 0; i < bucket.length; i++) {
        const curr = bucket[i];
        const next = bucket[i + 1];

        curr.endT = next ? next.t : undefined;
      }
    }

    return actions;
  }

  /* ------------------------------------------------------------ */
  /* 1. NORMALIZE + RETIME (THIS FIXES END HOLD)                   */
  /* ------------------------------------------------------------ */

  private retimeByGapExpansion(
    actions: ActionIR[],
    duration: number
  ): ActionIR[] {
    if (actions.length < 2) return actions;

    const sorted = [...actions].sort((a, b) => a.t - b.t);

    // original gaps
    const gaps: number[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      gaps.push(sorted[i + 1].t - sorted[i].t);
    }

    const lastT = sorted[sorted.length - 1].t;
    const endGap = duration - lastT;

    if (endGap <= 0) return sorted;

    const gapSum = gaps.reduce((s, g) => s + g, 0);
    if (gapSum === 0) return sorted;

    // distribute endGap proportionally
    const newGaps = gaps.map(g => g + (g / gapSum) * endGap);

    // rebuild t's
    const retimed: ActionIR[] = [];
    let currentT = sorted[0].t;

    retimed.push({ ...sorted[0], t: currentT });

    for (let i = 1; i < sorted.length; i++) {
      currentT += newGaps[i - 1];
      retimed.push({ ...sorted[i], t: currentT });
    }

    return retimed;
  }



  /* ------------------------------------------------------------ */
  /* 2. ASSIGN DURATIONS (TIMELINE-WINDOW BASED)                  */
  /* ------------------------------------------------------------ */

  private assignDurations(
    actions: ActionIR[],
    duration: number
  ): { actions: ScheduledAction[], animationStopTime: number } {
    const scheduledActions = actions.map((a, i) => {
      const next = actions[i + 1];
      const window = a.op === "text" ? 5 / 8 : next ? next.t - a.t : (duration - a.t) / 2;

      return {
        ...a,
        dur: Math.max(0.4, window * 0.8),
        easing: this.randomEasing()
      };
    });

    const lastAction = scheduledActions[scheduledActions.length - 1];
    const animationStopTime = lastAction ? lastAction.t + (lastAction.dur ?? 0) : 0;

    return { actions: scheduledActions, animationStopTime };
  }


  private randomEasing(): Easing {
    const e: Easing[] = ["linear", "easeIn", "easeOut", "easeInOut"];
    return e[Math.floor(Math.random() * e.length)];
  }

  /* ------------------------------------------------------------ */
  /* 3. HTML EMISSION (REAL ANIMATION, NOT FAKE)                  */
  /* ------------------------------------------------------------ */

  private emitHtml(scene: SceneHtmlRendererInput, height: number, width: number): string {
    const actionsJS = scene.actions.map(a => JSON.stringify(a)).join(",\n");

    // Detect format: portrait = shorts, landscape = long-form
    const isShorts = height > width;

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { 
    margin:0; 
    overflow:hidden;
    font-family: "Inter", "Helvetica Neue", Arial, sans-serif;
  }
  canvas { display:block; }
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
const W = ${width};
const H = ${height};
const DPR = Math.max(window.devicePixelRatio || 1, 2);
const IS_SHORTS = ${isShorts};
const SCENE_THEME = ${JSON.stringify(scene.sceneTheme ?? "auto")};

const canvas = document.getElementById("c");
canvas.width = W * DPR;
canvas.height = H * DPR;
canvas.style.width = W + "px";
canvas.style.height = H + "px";

const ctx = canvas.getContext("2d");
ctx.scale(DPR, DPR);

/* ========================================================== */
/* DESIGN SYSTEM - Dual Palette (Light + Dark)                */
/* ========================================================== */

const THEME_LIGHT = {
  bg: "#FAFAF9",
  surfaceGradientStart: "#FFFFFF",
  surfaceGradientEnd: "#F0F0F8",
  gridLine: "rgba(0, 0, 0, 0.03)",
  gridDot: "rgba(99, 102, 241, 0.06)",
  bracket: "rgba(99, 102, 241, 0.08)",
  symbolOpacity: 0.04,
  traceOpacity: 0.035,
  vignetteCenter: "rgba(255, 255, 255, 0.3)",
  vignetteMid: "rgba(255, 255, 255, 0)",
  vignetteEdge: "rgba(0, 0, 0, 0.015)",
  surface: "#F5F5F4",
  surfaceBorder: "#E7E5E4",
  textPrimary: "#18181B",
  textSecondary: "#52525B",
  textMuted: "#A1A1AA",
  accent: "#6366F1",
  accentSoft: "#E0E7FF",
  accentBorder: "#A5B4FC",
  warning: "#F59E0B",
  warningSoft: "#FEF3C7",
  connector: "#A1A1AA",
  connectorStrong: "#52525B"
};

const THEME_DARK = {
  bg: "#0F172A",
  surfaceGradientStart: "#334155",
  surfaceGradientEnd: "#1E293B",
  gridLine: "rgba(99, 102, 241, 0.08)",
  gridDot: "rgba(129, 140, 248, 0.14)",
  bracket: "rgba(129, 140, 248, 0.2)",
  symbolOpacity: 0.11,
  traceOpacity: 0.14,
  vignetteCenter: "rgba(148, 163, 184, 0.08)",
  vignetteMid: "rgba(15, 23, 42, 0)",
  vignetteEdge: "rgba(2, 6, 23, 0.5)",
  surface: "#1E293B",
  surfaceBorder: "#334155",
  textPrimary: "#F1F5F9",
  textSecondary: "#CBD5E1",
  textMuted: "#94A3B8",
  accent: "#818CF8",
  accentSoft: "rgba(129, 140, 248, 0.2)",
  accentBorder: "#A5B4FC",
  warning: "#FBBF24",
  warningSoft: "rgba(251, 191, 36, 0.22)",
  connector: "#94A3B8",
  connectorStrong: "#CBD5E1"
};

const isDarkTheme = SCENE_THEME === "dark";
const theme = isDarkTheme ? THEME_DARK : THEME_LIGHT;

/* ========================================================== */
/* RESPONSIVE TYPOGRAPHY & SPACING                            */
/* ========================================================== */

const scale = IS_SHORTS ? {
  // Shorts: portrait, need larger relative text
  title: Math.round(W * 0.070),      // ~76px on 1080w (increased for better readability)
  subtitle: Math.round(W * 0.036),   // ~39px (increased for better readability)
  body: Math.round(W * 0.028),       // ~30px (increased for better readability)
  label: Math.round(W * 0.024),      // ~26px (increased for better readability)
  
  // Spacing
  marginX: Math.round(W * 0.08),     // 8% horizontal margin
  marginY: Math.round(H * 0.06),     // 6% vertical margin
  gap: Math.round(W * 0.04),         // gap between elements
  
  // Animation timing (faster for shorts)
  baseDuration: 0.35,
  staggerDelay: 0.12
} : {
  // Long-form: landscape
  title: Math.round(H * 0.067),      // ~48px on 720h
  subtitle: Math.round(H * 0.036),   // ~26px
  body: Math.round(H * 0.030),       // ~22px
  label: Math.round(H * 0.025),      // ~18px
  
  // Spacing
  marginX: Math.round(W * 0.10),     // 10% horizontal margin
  marginY: Math.round(H * 0.12),     // 12% vertical margin
  gap: Math.round(W * 0.03),         // gap between elements
  
  // Animation timing (slower for long-form)
  baseDuration: 0.5,
  staggerDelay: 0.15
};

/* ========================================================== */
/* ACTIONS                                                    */
/* ========================================================== */

const actions = [
${actionsJS}
].sort((a,b)=>a.t-b.t);
let CURRENT_TIME = 0;

const ICON_PATHS = {
  check: "M5 13l4 4L19 7",
  cross: "M6 6l12 12M18 6L6 18",
  warning: "M12 3l9 16H3L12 3zm0 5v5m0 3h.01",
  info: "M12 8h.01M11 12h1v4h1",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  arrowUp: "M12 19V5M6 11l6-6 6 6",
  arrowDown: "M12 5v14M6 13l6 6 6-6",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  clock: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18",
  database: "M4 7c0-2.2 3.6-4 8-4s8 1.8 8 4v10c0 2.2-3.6 4-8 4s-8-1.8-8-4V7zm0 0c0 2.2 3.6 4 8 4s8-1.8 8-4M4 12c0 2.2 3.6 4 8 4s8-1.8 8-4",
  server: "M4 5h16v5H4zM4 14h16v5H4zM7 8h.01M7 17h.01",
  cpu: "M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2M8 8h8v8H8z",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6z",
  unlock: "M16 11V8a4 4 0 0 0-8 0M6 11h12v10H6z",
  cloud: "M7 18h10a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 7 9a4 4 0 0 0 0 9",
  bug: "M8 9h8v8H8zM12 5v4M4 11h4M16 11h4M5 7l3 2M19 7l-3 2M5 19l3-2M19 19l-3-2",
  chartUp: "M4 19h16M6 15l3-3 3 2 5-6",
  chartDown: "M4 19h16M6 9l3 3 3-2 5 6"
};

/* ========================================================== */
/* ACTIONS RENDERING                                          */
/* ========================================================== */

/* ========================================================== */
/* EASING - Smooth, predictable curves only                   */
/* ========================================================== */

function ease(p, type) {
  switch(type) {
    case "easeOut": 
      // Cubic ease-out: fast start, gentle stop
      return 1 - Math.pow(1 - p, 3);
    case "easeInOut":
      // Smooth S-curve
      return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    case "gentle":
      // Very subtle ease for backgrounds
      return p * p * (3 - 2 * p);
    default: 
      return p;
  }
}

/* ========================================================== */
/* BACKGROUND - Technical explainer theme                     */
/* ========================================================== */

function drawBackground() {
  // Keep scene background solid; variation comes from light/dark theme.
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);
  
  // --- GRID LINES (engineering paper feel) ---
  ctx.strokeStyle = theme.gridLine;
  ctx.lineWidth = 1;
  const gridSize = IS_SHORTS ? 60 : 80;
  
  // Vertical lines
  for (let x = gridSize; x < W; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  // Horizontal lines
  for (let y = gridSize; y < H; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  
  // --- CIRCUIT NODE DOTS at intersections ---
  ctx.fillStyle = theme.gridDot;
  for (let x = gridSize; x < W; x += gridSize * 2) {
    for (let y = gridSize; y < H; y += gridSize * 2) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // --- CORNER BRACKETS (code/tech feel) ---
  ctx.strokeStyle = theme.bracket;
  ctx.lineWidth = 2;
  ctx.lineCap = "square";
  const bracketSize = IS_SHORTS ? 40 : 60;
  const bracketOffset = IS_SHORTS ? 30 : 50;
  
  // Top-left bracket
  ctx.beginPath();
  ctx.moveTo(bracketOffset, bracketOffset + bracketSize);
  ctx.lineTo(bracketOffset, bracketOffset);
  ctx.lineTo(bracketOffset + bracketSize, bracketOffset);
  ctx.stroke();
  
  // Top-right bracket
  ctx.beginPath();
  ctx.moveTo(W - bracketOffset - bracketSize, bracketOffset);
  ctx.lineTo(W - bracketOffset, bracketOffset);
  ctx.lineTo(W - bracketOffset, bracketOffset + bracketSize);
  ctx.stroke();
  
  // Bottom-left bracket
  ctx.beginPath();
  ctx.moveTo(bracketOffset, H - bracketOffset - bracketSize);
  ctx.lineTo(bracketOffset, H - bracketOffset);
  ctx.lineTo(bracketOffset + bracketSize, H - bracketOffset);
  ctx.stroke();
  
  // Bottom-right bracket
  ctx.beginPath();
  ctx.moveTo(W - bracketOffset - bracketSize, H - bracketOffset);
  ctx.lineTo(W - bracketOffset, H - bracketOffset);
  ctx.lineTo(W - bracketOffset, H - bracketOffset - bracketSize);
  ctx.stroke();
  
  // --- FLOATING TECH SYMBOLS (very subtle) ---
  ctx.globalAlpha = theme.symbolOpacity;
  ctx.font = "bold " + (IS_SHORTS ? 20 : 28) + "px monospace";
  ctx.fillStyle = theme.accent;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  // Scattered tech symbols
  const symbols = ["{ }", "< >", "[ ]", "=>", "//", "&&", "( )", "**"];
  const positions = IS_SHORTS ? [
    [80, 200], [W - 80, 350], [100, H - 300], [W - 100, H - 200],
    [W - 60, 600], [60, 800]
  ] : [
    [120, 150], [W - 150, 180], [100, H - 120], [W - 120, H - 150],
    [200, H - 80], [W - 200, 100]
  ];
  
  positions.forEach((pos, i) => {
    ctx.fillText(symbols[i % symbols.length], pos[0], pos[1]);
  });
  
  // --- DECORATIVE CIRCUIT TRACES (corner accents) ---
  ctx.globalAlpha = theme.traceOpacity;
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  
  // Top-right circuit trace
  ctx.beginPath();
  ctx.moveTo(W - 200, 30);
  ctx.lineTo(W - 120, 30);
  ctx.lineTo(W - 120, 80);
  ctx.lineTo(W - 60, 80);
  ctx.stroke();
  // Node at end
  ctx.beginPath();
  ctx.arc(W - 60, 80, 4, 0, Math.PI * 2);
  ctx.fill();
  
  // Bottom-left circuit trace
  ctx.beginPath();
  ctx.moveTo(30, H - 150);
  ctx.lineTo(30, H - 80);
  ctx.lineTo(100, H - 80);
  ctx.lineTo(100, H - 40);
  ctx.stroke();
  // Node at end
  ctx.beginPath();
  ctx.arc(100, H - 40, 4, 0, Math.PI * 2);
  ctx.fill();
  
  // --- SOFT CENTER VIGNETTE ---
  ctx.globalAlpha = 1;
  const gradient = ctx.createRadialGradient(
    W * 0.5, H * 0.45, 0,
    W * 0.5, H * 0.45, Math.max(W, H) * 0.7
  );
  gradient.addColorStop(0, theme.vignetteCenter);
  gradient.addColorStop(0.6, theme.vignetteMid);
  gradient.addColorStop(1, theme.vignetteEdge);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
  
  ctx.lineCap = "round";
}

/* ========================================================== */
/* DRAWING UTILITIES                                          */
/* ========================================================== */

function resetStyles() {
  ctx.globalAlpha = 1;
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function lerp(a, b, p) {
  return a + (b - a) * p;
}

function roundedRectPath(x, y, w, h, r) {
  const safeR = Math.max(0, Math.min(r || 0, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + safeR, y);
  ctx.lineTo(x + w - safeR, y);
  ctx.arcTo(x + w, y, x + w, y + safeR, safeR);
  ctx.lineTo(x + w, y + h - safeR);
  ctx.arcTo(x + w, y + h, x + w - safeR, y + h, safeR);
  ctx.lineTo(x + safeR, y + h);
  ctx.arcTo(x, y + h, x, y + h - safeR, safeR);
  ctx.lineTo(x, y + safeR);
  ctx.arcTo(x, y, x + safeR, y, safeR);
  ctx.closePath();
}

function formatNumber(value, decimals) {
  const safeDecimals = Math.max(0, Math.min(4, decimals || 0));
  return Number(value).toFixed(safeDecimals);
}

function getFontSize(sizeHint) {
  // Map size hints to scale
  if (typeof sizeHint === "number") return sizeHint;
  switch(sizeHint) {
    case "title": return scale.title;
    case "subtitle": return scale.subtitle;
    case "body": return scale.body;
    case "label": return scale.label;
    default: return scale.body;
  }
}

/* ========================================================== */
/* PRIMITIVE: LINE / CONNECTOR                                */
/* ========================================================== */

// Seeded random for consistent curve variants per line
function seededRandom(seed) {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

function drawLine(a, p) {
  // Animation: fade + draw
  const fadeIn = Math.min(1, p * 2.5);
  const drawProgress = ease(p, "easeOut");
  
  ctx.globalAlpha = fadeIn;
  ctx.strokeStyle = a.stroke || theme.connector;
  ctx.lineWidth = a.strokeWidth || 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  
  // Dashed or solid based on parameter
  if (a.dashed) {
    const dashLen = a.dashLength || 8;
    const gapLen = a.dashGap || 6;
    ctx.setLineDash([dashLen, gapLen]);
  }
  
  // Calculate line properties
  const dx = a.x2 - a.x1;
  const dy = a.y2 - a.y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const midX = (a.x1 + a.x2) / 2;
  const midY = (a.y1 + a.y2) / 2;
  
  // Seed based on coordinates for consistency
  const seed = a.x1 * 7 + a.y1 * 13 + a.x2 * 17 + a.y2 * 23;
  const rand = seededRandom(seed);
  
  // Curve intensity scales with distance (longer lines = more curve room)
  const curveIntensity = Math.min(dist * 0.15, 25);
  
  // Perpendicular direction for curve offset
  const perpX = -dy / dist;
  const perpY = dx / dist;
  
  // Choose curve variant based on seed, or use explicit curve param
  // 0=arc up, 1=arc down, 2=S-curve, 3=wave
  const curveType = a.curve !== undefined ? a.curve : Math.floor(rand * 4);
  
  ctx.beginPath();
  ctx.moveTo(a.x1, a.y1);
  
  // Current endpoint based on draw progress
  const endX = lerp(a.x1, a.x2, drawProgress);
  const endY = lerp(a.y1, a.y2, drawProgress);
  
  if (curveType === 0) {
    // Arc up - single control point above the line
    const cpX = midX + perpX * curveIntensity;
    const cpY = midY + perpY * curveIntensity;
    ctx.quadraticCurveTo(
      lerp(a.x1, cpX, drawProgress),
      lerp(a.y1, cpY, drawProgress),
      endX, endY
    );
  } else if (curveType === 1) {
    // Arc down - single control point below the line
    const cpX = midX - perpX * curveIntensity;
    const cpY = midY - perpY * curveIntensity;
    ctx.quadraticCurveTo(
      lerp(a.x1, cpX, drawProgress),
      lerp(a.y1, cpY, drawProgress),
      endX, endY
    );
  } else if (curveType === 2) {
    // S-curve - opposite curves at 25% and 75%
    const cp1X = a.x1 + dx * 0.25 + perpX * curveIntensity;
    const cp1Y = a.y1 + dy * 0.25 + perpY * curveIntensity;
    const cp2X = a.x1 + dx * 0.75 - perpX * curveIntensity;
    const cp2Y = a.y1 + dy * 0.75 - perpY * curveIntensity;
    ctx.bezierCurveTo(
      lerp(a.x1, cp1X, drawProgress),
      lerp(a.y1, cp1Y, drawProgress),
      lerp(a.x1, cp2X, drawProgress),
      lerp(a.y1, cp2Y, drawProgress),
      endX, endY
    );
  } else {
    // Wave (type 3) - three inflection points for wavy look
    const waveAmt = curveIntensity * 0.7;
    // Use path with multiple segments for true wave
    const seg1EndX = a.x1 + dx * 0.33;
    const seg1EndY = a.y1 + dy * 0.33;
    const seg2EndX = a.x1 + dx * 0.66;
    const seg2EndY = a.y1 + dy * 0.66;
    
    // First wave crest (up)
    const cp1X = a.x1 + dx * 0.17 + perpX * waveAmt;
    const cp1Y = a.y1 + dy * 0.17 + perpY * waveAmt;
    // Second wave trough (down)  
    const cp2X = a.x1 + dx * 0.5 - perpX * waveAmt;
    const cp2Y = a.y1 + dy * 0.5 - perpY * waveAmt;
    // Third wave crest (up)
    const cp3X = a.x1 + dx * 0.83 + perpX * waveAmt;
    const cp3Y = a.y1 + dy * 0.83 + perpY * waveAmt;
    
    // Draw as connected quadratic curves for wave effect
    ctx.quadraticCurveTo(
      lerp(a.x1, cp1X, drawProgress),
      lerp(a.y1, cp1Y, drawProgress),
      lerp(a.x1, seg1EndX, drawProgress),
      lerp(a.y1, seg1EndY, drawProgress)
    );
    ctx.quadraticCurveTo(
      lerp(a.x1, cp2X, drawProgress),
      lerp(a.y1, cp2Y, drawProgress),
      lerp(a.x1, seg2EndX, drawProgress),
      lerp(a.y1, seg2EndY, drawProgress)
    );
    ctx.quadraticCurveTo(
      lerp(a.x1, cp3X, drawProgress),
      lerp(a.y1, cp3Y, drawProgress),
      endX, endY
    );
  }
  
  ctx.stroke();
  
  // Optional arrowhead - calculate tangent at end for proper angle
  if (a.arrow && p > 0.9) {
    let angle;
    if (curveType === 0 || curveType === 1) {
      // Quadratic curve - tangent towards end
      const cpX = midX + (curveType === 0 ? 1 : -1) * perpX * curveIntensity;
      const cpY = midY + (curveType === 0 ? 1 : -1) * perpY * curveIntensity;
      angle = Math.atan2(a.y2 - cpY, a.x2 - cpX);
    } else {
      // Bezier - approximate tangent
      angle = Math.atan2(dy, dx);
    }
    
    const arrowSize = 8;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - arrowSize * Math.cos(angle - Math.PI / 6),
      endY - arrowSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - arrowSize * Math.cos(angle + Math.PI / 6),
      endY - arrowSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  }
  
  resetStyles();
}

/* ========================================================== */
/* PRIMITIVE: ROUNDED RECTANGLE (Surface)                     */
/* ========================================================== */

function drawRect(a, p) {
  // Animation: fade + subtle scale (0.97 → 1.0) + slight Y slide
  const fadeIn = Math.min(1, p * 2);
  const scaleProgress = ease(p, "easeOut");
  const currentScale = 0.97 + 0.03 * scaleProgress;
  const slideY = (1 - scaleProgress) * 8;
  
  ctx.globalAlpha = fadeIn;
  
  const x = a.x;
  const y = a.y + slideY;
  const w = a.w;
  const h = a.h;
  // Ensure radius is non-negative and does not exceed half of width/height
  const r = Math.max(0, Math.min(a.r || 12, Math.abs(w) / 2, Math.abs(h) / 2));
  
  // Center transform for scale
  const cx = x + w / 2;
  const cy = y + h / 2;
  
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(currentScale, currentScale);
  ctx.translate(-cx, -cy);
  
  // Draw rounded rect path
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  
  // Fill: explicit fills stay solid, default surface uses subtle gradient.
  if (a.fill !== false) {
    if (typeof a.fill === "string") {
      ctx.fillStyle = a.fill;
    } else {
      const rectGrad = ctx.createRadialGradient(
        x + w * 0.5,
        y + h * 0.3,
        0,
        x + w * 0.5,
        y + h * 0.5,
        Math.max(w, h) * 0.9
      );
      rectGrad.addColorStop(0, theme.surfaceGradientStart);
      rectGrad.addColorStop(1, theme.surfaceGradientEnd);
      ctx.fillStyle = rectGrad;
    }
    ctx.fill();
  }
  
  // Border
  if (a.stroke !== false) {
    ctx.strokeStyle = a.stroke || theme.surfaceBorder;
    ctx.lineWidth = a.strokeWidth || 1.5;
    ctx.stroke();
  }
  
  ctx.restore();
  resetStyles();
}

/* ========================================================== */
/* PRIMITIVE: ELLIPSE / CIRCLE                                */
/* ========================================================== */

function drawEllipse(a, p) {
  // Animation: fade + scale
  const fadeIn = Math.min(1, p * 2);
  const scaleProgress = ease(p, "easeOut");
  const currentScale = 0.95 + 0.05 * scaleProgress;
  
  ctx.globalAlpha = fadeIn;
  
  ctx.save();
  ctx.translate(a.cx, a.cy);
  ctx.scale(currentScale, currentScale);
  ctx.translate(-a.cx, -a.cy);
  
  ctx.beginPath();
  ctx.ellipse(a.cx, a.cy, a.rx, a.ry, 0, 0, Math.PI * 2);
  
  if (a.fill !== false) {
    ctx.fillStyle = a.fill || theme.surface;
    ctx.fill();
  }
  
  if (a.stroke !== false) {
    ctx.strokeStyle = a.stroke || theme.surfaceBorder;
    ctx.lineWidth = a.strokeWidth || 1.5;
    ctx.stroke();
  }
  
  ctx.restore();
  resetStyles();
}

/* ========================================================== */
/* PRIMITIVE: PATH (for complex connectors)                   */
/* ========================================================== */

function drawPath(a, p) {
  const fadeIn = Math.min(1, p * 2);
  const drawProgress = ease(p, "easeOut");
  
  ctx.globalAlpha = fadeIn;
  ctx.strokeStyle = a.stroke || theme.connector;
  ctx.lineWidth = a.strokeWidth || 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  
  // Dashed or solid
  if (a.dashed) {
    const dashLen = a.dashLength || 8;
    const gapLen = a.dashGap || 6;
    ctx.setLineDash([dashLen, gapLen]);
  }
  
  const path = new Path2D(a.d);
  const totalLen = Math.max(W, H) * 2;
  
  ctx.setLineDash([totalLen]);
  ctx.lineDashOffset = totalLen * (1 - drawProgress);
  ctx.stroke(path);
  
  // Fill only when complete
  if (a.fill && p > 0.95) {
    ctx.globalAlpha = fadeIn * 0.9;
    ctx.fillStyle = a.fill;
    ctx.fill(path);
  }
  
  resetStyles();
}

/* ========================================================== */
/* PRIMITIVE: TEXT                                            */
/* ========================================================== */

function drawText(a, p) {
  // Animation: fade + slight slide up
  const fadeIn = Math.min(1, p * 2.5);
  const slideProgress = ease(p, "easeOut");
  const slideY = (1 - slideProgress) * 10;
  
  ctx.globalAlpha = fadeIn;
  
  const fontSize = getFontSize(a.fontSize || a.size);
  const fontWeight = a.fontWeight || (a.size === "title" ? 600 : 400);
  
  const fontFamily = a.monospace ? "'JetBrains Mono', monospace" : "'Inter', 'Helvetica Neue', Arial, sans-serif";
  ctx.font = fontWeight + " " + fontSize + "px " + fontFamily;
  ctx.textAlign = a.align || "center";
  ctx.textBaseline = a.baseline || "middle";
  ctx.fillStyle = a.fill || theme.textPrimary;
  
  // For longer text, reveal character by character
  let displayText = a.value;
  if (a.typewriter !== false && a.value.length > 3) {
    const charCount = Math.max(1, Math.floor(a.value.length * ease(p, "easeOut")));
    displayText = a.value.slice(0, charCount);
  }
  
  ctx.fillText(displayText, a.x, a.y - slideY);
  
  resetStyles();
}

/* ========================================================== */
/* PRIMITIVE: CODE BLOCK                                      */
/* ========================================================== */

function drawCodeBlock(a, p) {
  const reveal = ease(p, "easeOut");
  const fadeIn = Math.min(1, p * 2);
  const x = a.x;
  const y = a.y;
  const w = a.w;
  const h = a.h;
  const darkTheme = a.theme !== "light";
  const headerH = Math.max(26, Math.round(h * 0.12));
  const padding = Math.max(10, Math.round(h * 0.06));
  const fontSize = a.fontSize || (IS_SHORTS ? 24 : 16);
  const lineHeight = Math.max(fontSize + 6, fontSize * 1.35);
  const lines = Array.isArray(a.lines) ? a.lines : [];
  const maxVisible = Math.max(1, a.maxVisibleLines || lines.length || 1);
  const visibleLines = Math.min(maxVisible, Math.max(1, Math.floor(lines.length * reveal)));
  const baseFill = darkTheme ? "#0F172A" : "#F8FAFC";
  const baseStroke = darkTheme ? "#1E293B" : "#CBD5E1";

  ctx.globalAlpha = fadeIn;
  roundedRectPath(x, y, w, h, 14);
  ctx.fillStyle = baseFill;
  ctx.fill();
  ctx.strokeStyle = baseStroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  roundedRectPath(x, y, w, headerH, 14);
  ctx.fillStyle = darkTheme ? "#111827" : "#E2E8F0";
  ctx.fill();

  // Traffic lights style dots for familiar editor framing.
  const dotY = y + headerH / 2;
  ["#EF4444", "#F59E0B", "#10B981"].forEach((c, i) => {
    ctx.beginPath();
    ctx.fillStyle = c;
    ctx.arc(x + 16 + i * 14, dotY, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  if (a.language) {
    ctx.fillStyle = darkTheme ? "#93C5FD" : "#1D4ED8";
    ctx.font = "600 " + (IS_SHORTS ? 16 : 12) + "px 'Inter', sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(String(a.language).toUpperCase(), x + w - 12, dotY);
  }

  const codeX = x + padding;
  const codeY = y + headerH + padding;
  const keyword = /\b(const|let|var|return|if|else|for|while|await|async|function|class|import|from|try|catch|throw|new)\b/g;

  for (let i = 0; i < visibleLines; i++) {
    const rawLine = String(lines[i] || "");
    const lineY = codeY + i * lineHeight;
    if (lineY > y + h - padding) break;

    if (a.highlightLine !== undefined && i === a.highlightLine) {
      ctx.fillStyle = darkTheme ? "rgba(59,130,246,0.22)" : "rgba(191,219,254,0.7)";
      roundedRectPath(x + 8, lineY - lineHeight * 0.72, w - 16, lineHeight, 8);
      ctx.fill();
    }

    let offsetX = codeX;
    if (a.showLineNumbers !== false) {
      ctx.font = "500 " + fontSize + "px 'JetBrains Mono', monospace";
      ctx.fillStyle = darkTheme ? "#64748B" : "#94A3B8";
      ctx.textAlign = "right";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(String(i + 1), codeX + 24, lineY);
      offsetX += 36;
    }

    const tokens = rawLine.split(keyword);
    let cursorX = offsetX;
    tokens.forEach(part => {
      if (!part) return;
      const isKeyword = keyword.test(part);
      keyword.lastIndex = 0;
      const isString = /^['\"].*['\"]$/.test(part.trim());
      ctx.font = "500 " + fontSize + "px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      if (isKeyword) ctx.fillStyle = darkTheme ? "#C084FC" : "#6D28D9";
      else if (isString) ctx.fillStyle = darkTheme ? "#86EFAC" : "#166534";
      else ctx.fillStyle = darkTheme ? "#E2E8F0" : "#0F172A";
      ctx.fillText(part, cursorX, lineY);
      cursorX += ctx.measureText(part).width;
    });
  }

  if (a.cursor !== false && lines.length > 0) {
    const blinkOn = Math.floor(CURRENT_TIME * 2) % 2 === 0;
    if (blinkOn) {
      const cursorLine = Math.max(0, visibleLines - 1);
      const text = String(lines[cursorLine] || "");
      const prefix = a.showLineNumbers === false ? codeX : codeX + 36;
      ctx.font = "500 " + fontSize + "px 'JetBrains Mono', monospace";
      const cursorX = prefix + ctx.measureText(text).width + 2;
      const cursorY = codeY + cursorLine * lineHeight;
      ctx.strokeStyle = darkTheme ? "#93C5FD" : "#1D4ED8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cursorX, cursorY - fontSize);
      ctx.lineTo(cursorX, cursorY + 2);
      ctx.stroke();
    }
  }

  resetStyles();
}

/* ========================================================== */
/* PRIMITIVE: PROGRESS BAR                                    */
/* ========================================================== */

function drawProgressBar(a, p) {
  const reveal = ease(p, "easeOut");
  const max = Math.max(1, a.max || 100);
  const targetRatio = clamp((a.value || 0) / max, 0, 1);
  const currentRatio = targetRatio * reveal;
  const r = a.r || Math.min(14, a.h / 2);
  const fillW = Math.max(0, a.w * currentRatio);

  roundedRectPath(a.x, a.y, a.w, a.h, r);
  ctx.fillStyle = a.trackFill || "#E2E8F0";
  ctx.fill();
  if (a.stroke !== false) {
    ctx.strokeStyle = a.stroke || "#CBD5E1";
    ctx.lineWidth = a.strokeWidth || 1.5;
    ctx.stroke();
  }

  if (a.fill !== false && fillW > 0) {
    roundedRectPath(a.x, a.y, fillW, a.h, r);
    ctx.fillStyle = a.fill || theme.accent;
    ctx.fill();
  }

  const percent = Math.round(currentRatio * 100);
  ctx.font = "600 " + (IS_SHORTS ? 22 : 16) + "px 'Inter', sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = theme.textSecondary;
  ctx.fillText(percent + "%", a.x + a.w, a.y - 10);

  if (a.label) {
    ctx.textAlign = "left";
    ctx.fillStyle = theme.textPrimary;
    ctx.fillText(a.label, a.x, a.y - 10);
  }

  resetStyles();
}

/* ========================================================== */
/* PRIMITIVE: BADGE / CHIP                                    */
/* ========================================================== */

function drawBadge(a, p) {
  const reveal = ease(p, "easeOut");
  const fontSize = a.fontSize || (IS_SHORTS ? 22 : 15);
  const paddingX = a.paddingX || Math.round(fontSize * 0.7);
  const paddingY = a.paddingY || Math.round(fontSize * 0.42);
  const text = String(a.value || "");
  const style = a.style || "neutral";
  const styleMap = {
    neutral: { fill: "#E5E7EB", stroke: "#CBD5E1", text: "#334155" },
    accent: { fill: "#E0E7FF", stroke: "#A5B4FC", text: "#3730A3" },
    warning: { fill: "#FEF3C7", stroke: "#F59E0B", text: "#92400E" },
    success: { fill: "#DCFCE7", stroke: "#22C55E", text: "#166534" },
    danger: { fill: "#FEE2E2", stroke: "#EF4444", text: "#991B1B" }
  };
  const colors = styleMap[style] || styleMap.neutral;

  ctx.font = (a.fontWeight || 600) + " " + fontSize + "px 'Inter', sans-serif";
  const textWidth = ctx.measureText(text).width;
  const iconExtra = a.icon ? fontSize * 1.15 : 0;
  const w = textWidth + paddingX * 2 + iconExtra;
  const h = fontSize + paddingY * 2;
  const x = a.x;
  const y = a.y;

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(0.96 + 0.04 * reveal, 0.96 + 0.04 * reveal);
  ctx.translate(-(x + w / 2), -(y + h / 2));

  roundedRectPath(x, y, w, h, h / 2);
  ctx.fillStyle = a.fill || colors.fill;
  ctx.fill();
  ctx.strokeStyle = a.stroke || colors.stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  let textX = x + paddingX;
  if (a.icon) {
    drawIcon({ x: x + paddingX + fontSize * 0.45, y: y + h / 2, name: a.icon, size: fontSize * 0.8, stroke: colors.text, strokeWidth: 2 }, 1);
    textX += iconExtra;
  }

  ctx.fillStyle = a.textColor || colors.text;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, textX, y + h / 2);

  ctx.restore();
  resetStyles();
}

/* ========================================================== */
/* PRIMITIVE: ICON                                            */
/* ========================================================== */

function drawIcon(a, p) {
  const reveal = ease(p, "easeOut");
  const size = a.size || (IS_SHORTS ? 44 : 28);
  const pathData = ICON_PATHS[a.name] || ICON_PATHS.info;
  const iconPath = new Path2D(pathData);

  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.scale((size / 24) * (0.9 + 0.1 * reveal), (size / 24) * (0.9 + 0.1 * reveal));
  ctx.translate(-12, -12);

  if (a.fill && a.fill !== false) {
    ctx.fillStyle = a.fill;
    ctx.fill(iconPath);
  }

  ctx.strokeStyle = a.stroke || theme.accent;
  ctx.lineWidth = a.strokeWidth || 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(iconPath);
  ctx.restore();
  resetStyles();
}

/* ========================================================== */
/* PRIMITIVE: TABLE                                           */
/* ========================================================== */

function drawTable(a, p) {
  const reveal = ease(p, "easeOut");
  const headers = Array.isArray(a.headers) ? a.headers : [];
  const rows = Array.isArray(a.rows) ? a.rows : [];
  const cols = Math.max(1, headers.length || (rows[0] ? rows[0].length : 1));
  const rowCount = Math.max(1, rows.length + 1);
  const colW = a.w / cols;
  const rowH = a.h / rowCount;
  const visibleRows = Math.max(1, Math.floor((rows.length + 1) * reveal));
  const fontSize = a.fontSize || (IS_SHORTS ? 20 : 14);

  roundedRectPath(a.x, a.y, a.w, a.h, 10);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = a.gridStroke || "#CBD5E1";
  ctx.lineWidth = 1;
  ctx.stroke();

  roundedRectPath(a.x, a.y, a.w, rowH, 10);
  ctx.fillStyle = a.headerFill || "#E2E8F0";
  ctx.fill();

  for (let r = 1; r < Math.min(rowCount, visibleRows); r++) {
    if (a.striped !== false && r % 2 === 0) {
      ctx.fillStyle = "rgba(148,163,184,0.08)";
      ctx.fillRect(a.x, a.y + r * rowH, a.w, rowH);
    }
  }

  ctx.strokeStyle = a.gridStroke || "#CBD5E1";
  for (let c = 1; c < cols; c++) {
    const x = a.x + c * colW;
    ctx.beginPath();
    ctx.moveTo(x, a.y);
    ctx.lineTo(x, a.y + a.h);
    ctx.stroke();
  }
  for (let r = 1; r < Math.min(rowCount, visibleRows); r++) {
    const y = a.y + r * rowH;
    ctx.beginPath();
    ctx.moveTo(a.x, y);
    ctx.lineTo(a.x + a.w, y);
    ctx.stroke();
  }

  const align = a.align || "left";
  ctx.font = "600 " + fontSize + "px 'Inter', sans-serif";
  ctx.fillStyle = a.textColor || "#0F172A";
  ctx.textBaseline = "middle";
  for (let c = 0; c < cols; c++) {
    const text = String(headers[c] || "");
    const cellX = a.x + c * colW;
    const tx = align === "center" ? cellX + colW / 2 : align === "right" ? cellX + colW - 10 : cellX + 10;
    ctx.textAlign = align;
    ctx.fillText(text, tx, a.y + rowH / 2);
  }

  ctx.font = "500 " + fontSize + "px 'Inter', sans-serif";
  for (let r = 0; r < Math.min(rows.length, visibleRows - 1); r++) {
    for (let c = 0; c < cols; c++) {
      const text = String((rows[r] && rows[r][c]) || "");
      const cellX = a.x + c * colW;
      const cy = a.y + (r + 1) * rowH + rowH / 2;
      const tx = align === "center" ? cellX + colW / 2 : align === "right" ? cellX + colW - 10 : cellX + 10;
      ctx.textAlign = align;
      ctx.fillText(text, tx, cy);
    }
  }

  resetStyles();
}

/* ========================================================== */
/* PRIMITIVE: NUMBER COUNTER                                  */
/* ========================================================== */

function drawNumberCounter(a, p) {
  const reveal = ease(p, "easeOut");
  const n = lerp(a.from || 0, a.to || 0, reveal);
  const display = (a.prefix || "") + formatNumber(n, a.decimals) + (a.suffix || "");
  const fontSize = getFontSize(a.fontSize || a.size || "title");
  const fontWeight = a.fontWeight || 700;

  ctx.font = fontWeight + " " + fontSize + "px 'Inter', sans-serif";
  ctx.textAlign = a.align || "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = a.fill || theme.accent;
  ctx.fillText(display, a.x, a.y);
  resetStyles();
}

/* ========================================================== */
/* PRIMITIVE: HIGHLIGHT                                       */
/* ========================================================== */

function drawHighlight(a, p) {
  const reveal = ease(p, "easeOut");
  const opacity = clamp((a.opacity !== undefined ? a.opacity : 0.35) * reveal, 0, 1);
  const fill = a.fill || "#FDE68A";

  ctx.globalAlpha = opacity;
  ctx.fillStyle = fill;

  if (a.style === "underline") {
    const underlineH = Math.max(4, Math.min(14, a.h || 8));
    roundedRectPath(a.x, a.y + (a.h || underlineH) - underlineH, a.w, underlineH, underlineH / 2);
    ctx.fill();
  } else {
    roundedRectPath(a.x, a.y, a.w, a.h, a.r || 8);
    ctx.fill();
  }

  resetStyles();
}

/* ========================================================== */
/* PRIMITIVE: TRANSFORM GROUP                                 */
/* ========================================================== */

function drawTransform(a, p) {
  ctx.save();
  
  const progress = ease(p, "easeOut");
  
  if (a.translate) {
    ctx.translate(
      a.translate[0] * progress,
      a.translate[1] * progress
    );
  }
  
  if (a.children) {
    a.children.forEach(child => draw(child, p));
  }
  
  ctx.restore();
  resetStyles();
}

/* ========================================================== */
/* PRIMITIVE: GROUP                                           */
/* ========================================================== */

function drawGroup(a, p) {
  if (a.children) {
    a.children.forEach(child => draw(child, p));
  }
}

/* ========================================================== */
/* DISPATCH                                                   */
/* ========================================================== */

function draw(a, p) {
  switch (a.op) {
    case "line": return drawLine(a, p);
    case "rect": return drawRect(a, p);
    case "ellipse": return drawEllipse(a, p);
    case "path": return drawPath(a, p);
    case "text": return drawText(a, p);
    case "codeBlock": return drawCodeBlock(a, p);
    case "progressBar": return drawProgressBar(a, p);
    case "badge": return drawBadge(a, p);
    case "icon": return drawIcon(a, p);
    case "table": return drawTable(a, p);
    case "numberCounter": return drawNumberCounter(a, p);
    case "highlight": return drawHighlight(a, p);
    case "group": return drawGroup(a, p);
    case "transform": return drawTransform(a, p);
  }
}

/* ========================================================== */
/* FRAME ENTRY POINT                                          */
/* ========================================================== */

window.renderFrame = function(time) {
  CURRENT_TIME = time;
  drawBackground();
  
  // Render all actions at their scheduled times
  for (const a of actions) {
    if (time < a.t) continue;
    if (a.op === "text" && a.endT !== undefined && time > a.endT) continue;
    
    const duration = a.dur || scale.baseDuration;
    const raw = Math.min(1, (time - a.t) / duration);
    const p = ease(raw, a.easing || "easeOut");
    
    draw(a, p);
  }
};

</script>
</body>
</html>
`;
  }
}
