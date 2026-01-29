import { ActionIR } from "../../types";

type SceneHtmlRendererInput = {
  duration: number;
  actions: ActionIR[];
  hookText?: string;
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
        { duration: scene.duration, actions: withTextLifetimes, hookText: scene.hookText },
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
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { 
    margin:0; 
    overflow:hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
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

const canvas = document.getElementById("c");
canvas.width = W * DPR;
canvas.height = H * DPR;
canvas.style.width = W + "px";
canvas.style.height = H + "px";

const ctx = canvas.getContext("2d");
ctx.scale(DPR, DPR);

/* ========================================================== */
/* DESIGN SYSTEM - Warm Neutral Palette                       */
/* ========================================================== */

const theme = {
  // Backgrounds
  bg: "#FAFAF9",           // warm white
  surface: "#F5F5F4",      // stone-100
  surfaceBorder: "#E7E5E4", // stone-200
  
  // Text
  textPrimary: "#18181B",   // zinc-900
  textSecondary: "#52525B", // zinc-600
  textMuted: "#A1A1AA",     // zinc-400
  
  // Accent
  accent: "#6366F1",        // indigo-500
  accentSoft: "#E0E7FF",    // indigo-100
  accentBorder: "#A5B4FC",  // indigo-300
  
  // Semantic
  warning: "#F59E0B",       // amber-500
  warningSoft: "#FEF3C7",   // amber-100
  
  // Connectors
  connector: "#A1A1AA",     // zinc-400
  connectorStrong: "#52525B" // zinc-600
};

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

/* ========================================================== */
/* HOOK PHASE (SHORTS ONLY)                                   */
/* ========================================================== */

const HOOK_TEXT = ${scene.hookText ? JSON.stringify(scene.hookText) : 'null'};
const HOOK_DURATION = 1.5;  // Hook phase: 0-1.5s
const HOOK_PAUSE = 0.3;     // Pause after hook: 1.5-1.8s
const HOOK_TOTAL = HOOK_DURATION + HOOK_PAUSE; // 1.8s total

function drawHook(time) {
  if (!HOOK_TEXT || !IS_SHORTS) return false;
  if (time > HOOK_TOTAL) return false;
  
  if (time < HOOK_DURATION) {
    // Phase 1: Hook display (0-1.5s)
    const progress = time / HOOK_DURATION;
    
    // Immediate appearance with subtle motion
    const scale = 1 + (Math.sin(progress * Math.PI * 2) * 0.02);
    const yOffset = Math.sin(progress * Math.PI) * 5;
    
    ctx.save();
    ctx.translate(W / 2, H / 2 + yOffset);
    ctx.scale(scale, scale);
    
    // Draw hookText - large, bold, centered
    ctx.globalAlpha = progress < 0.1 ? progress / 0.1 : 1; // Quick fade in
    ctx.fillStyle = theme.textPrimary;
    ctx.font = "bold " + Math.round(W * 0.08) + "px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // Word wrap for hookText
    const words = HOOK_TEXT.split(' ');
    const lines = [];
    let currentLine = words[0];
    
    for (let i = 1; i < words.length; i++) {
      const testLine = currentLine + ' ' + words[i];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > W * 0.85) {
        lines.push(currentLine);
        currentLine = words[i];
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);
    
    // Draw lines
    const lineHeight = Math.round(W * 0.09);
    const startY = -(lines.length - 1) * lineHeight / 2;
    
    lines.forEach((line, i) => {
      ctx.fillText(line, 0, startY + i * lineHeight);
    });
    
    ctx.restore();
    return true;
  } else {
    // Phase 2: Pause (1.5-1.8s) - blank
    return true;
  }
}

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
  // Base warm white background
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);
  
  // --- GRID LINES (engineering paper feel) ---
  ctx.strokeStyle = "rgba(0, 0, 0, 0.03)";
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
  ctx.fillStyle = "rgba(99, 102, 241, 0.06)"; // Very faint indigo
  for (let x = gridSize; x < W; x += gridSize * 2) {
    for (let y = gridSize; y < H; y += gridSize * 2) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // --- CORNER BRACKETS (code/tech feel) ---
  ctx.strokeStyle = "rgba(99, 102, 241, 0.08)";
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
  ctx.globalAlpha = 0.04;
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
  ctx.globalAlpha = 0.035;
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
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.3)");
  gradient.addColorStop(0.6, "rgba(255, 255, 255, 0)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.015)");
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

function lerp(a, b, p) {
  return a + (b - a) * p;
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
  const r = Math.min(a.r || 12, w / 2, h / 2);
  
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
  
  // Fill (surface color)
  if (a.fill !== false) {
    ctx.fillStyle = a.fill || theme.surface;
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
  
  ctx.font = fontWeight + " " + fontSize + "px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
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
    case "group": return drawGroup(a, p);
    case "transform": return drawTransform(a, p);
  }
}

/* ========================================================== */
/* FRAME ENTRY POINT                                          */
/* ========================================================== */

window.renderFrame = function(time) {
  drawBackground();
  
  // Hook phase for Shorts (first 1.8s)
  if (drawHook(time)) {
    return; // Skip actions during hook phase
  }
  
  // Adjust time for actions to start after hook
  const actionTime = HOOK_TEXT && IS_SHORTS ? Math.max(0, time - HOOK_TOTAL) : time;
  
  for (const a of actions) {
    if (actionTime < a.t) continue;
    if (a.op === "text" && a.endT !== undefined && actionTime > a.endT) continue;
    
    const duration = a.dur || scale.baseDuration;
    const raw = Math.min(1, (actionTime - a.t) / duration);
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
