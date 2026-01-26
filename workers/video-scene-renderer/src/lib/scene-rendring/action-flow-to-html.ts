import { ActionIR } from "../../types";

type SceneHtmlRendererInput = {
  duration: number;
  actions: ActionIR[];
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

const canvas = document.getElementById("c");
canvas.width = W * DPR;
canvas.height = H * DPR;
canvas.style.width = W + "px";
canvas.style.height = H + "px";

const ctx = canvas.getContext("2d");
ctx.scale(DPR, DPR);

/* ------------------- THEME & COLORS ------------------- */
const theme = {
  bg: { start: "#0f0f23", end: "#1a1a3e" },
  accent: "#6366f1",
  accentAlt: "#8b5cf6",
  glow: "rgba(99, 102, 241, 0.4)",
  text: "#f8fafc",
  textMuted: "#94a3b8",
  stroke: "#e2e8f0",
  surface: "rgba(255, 255, 255, 0.05)"
};

/* ------------------- PARTICLES ------------------- */
const particles = [];
const PARTICLE_COUNT = 35;

for (let i = 0; i < PARTICLE_COUNT; i++) {
  particles.push({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 2 + 0.5,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    alpha: Math.random() * 0.3 + 0.1,
    pulse: Math.random() * Math.PI * 2
  });
}

function updateParticles(time) {
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.pulse += 0.02;
    
    if (p.x < 0) p.x = W;
    if (p.x > W) p.x = 0;
    if (p.y < 0) p.y = H;
    if (p.y > H) p.y = 0;
  }
}

function drawParticles(time) {
  for (const p of particles) {
    const alpha = p.alpha * (0.5 + 0.5 * Math.sin(p.pulse));
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(99, 102, 241, " + alpha + ")";
    ctx.fill();
  }
}

/* ------------------- BACKGROUND ------------------- */
function drawBackground(time) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, theme.bg.start);
  grad.addColorStop(1, theme.bg.end);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  
  // Subtle grid pattern
  ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
  ctx.lineWidth = 1;
  const gridSize = 50;
  for (let x = 0; x < W; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  
  // Animated gradient orbs
  const orbX = W * 0.7 + Math.sin(time * 0.5) * 50;
  const orbY = H * 0.3 + Math.cos(time * 0.3) * 30;
  const orbGrad = ctx.createRadialGradient(orbX, orbY, 0, orbX, orbY, 250);
  orbGrad.addColorStop(0, "rgba(139, 92, 246, 0.15)");
  orbGrad.addColorStop(0.5, "rgba(99, 102, 241, 0.05)");
  orbGrad.addColorStop(1, "transparent");
  ctx.fillStyle = orbGrad;
  ctx.fillRect(0, 0, W, H);
  
  const orbX2 = W * 0.2 + Math.cos(time * 0.4) * 40;
  const orbY2 = H * 0.7 + Math.sin(time * 0.6) * 35;
  const orbGrad2 = ctx.createRadialGradient(orbX2, orbY2, 0, orbX2, orbY2, 200);
  orbGrad2.addColorStop(0, "rgba(59, 130, 246, 0.12)");
  orbGrad2.addColorStop(0.5, "rgba(99, 102, 241, 0.04)");
  orbGrad2.addColorStop(1, "transparent");
  ctx.fillStyle = orbGrad2;
  ctx.fillRect(0, 0, W, H);
  
  drawParticles(time);
}

const actions = [
${actionsJS}
].sort((a,b)=>a.t-b.t);

/* ------------------- EASING FUNCTIONS ------------------- */
function ease(p, type) {
  switch(type) {
    case "easeIn": return p * p * p;
    case "easeOut": return 1 - Math.pow(1 - p, 3);
    case "easeInOut": return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    case "spring": {
      const c4 = (2 * Math.PI) / 3;
      return p === 0 ? 0 : p === 1 ? 1 : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * c4) + 1;
    }
    case "bounce": {
      const n1 = 7.5625, d1 = 2.75;
      if (p < 1/d1) return n1*p*p;
      if (p < 2/d1) return n1*(p-=1.5/d1)*p+0.75;
      if (p < 2.5/d1) return n1*(p-=2.25/d1)*p+0.9375;
      return n1*(p-=2.625/d1)*p+0.984375;
    }
    default: return p;
  }
}

function smoothStep(p) {
  return p * p * (3 - 2 * p);
}

/* ------------------- GLOW EFFECTS ------------------- */
function setGlow(color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function clearGlow() {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
}

/* ------------------- PRIMITIVE DRAWERS ------------------- */

function applyStrokeFill(a, p) {
  const alpha = smoothStep(Math.min(1, p * 1.5));
  
  if (a.stroke) {
    ctx.strokeStyle = a.stroke;
    setGlow(a.stroke, 8 * alpha);
  } else {
    ctx.strokeStyle = theme.stroke;
    setGlow(theme.glow, 6 * alpha);
  }
  
  if (a.strokeWidth) ctx.lineWidth = a.strokeWidth;
  else ctx.lineWidth = 2.5;
  
  if (a.fill) ctx.fillStyle = a.fill;
  else ctx.fillStyle = theme.surface;
}

function resetStyles() {
  ctx.strokeStyle = theme.stroke;
  ctx.fillStyle = theme.text;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  clearGlow();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  ctx.globalAlpha = 1;
}

function lerp(a, b, p) {
  return a + (b - a) * p;
}

function drawLine(a, p) {
  const fadeIn = smoothStep(Math.min(1, p * 2));
  ctx.globalAlpha = fadeIn;
  
  applyStrokeFill(a, p);
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(a.x1, a.y1);
  ctx.lineTo(
    lerp(a.x1, a.x2, p),
    lerp(a.y1, a.y2, p)
  );
  ctx.stroke();
  
  // Draw end cap glow
  if (p < 1) {
    const endX = lerp(a.x1, a.x2, p);
    const endY = lerp(a.y1, a.y2, p);
    const capGrad = ctx.createRadialGradient(endX, endY, 0, endX, endY, 12);
    capGrad.addColorStop(0, a.stroke || theme.accent);
    capGrad.addColorStop(0.3, "rgba(99, 102, 241, 0.5)");
    capGrad.addColorStop(1, "transparent");
    clearGlow();
    ctx.fillStyle = capGrad;
    ctx.beginPath();
    ctx.arc(endX, endY, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  resetStyles();
}

function drawRect(a, p) {
  const fadeIn = smoothStep(Math.min(1, p * 2));
  const scale = 0.95 + 0.05 * smoothStep(p);
  ctx.globalAlpha = fadeIn;
  
  applyStrokeFill(a, p);

  const x = a.x;
  const y = a.y;
  const w = a.w;
  const h = a.h;
  const r = Math.min(a.r || 8, w / 2, h / 2);

  // Center transform for scale animation
  const cx = x + w / 2;
  const cy = y + h / 2;
  
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);

  const straightW = w - 2 * r;
  const straightH = h - 2 * r;
  const arcLen = Math.PI * r / 2;
  const perimeter = 2 * straightW + 2 * straightH + 4 * arcLen;

  let len = perimeter * p;

  ctx.beginPath();
  ctx.moveTo(x + r, y);

  if (len <= straightW) {
    ctx.lineTo(x + r + len, y);
    ctx.stroke();
    ctx.restore();
    resetStyles();
    return;
  }
  ctx.lineTo(x + r + straightW, y);
  len -= straightW;

  if (len <= arcLen) {
    ctx.arc(x + w - r, y + r, r, -Math.PI / 2, -Math.PI / 2 + (len / arcLen) * (Math.PI / 2));
    ctx.stroke();
    ctx.restore();
    resetStyles();
    return;
  }
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  len -= arcLen;

  if (len <= straightH) {
    ctx.lineTo(x + w, y + r + len);
    ctx.stroke();
    ctx.restore();
    resetStyles();
    return;
  }
  ctx.lineTo(x + w, y + r + straightH);
  len -= straightH;

  if (len <= arcLen) {
    ctx.arc(x + w - r, y + h - r, r, 0, (len / arcLen) * (Math.PI / 2));
    ctx.stroke();
    ctx.restore();
    resetStyles();
    return;
  }
  ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  len -= arcLen;

  if (len <= straightW) {
    ctx.lineTo(x + w - r - len, y + h);
    ctx.stroke();
    ctx.restore();
    resetStyles();
    return;
  }
  ctx.lineTo(x + r, y + h);
  len -= straightW;

  if (len <= arcLen) {
    ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI / 2 + (len / arcLen) * (Math.PI / 2));
    ctx.stroke();
    ctx.restore();
    resetStyles();
    return;
  }
  ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  len -= arcLen;

  if (len <= straightH) {
    ctx.lineTo(x, y + h - r - len);
    ctx.stroke();
    ctx.restore();
    resetStyles();
    return;
  }
  ctx.lineTo(x, y + r);
  len -= straightH;

  if (len <= arcLen) {
    ctx.arc(x + r, y + r, r, Math.PI, Math.PI + (len / arcLen) * (Math.PI / 2));
    ctx.stroke();
    ctx.restore();
    resetStyles();
    return;
  }

  ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  ctx.closePath();
  ctx.stroke();

  if (a.fill) {
    clearGlow();
    ctx.globalAlpha = fadeIn * 0.8;
    ctx.fill();
  }
  
  ctx.restore();
  resetStyles();
}

function drawEllipse(a, p) {
  const fadeIn = smoothStep(Math.min(1, p * 2));
  const scale = 0.9 + 0.1 * smoothStep(p);
  ctx.globalAlpha = fadeIn;
  
  applyStrokeFill(a, p);

  ctx.save();
  ctx.translate(a.cx, a.cy);
  ctx.scale(scale, scale);
  ctx.translate(-a.cx, -a.cy);

  ctx.beginPath();
  ctx.ellipse(
    a.cx,
    a.cy,
    a.rx,
    a.ry,
    0,
    0,
    Math.PI * 2 * p
  );

  if (a.fill && p > 0.98) {
    clearGlow();
    ctx.globalAlpha = fadeIn * 0.7;
    ctx.fill();
    ctx.globalAlpha = fadeIn;
    setGlow(a.stroke || theme.glow, 8);
  }
  ctx.stroke();

  ctx.restore();
  resetStyles();
}

function drawPath(a, p) {
  const fadeIn = smoothStep(Math.min(1, p * 2));
  ctx.globalAlpha = fadeIn;
  
  applyStrokeFill(a, p);

  const path = new Path2D(a.d);
  const dash = Math.max(W, H) * 2;

  ctx.setLineDash([dash]);
  ctx.lineDashOffset = dash * (1 - p);

  if (a.fill && p > 0.95) {
    clearGlow();
    ctx.globalAlpha = fadeIn * 0.6;
    ctx.fill(path);
    ctx.globalAlpha = fadeIn;
    setGlow(a.stroke || theme.glow, 8);
  }

  ctx.stroke(path);

  resetStyles();
}

function drawText(a, p) {
  const fadeIn = smoothStep(Math.min(1, p * 3));
  const slideUp = (1 - smoothStep(p)) * 15;
  
  ctx.save();
  ctx.globalAlpha = fadeIn;
  
  const fontSize = a.fontSize || 32;
  const fontWeight = a.fontWeight || 600;
  ctx.font = fontWeight + " " + fontSize + "px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
  ctx.textAlign = a.align || "center";
  ctx.textBaseline = "middle";
  
  if (a.fill) {
    ctx.fillStyle = a.fill;
    setGlow(a.fill, 12 * fadeIn);
  } else {
    ctx.fillStyle = theme.text;
    setGlow("rgba(248, 250, 252, 0.5)", 10 * fadeIn);
  }

  const n = Math.max(1, Math.floor(a.value.length * smoothStep(p)));
  const displayText = a.value.slice(0, n);
  
  // Draw text with subtle shadow
  ctx.fillText(displayText, a.x, a.y - slideUp);
  
  // Typing cursor effect
  if (p < 1 && n < a.value.length) {
    const textWidth = ctx.measureText(displayText).width;
    let cursorX = a.x;
    if (a.align === "center") cursorX = a.x + textWidth / 2 + 4;
    else if (a.align === "left") cursorX = a.x + textWidth + 4;
    else cursorX = a.x + 4;
    
    ctx.fillStyle = theme.accent;
    setGlow(theme.accent, 8);
    ctx.fillRect(cursorX, a.y - slideUp - fontSize * 0.4, 3, fontSize * 0.8);
  }

  ctx.restore();
  resetStyles();
}

function drawTransform(a, p) {
  ctx.save();

  if (a.translate) {
    ctx.translate(
      a.translate[0] * smoothStep(p),
      a.translate[1] * smoothStep(p)
    );
  }

  a.children.forEach(c => draw(c, p));

  ctx.restore();
  resetStyles();
}

function drawGroup(a, p) {
  a.children.forEach(c => draw(c, p));
}

/* ------------------- DISPATCH ------------------- */

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

/* ------------------- FRAME ENTRY ------------------- */

window.renderFrame = function(time) {
  updateParticles(time);
  drawBackground(time);

  for (const a of actions) {
    if (time < a.t) continue;
    if (a.op === "text" && a.endT !== undefined && time > a.endT) continue;

    const raw = Math.min(1, (time - a.t) / a.dur);
    const p = ease(raw, a.easing);
    draw(a, p);
  }
};

</script>
</body>
</html>
`;
  }
}
