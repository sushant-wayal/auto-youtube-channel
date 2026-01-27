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
  body { margin:0; background:#fafafa }
  canvas { display:block }
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
const canvas = document.getElementById("c");
canvas.width = ${width};
canvas.height = ${height};
const ctx = canvas.getContext("2d");

ctx.strokeStyle = "#111";
ctx.fillStyle = "#111";
ctx.lineWidth = 2;
ctx.font = "28px Arial";

const actions = [
${actionsJS}
].sort((a,b)=>a.t-b.t);

function ease(p, type) {
  switch(type) {
    case "easeIn": return p*p;
    case "easeOut": return p*(2-p);
    case "easeInOut": return p < 0.5 ? 2*p*p : 1 - Math.pow(-2*p+2,2)/2;
    default: return p;
  }
}

/* ------------------- PRIMITIVE DRAWERS ------------------- */

function applyStrokeFill(a) {
  if (a.stroke) ctx.strokeStyle = a.stroke;
  if (a.strokeWidth) ctx.lineWidth = a.strokeWidth;
  if (a.fill) ctx.fillStyle = a.fill;
}

function resetStyles() {
  ctx.strokeStyle = "#111";
  ctx.fillStyle = "#111";
  ctx.lineWidth = 2;
}

function lerp(a, b, p) {
  return a + (b - a) * p;
}

function drawLine(a, p) {
  
  applyStrokeFill(a);

  ctx.beginPath();
  ctx.moveTo(a.x1, a.y1);
  ctx.lineTo(
    lerp(a.x1, a.x2, p),
    lerp(a.y1, a.y2, p)
  );
  ctx.stroke();

  resetStyles()
}

function drawRect(a, p) {
  
  applyStrokeFill(a);

  const x = a.x;
  const y = a.y;
  const w = a.w;
  const h = a.h;
  const r = Math.min(a.r || 0, w / 2, h / 2);

  // lengths
  const straightW = w - 2 * r;
  const straightH = h - 2 * r;
  const arcLen = Math.PI * r / 2;

  const perimeter =
    2 * straightW +
    2 * straightH +
    4 * arcLen;

  let len = perimeter * p;

  ctx.beginPath();
  ctx.moveTo(x + r, y);

  // ─── Top edge ───
  if (len <= straightW) {
    ctx.lineTo(x + r + len, y);
    ctx.stroke();
    return;
  }
  ctx.lineTo(x + r + straightW, y);
  len -= straightW;

  // ─── Top-right corner ───
  if (len <= arcLen) {
    ctx.arc(x + w - r, y + r, r, -Math.PI / 2, -Math.PI / 2 + (len / arcLen) * (Math.PI / 2));
    ctx.stroke();
    return;
  }
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  len -= arcLen;

  // ─── Right edge ───
  if (len <= straightH) {
    ctx.lineTo(x + w, y + r + len);
    ctx.stroke();
    return;
  }
  ctx.lineTo(x + w, y + r + straightH);
  len -= straightH;

  // ─── Bottom-right corner ───
  if (len <= arcLen) {
    ctx.arc(x + w - r, y + h - r, r, 0, (len / arcLen) * (Math.PI / 2));
    ctx.stroke();
    return;
  }
  ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  len -= arcLen;

  // ─── Bottom edge ───
  if (len <= straightW) {
    ctx.lineTo(x + w - r - len, y + h);
    ctx.stroke();
    return;
  }
  ctx.lineTo(x + r, y + h); 
  len -= straightW;

  // ─── Bottom-left corner ───
  if (len <= arcLen) {
    ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI / 2 + (len / arcLen) * (Math.PI / 2));
    ctx.stroke();
    return;
  }
  ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  len -= arcLen;

  // ─── Left edge ───
  if (len <= straightH) {
    ctx.lineTo(x, y + h - r - len);
    ctx.stroke();
    return;
  }
  ctx.lineTo(x, y + r);
  len -= straightH;

  // ─── Top-left corner ───
  if (len <= arcLen) {
    ctx.arc(x + r, y + r, r, Math.PI, Math.PI + (len / arcLen) * (Math.PI / 2));
    ctx.stroke();
    return;
  }

  ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  ctx.closePath();
  ctx.stroke();

  if (a.fill) ctx.fill();
  resetStyles()
}

function drawEllipse(a, p) {
  
  applyStrokeFill(a);

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

  if (a.fill) ctx.fill();
  ctx.stroke();

  resetStyles()
}

function drawPath(a, p) {
  
  applyStrokeFill(a);

  const path = new Path2D(a.d);
  const dash = Math.max(canvas.width, canvas.height) * 1.5;

  ctx.setLineDash([dash]);
  ctx.lineDashOffset = dash * (1 - p);

  if (a.fill) ctx.fill(path);

  ctx.stroke(path);

  resetStyles()
}

function drawText(a, p) {
  

  if (a.fill) ctx.fillStyle = a.fill;
  else ctx.fillStyle = "#111";
  if (a.fontSize) ctx.font = a.fontSize + "px Arial";
  else ctx.font = "28px Arial";
  ctx.textAlign = a.align || "center";

  const n = Math.max(1, Math.floor(a.value.length * p));
  ctx.fillText(a.value.slice(0, n), a.x, a.y);

  resetStyles()
}

function drawTransform(a, p) {
  ctx.save();

  if (a.translate) {
    ctx.translate(
      a.translate[0] * p,
      a.translate[1] * p
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
  ctx.clearRect(0,0,canvas.width,canvas.height);

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
