import { GeminiService } from "@/lib/ai";

export interface SceneHtmlGenerationInput {
  narration: string;
  isShort?: boolean;
  sceneId?: string;
  sceneTitle?: string;
  duration?: number;
}

/** Sound types must match the filenames in workers/video-assembler/src/lib/assests/sfx/ */
export type SfxType =
  | 'whoosh'
  | 'pop'
  | 'chime'
  | 'swipe'
  | 'swoosh'
  | 'typewriter'
  | 'tick'
  | 'expand'
  | 'ping'
  | 'data';

export interface SoundEvent {
  /** Seconds from scene start when the sound's peak should land on the visual beat */
  t: number;
  /** Which SFX to trigger */
  type: SfxType;
  /** 0–1 relative intensity (default 0.7) */
  intensity?: number;
  /** Duration in seconds for continuous sounds like typewriter or data stream */
  duration?: number;
}

export interface SceneHtmlGenerationResult {
  html: string;
  soundEvents?: SoundEvent[];
  storyboard?: SceneStoryboard;
  generationMode: "storyboard" | "direct-html-fallback";
}

export interface StoryboardBeat {
  start: number;
  end: number;
  narrationAnchor: string;
  dramaticPurpose: string;
  visualAction: string;
  composition: string;
  depthAndLighting: string;
  cameraMove: string;
  transition: string;
  onScreenWords: string[];
}

export interface PlannedSoundEvent extends SoundEvent {
  /** Describes the visible moment this peak is meant to punctuate. */
  visualMoment: string;
}

export interface SceneStoryboard {
  visualPremise: string;
  recurringSubject: string;
  visualStyle: string;
  palette: string[];
  beats: StoryboardBeat[];
  soundEvents: PlannedSoundEvent[];
}

const VALID_SFX_TYPES = new Set<SfxType>([
  'whoosh', 'pop', 'chime', 'swipe', 'swoosh', 'typewriter', 'tick', 'expand', 'ping', 'data',
]);

const SFX_GUIDE = `Available sound effects (use only when the pictured action deserves a tactile accent):
- whoosh: a subject travels quickly through space
- pop: a small, crisp object or marker appears
- chime: a resolved, positive state
- swipe: a visible horizontal reveal
- swoosh: a large camera move or scene-scale reveal
- typewriter: text is visibly typed
- tick: a meaningful step or count advances
- expand: a shape visibly grows outward
- ping: a signal or connection point activates
- data: packets or a stream visibly move

SFX mixing contract: t is the desired sound peak / impact moment, aligned with the corresponding visible action. The renderer compensates for each sample's measured attack time. Do not schedule sound at narration syllables unless the visual action also lands there. Use 0–8 deliberate events per scene (usually 2–5), never a constant sound bed, and leave at least 0.20 seconds between events. Keep intensity between 0.25 and 0.70 so effects sit below narration. Only add duration for an intentional short typewriter/data texture, no longer than 1.2 seconds. Avoid sounds under quiet or emotionally serious narration.`;

const STORYBOARD_SYSTEM_PROMPT = `You are the lead visual director for a premium explanatory motion-graphics film. Before any HTML is written, create a compact, executable edit storyboard for this exact narration segment.

The goal is comprehension and sustained visual curiosity through presentation. A viewer should see an idea become a concrete visual event, understand its consequence, and want to see what happens next. Do not solve this with decorative particles, generic dashboard cards, repeated centered icons, or captions that merely restate narration.

For the whole scene, define one visual premise and a recurring subject that can change state. Make the subject specific to the spoken mechanism (for example, one request, thread, packet, key, or object) and carry it through the beats so the scene feels like one visual story.

Create contiguous timed beats that cover the full scene. Aim for a new meaningful visual action every 3–5 seconds; use fewer beats for very short scenes and never exceed 24. Each beat must anchor to an exact short phrase from the narration and specify:
- its dramatic purpose in the visual story;
- a concrete, physically readable action that demonstrates the spoken cause or consequence;
- shot scale/angle and subject placement, using the canvas rather than a tiny center graphic;
- foreground, midground, background, material, and lighting choices that create depth;
- a deliberate camera move and a transition that carries the recurring subject into the next beat;
- at most six short on-screen words, only when a label genuinely helps.

Vary shot scale and composition when the story warrants it, but preserve visual continuity. Use editorial, cinematic 2.5D motion graphics: layered forms, perspective, tactile materials, controlled lighting, precise typography, and purposeful motion. Make it feel authored for this narration, not a reusable SaaS dashboard or a stack of unrelated diagrams. Prefer showing a mechanism over naming it. Avoid long empty areas, tiny labels, edge collisions, accidental overlap, flat arrays of boxes, and unexplained abstract symbols. Balance visual richness with clear focal hierarchy. Use a coherent palette with strong luminance contrast and semantic color (e.g. healthy flow, warning, failure).

Plan sparse, story-motivated sound events alongside the visuals. Every event must describe its visualMoment and target the exact impact time of that action; do not add sound merely because something moves. Use only the allowed SFX types and mixing contract below.

Return ONLY valid JSON, no Markdown and no commentary, with this schema:
{
  "visualPremise": "one sentence describing the visual story",
  "recurringSubject": "the specific subject followed through the scene",
  "visualStyle": "the scene's coherent rendering and material direction",
  "palette": ["#RRGGBB", "..."],
  "beats": [{
    "start": 0,
    "end": 4,
    "narrationAnchor": "exact short phrase from the narration",
    "dramaticPurpose": "why this beat advances curiosity or comprehension",
    "visualAction": "what visibly changes, including cause and consequence",
    "composition": "shot scale, camera angle, focal placement and frame use",
    "depthAndLighting": "foreground/midground/background, materials and light",
    "cameraMove": "specific start-to-end camera movement",
    "transition": "how this shot connects to the next",
    "onScreenWords": ["short label"]
  }],
  "soundEvents": [{
    "t": 2.4,
    "type": "whoosh",
    "intensity": 0.5,
    "duration": 0.8,
    "visualMoment": "the packet strikes the barrier at this exact time"
  }]
}

Use an empty soundEvents array when no accent is justified. Do not invent facts, numbers, labels, or technical behavior absent from the narration.`;

const HTML_SYSTEM_PROMPT = `You are a world-class motion-graphics director and self-contained HTML animation engineer. Turn the supplied approved storyboard into one excellent explanatory motion-graphics scene. The storyboard is the edit plan: preserve its facts, narration anchors, recurring subject, beat timing, visual premise, palette, and cause-and-effect. Do not replace it with a generic infographic.

ART DIRECTION:
- Make a full-frame, layered 2.5D visual world with depth, perspective, material detail, controlled lighting, and deliberate camera language. Compose for the actual topic, not a generic technology dashboard.
- Keep one recognizable visual subject moving through the scene and changing state. Make each narration beat visibly advance the same visual story; build anticipation, reveal the consequence, then land on a clear payoff.
- Change the meaningful visual state throughout the scene, typically every 3–5 seconds. Use varied shot scales and compositions while keeping visual continuity. Motion must explain the mechanism, not decorate it.
- Use the full canvas with a strong focal hierarchy. Keep important objects and text inside a 7% safe margin. Avoid underfilled frames, oversized empty regions, repeated central rings, tiny diagram clusters, unrelated panels, overlapping elements, and accidental text collisions.
- Use rich but controlled visual contrast and a consistent palette from the storyboard. Avoid flat black/white expanses unless the scene's art direction intentionally uses them. Ensure labels remain clearly readable at mobile playback size.
- Keep text sparse: at most one short label at once, up to six words. Never invent metrics or technical claims.
- SFX must match the storyboard's visual moments. They are mixed beneath narration by the renderer; do not generate or play audio in the page.

ANIMATION / RENDER CONTRACT:
- Return a complete, self-contained HTML document with inline CSS and JavaScript only. No external libraries, fonts, images, CDNs, network requests, or audio playback.
- Target the exact supplied canvas dimensions. Keep html/body block-level and the root visual container at that exact size; clip only intentional off-canvas artwork.
- Expose window.renderFrame(seconds) as a deterministic seekable render of the whole scene. Puppeteer calls it independently for each frame, so never rely on wall-clock time, random values, previous frames, or autoplay state. CSS animations are allowed only when renderFrame can seek them deterministically.
- Use smooth, intentional interpolation; no strobing, flashing, jitter, or uncontrolled shaking. Ensure the opening frame is already composed and the final frame resolves cleanly.
- Check that DOM elements exist before manipulating them. Handle reduced content without throwing. Include window.SOUND_EVENTS as an array with the exact supplied plan.
- Output ONLY the HTML document; no Markdown fences or commentary.`;

const DIRECT_HTML_SYSTEM_PROMPT = `You are a world-class motion-graphics director and self-contained HTML animation engineer. Create one excellent explanatory motion-graphics scene directly from the supplied narration. Invent a coherent visual story that explains the narration through visible cause and effect; do not merely decorate subtitles or assemble a generic infographic.

ART DIRECTION:
- Make a full-frame, layered 2.5D visual world with depth, perspective, tactile materials, controlled lighting, and deliberate camera language.
- Choose one recognizable subject or visual metaphor specific to the narration. Carry it through the scene as it changes state, builds anticipation, reveals a consequence, and lands on a clear payoff.
- Advance the visual story in meaningful stages, usually every 3–5 seconds. Motion must explain the mechanism or emotional turn, not decorate it.
- Use varied shot scales and compositions. Fill the canvas with a strong focal hierarchy, keeping important objects and text inside a 7% safe margin. Avoid underfilled frames, oversized empty regions, repeated central rings, tiny diagram clusters, unrelated panels, overlapping elements, and accidental text collisions.
- Use rich but controlled contrast, a coherent topic-specific palette, and readable mobile-sized labels. Keep text sparse: at most one short label at once, up to six words. Never invent metrics or technical claims.
- Plan only a few story-motivated SFX cues. Set window.SOUND_EVENTS to an array of {t,type,intensity,duration?} using only the available sound types in the guide. t is the visual impact/peak time. Never play audio in the page.

ANIMATION / RENDER CONTRACT:
- Return a complete, self-contained HTML document with inline CSS and JavaScript only. No external libraries, fonts, images, CDNs, network requests, or audio playback.
- Target the exact supplied canvas dimensions. Keep html/body block-level and the root visual container at that exact size; clip only intentional off-canvas artwork.
- Expose window.renderFrame(seconds) as a deterministic seekable render of the whole scene. Puppeteer calls it independently for each frame, so never rely on wall-clock time, random values, previous frames, or autoplay state. CSS animations are allowed only when renderFrame can seek them deterministically.
- Use smooth, intentional interpolation; no strobing, flashing, jitter, or uncontrolled shaking. Ensure the opening frame is already composed and the final frame resolves cleanly.
- Check that DOM elements exist before manipulating them. Handle reduced content without throwing.
- Output ONLY the HTML document; no Markdown fences or commentary.`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;

  try {
    const parsed: unknown = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    if (!isRecord(parsed)) return null;
    return isRecord(parsed.storyboard) ? parsed.storyboard : parsed;
  } catch {
    return null;
  }
}

function hasUsableStoryboard(raw: Record<string, unknown>, duration: number): boolean {
  if (!Array.isArray(raw.beats)) return false;
  const validBeats = raw.beats.flatMap((value) => {
    if (!isRecord(value)) return [];
    const start = finiteNumber(value.start);
    const end = finiteNumber(value.end);
    return start !== undefined && end !== undefined && end > start && start < duration && end > 0
      ? [{ start, end }]
      : [];
  });
  const minimumBeatCount = Math.max(1, Math.ceil(duration / 8));
  const firstBeat = validBeats.reduce((earliest, beat) => Math.min(earliest, beat.start), duration);
  const lastBeatEnd = validBeats.reduce((latest, beat) => Math.max(latest, beat.end), 0);

  return validBeats.length >= minimumBeatCount
    && firstBeat <= Math.min(1, duration * 0.1)
    && lastBeatEnd >= duration * 0.8;
}

function assertGeneratedHtml(raw: string): void {
  const unwrapped = raw.trim().replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/i, "").trim();
  if (!unwrapped || !/<(?:!doctype\s+html|html|body|div|main|section|svg|canvas|style|script)\b/i.test(unwrapped)) {
    throw new Error("Gemini returned an empty or non-HTML scene response");
  }
}

function makeNarrationAnchors(narration: string, count: number): string[] {
  const words = narration.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return Array.from({ length: count }, (_, index) => index === 0 ? 'Opening visual hook' : 'Visual development');

  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor(index * words.length / count);
    const end = Math.max(start + 1, Math.floor((index + 1) * words.length / count));
    return words.slice(start, end).join(' ').slice(0, 180);
  });
}

function createFallbackStoryboard(input: SceneHtmlGenerationInput): SceneStoryboard {
  const duration = Math.min(Math.max(input.duration ?? 30, 1), 120);
  const count = Math.min(24, Math.max(1, Math.ceil(duration / 4.5)));
  const anchors = makeNarrationAnchors(input.narration || '', count);
  const shotProgression = [
    'wide establishing shot with the subject entering frame from the left',
    'medium side-on shot with the subject crossing layered foreground and background',
    'tight macro detail revealing the mechanism acting on the subject',
    'overhead shot showing the consequence spreading through the environment',
    'low-angle wide shot revealing the system-scale outcome',
  ];

  return {
    visualPremise: 'Follow one concrete subject as it changes state and reveals the cause-and-effect in the narration.',
    recurringSubject: 'One clearly identifiable subject representing the central concept in the narration.',
    visualStyle: 'Cinematic editorial 2.5D motion graphics with layered depth, tactile surfaces, controlled light, and a coherent high-contrast palette.',
    palette: ['#101722', '#F2AA4C', '#56D5C2', '#EF665D', '#EAF0F5'],
    beats: Array.from({ length: count }, (_, index) => ({
      start: duration * index / count,
      end: duration * (index + 1) / count,
      narrationAnchor: anchors[index],
      dramaticPurpose: index === 0 ? 'Create an immediate visual question and establish the subject.' : 'Advance the same visual story and make the next consequence legible.',
      visualAction: index === 0
        ? 'Introduce one specific subject in a readable state, then make it move for a clear reason.'
        : 'Continue following the same subject; show one clear state change and its direct consequence.',
      composition: shotProgression[index % shotProgression.length],
      depthAndLighting: 'Separate a softly detailed foreground, active subject in the midground, and atmospheric background; use directional light and the palette for readable depth.',
      cameraMove: index % 2 === 0 ? 'Track with the subject, then ease into a deliberate push-in.' : 'Rise and pull back to reveal the subject’s consequence in the wider system.',
      transition: 'Carry the subject or its motion into the next shot; avoid an unrelated hard reset.',
      onScreenWords: [],
    })),
    soundEvents: [],
  };
}

function normalizeStoryboard(raw: unknown, input: SceneHtmlGenerationInput): SceneStoryboard {
  const fallback = createFallbackStoryboard(input);
  if (!isRecord(raw)) return fallback;

  const duration = Math.min(Math.max(input.duration ?? 30, 1), 120);
  const sourceBeats = Array.isArray(raw.beats) ? raw.beats.filter(isRecord) : [];
  const candidates = sourceBeats
    .map((beat, index) => {
      const start = finiteNumber(beat.start);
      const end = finiteNumber(beat.end);
      if (start === undefined || end === undefined || end <= start) return null;
      const fallbackBeat = fallback.beats[Math.min(index, fallback.beats.length - 1)];
      const words = Array.isArray(beat.onScreenWords)
        ? beat.onScreenWords.filter((word): word is string => typeof word === 'string').join(' ').trim().split(/\s+/).filter(Boolean).slice(0, 6)
        : [];

      return {
        proposedStart: Math.min(duration, Math.max(0, start)),
        proposedEnd: Math.min(duration, Math.max(0, end)),
        narrationAnchor: typeof beat.narrationAnchor === 'string' && beat.narrationAnchor.trim()
          ? beat.narrationAnchor.trim().slice(0, 180)
          : fallbackBeat.narrationAnchor,
        dramaticPurpose: typeof beat.dramaticPurpose === 'string' && beat.dramaticPurpose.trim()
          ? beat.dramaticPurpose.trim().slice(0, 400)
          : fallbackBeat.dramaticPurpose,
        visualAction: typeof beat.visualAction === 'string' && beat.visualAction.trim()
          ? beat.visualAction.trim().slice(0, 700)
          : fallbackBeat.visualAction,
        composition: typeof beat.composition === 'string' && beat.composition.trim()
          ? beat.composition.trim().slice(0, 400)
          : fallbackBeat.composition,
        depthAndLighting: typeof beat.depthAndLighting === 'string' && beat.depthAndLighting.trim()
          ? beat.depthAndLighting.trim().slice(0, 400)
          : fallbackBeat.depthAndLighting,
        cameraMove: typeof beat.cameraMove === 'string' && beat.cameraMove.trim()
          ? beat.cameraMove.trim().slice(0, 300)
          : fallbackBeat.cameraMove,
        transition: typeof beat.transition === 'string' && beat.transition.trim()
          ? beat.transition.trim().slice(0, 300)
          : fallbackBeat.transition,
        onScreenWords: words,
      };
    })
    .filter((beat): beat is Exclude<typeof beat, null> => beat !== null && beat.proposedEnd > beat.proposedStart)
    .sort((a, b) => a.proposedStart - b.proposedStart)
    .slice(0, 24);

  if (candidates.length === 0) return fallback;

  const selectedBeats = candidates;
  const beats: StoryboardBeat[] = [];
  let cursor = 0;

  selectedBeats.forEach((beat, index) => {
    const remaining = selectedBeats.length - index - 1;
    const minimumBeatDuration = Math.min(0.25, duration / selectedBeats.length);
    const proposedBoundary = index === selectedBeats.length - 1
      ? duration
      : (beat.proposedEnd + selectedBeats[index + 1].proposedStart) / 2;
    const latestBoundary = duration - remaining * minimumBeatDuration;
    const end = index === selectedBeats.length - 1
      ? duration
      : Math.max(cursor + minimumBeatDuration, Math.min(latestBoundary, proposedBoundary));

    beats.push({
      start: cursor,
      end,
      narrationAnchor: beat.narrationAnchor,
      dramaticPurpose: beat.dramaticPurpose,
      visualAction: beat.visualAction,
      composition: beat.composition,
      depthAndLighting: beat.depthAndLighting,
      cameraMove: beat.cameraMove,
      transition: beat.transition,
      onScreenWords: beat.onScreenWords,
    });
    cursor = end;
  });

  const rawEvents = Array.isArray(raw.soundEvents) ? raw.soundEvents : [];
  const soundEvents: PlannedSoundEvent[] = [];
  const sortedEvents = rawEvents
    .filter(isRecord)
    .map(event => {
      const t = finiteNumber(event.t);
      const type = typeof event.type === 'string' ? event.type.toLowerCase() as SfxType : undefined;
      const visualMoment = typeof event.visualMoment === 'string' ? event.visualMoment.trim() : '';
      if (t === undefined || !type || !VALID_SFX_TYPES.has(type) || !visualMoment) return null;
      if (t < 0 || t >= duration) return null;

      const intensity = finiteNumber(event.intensity);
      const requestedDuration = finiteNumber(event.duration);
      const durationValue = (type === 'typewriter' || type === 'data') && requestedDuration !== undefined && requestedDuration > 0
        ? Math.max(0.1, Math.min(1.2, requestedDuration))
        : undefined;

      return {
        t,
        type,
        intensity: Math.max(0.25, Math.min(0.7, intensity ?? 0.5)),
        ...(durationValue ? { duration: durationValue } : {}),
        visualMoment: visualMoment.slice(0, 240),
      };
    })
    .filter((event): event is NonNullable<typeof event> => Boolean(event))
    .sort((a, b) => a.t - b.t);

  for (const event of sortedEvents) {
    const previous = soundEvents[soundEvents.length - 1];
    if (previous && event.t - previous.t < 0.2) {
      if (event.intensity > (previous.intensity ?? 0)) soundEvents[soundEvents.length - 1] = event;
      continue;
    }
    if (soundEvents.length >= 8) break;
    soundEvents.push(event);
  }

  const palette = Array.isArray(raw.palette)
    ? raw.palette.filter((color): color is string => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)).slice(0, 6)
    : [];

  return {
    visualPremise: typeof raw.visualPremise === 'string' && raw.visualPremise.trim()
      ? raw.visualPremise.trim().slice(0, 700)
      : fallback.visualPremise,
    recurringSubject: typeof raw.recurringSubject === 'string' && raw.recurringSubject.trim()
      ? raw.recurringSubject.trim().slice(0, 300)
      : fallback.recurringSubject,
    visualStyle: typeof raw.visualStyle === 'string' && raw.visualStyle.trim()
      ? raw.visualStyle.trim().slice(0, 400)
      : fallback.visualStyle,
    palette: palette.length > 0 ? palette : fallback.palette,
    beats,
    soundEvents,
  };
}

export class SceneHtmlGenerationService {
  async generateSceneHtml(input: SceneHtmlGenerationInput): Promise<string> {
    const result = await this.generateScene(input);
    return result.html;
  }

  async generateScene(input: SceneHtmlGenerationInput): Promise<SceneHtmlGenerationResult> {
    const duration = Math.min(Math.max(input.duration ?? 30, 1), 120);
    const sceneInput = { ...input, duration };
    const sceneLabel = input.sceneId || "unknown scene";

    try {
      const rawStoryboard = await this.createDirectionGemini().generateText(this.buildStoryboardPrompt(sceneInput), {
        model: process.env.GEMINI_DIRECTION_MODEL || "gemini-3.6-flash",
        temperature: 0.4,
        topP: 0.9,
        maxOutputTokens: 7000,
        maxAttempts: 1,
        timeoutMs: 60_000,
      });
      const parsedStoryboard = parseJsonObject(rawStoryboard);
      if (!parsedStoryboard || !hasUsableStoryboard(parsedStoryboard, duration)) {
        throw new Error("Gemini returned an invalid or unusable storyboard");
      }

      const storyboard = normalizeStoryboard(parsedStoryboard, sceneInput);
      const rawHtml = await this.createHtmlGemini().generateText(this.buildHtmlPrompt(sceneInput, storyboard), {
        model: process.env.GEMINI_HTML_MODEL || process.env.GEMINI_MODEL || "gemini-3.8-flash",
        temperature: 0.7,
        topP: 0.92,
        maxAttempts: 1,
        timeoutMs: 60_000,
      });
      assertGeneratedHtml(rawHtml);

      const soundEvents: SoundEvent[] = storyboard.soundEvents.map(({ visualMoment: _visualMoment, ...event }) => event);
      return {
        html: sanitizeGeneratedHtml(rawHtml, input, soundEvents),
        soundEvents,
        storyboard,
        generationMode: "storyboard",
      };
    } catch (storyboardError) {
      console.warn(`[SceneHTML] Storyboard generation failed for ${sceneLabel}; trying direct HTML generation.`, storyboardError);
    }

    try {
      const rawHtml = await this.createHtmlGemini().generateText(this.buildDirectHtmlPrompt(sceneInput), {
        model: process.env.GEMINI_HTML_MODEL || process.env.GEMINI_MODEL || "gemini-3.8-flash",
        temperature: 0.7,
        topP: 0.92,
        maxAttempts: 1,
        timeoutMs: 60_000,
      });
      assertGeneratedHtml(rawHtml);
      return {
        html: sanitizeGeneratedHtml(rawHtml, input),
        generationMode: "direct-html-fallback",
      };
    } catch (directHtmlError) {
      console.error(`[SceneHTML] Direct HTML generation also failed for ${sceneLabel}; AI scene rendering must stop.`, directHtmlError);
      throw new Error(`Storyboard and direct HTML generation failed for ${sceneLabel}`);
    }
  }

  private createDirectionGemini(): GeminiService {
    const apiKey = process.env.GEMINI_DIRECTION_API_KEY || process.env.SCENE_PILOT_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Set GEMINI_DIRECTION_API_KEY to the pilot project's key before using storyboard scene generation");
    }

    const projectId = process.env.GEMINI_DIRECTION_PROJECT_ID && process.env.GEMINI_HTML_PROJECT_ID
      ? process.env.GEMINI_DIRECTION_PROJECT_ID
      : process.env.GEMINI_PROJECT_ID || "shared-default";

    return new GeminiService({
      apiKey,
      projectId,
    });
  }

  private createHtmlGemini(): GeminiService {
    const projectId = process.env.GEMINI_DIRECTION_PROJECT_ID && process.env.GEMINI_HTML_PROJECT_ID
      ? process.env.GEMINI_HTML_PROJECT_ID
      : process.env.GEMINI_PROJECT_ID || "shared-default";

    return new GeminiService({
      apiKey: process.env.GEMINI_HTML_API_KEY || undefined,
      projectId,
    });
  }

  private buildStoryboardPrompt(input: SceneHtmlGenerationInput): string {
    const duration = Math.min(Math.max(input.duration ?? 30, 1), 120);
    return `${STORYBOARD_SYSTEM_PROMPT}

SCENE CONTEXT:
- Video scene title: ${input.sceneTitle?.trim() || input.sceneId || 'Unspecified scene'}
- Scene duration: ${duration.toFixed(2)} seconds
- Format: ${input.isShort ? 'vertical 9:16 YouTube Short' : 'landscape 16:9 YouTube explainer'}
- Treat the supplied narration as source material, not as text to copy onto the screen.

${SFX_GUIDE}

NARRATION (the beat anchors must quote this text accurately):
${input.narration || '(silent visual hook; create a visual question without inventing narration)'}`;
  }

  private buildHtmlPrompt(input: SceneHtmlGenerationInput, storyboard: SceneStoryboard): string {
    const width = input.isShort ? 1080 : 1920;
    const height = input.isShort ? 1920 : 1080;
    const format = input.isShort ? "vertical YouTube Shorts" : "landscape long-form YouTube";
    const maxDuration = Math.min(Math.max(input.duration ?? 30, 1), 120);

    return `${HTML_SYSTEM_PROMPT}

SCENE CONTEXT:
- Scene title: ${input.sceneTitle?.trim() || input.sceneId || 'Unspecified scene'}
- Format: ${format}
- Duration: ${maxDuration.toFixed(2)} seconds

APPROVED STORYBOARD (follow these timed beats):
${JSON.stringify(storyboard, null, 2)}

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
    app.style.transform = 'scale(' + scale + ')';
    app.style.transformOrigin = 'center center';
- This ensures the visual COVERS the full screen with no black bars or margins.
- Do not rely on scrolling. Everything must stay within the canvas bounds.
- Keep all essential visual elements inside the safe area.

TIMING:
- The scene may be rendered for up to ${maxDuration.toFixed(2)} seconds.
- Use each storyboard beat's start/end times as the main visual edit points; the whole timeline must cover 0–${maxDuration.toFixed(2)} seconds.
- All animation must look good when sampled by repeatedly calling window.renderFrame(seconds).
- Define window.renderFrame(seconds) even if you also use CSS keyframes.

NARRATION SEGMENT:
${input.narration || "(silent scene; create a visual-only motion hook)"}

SOUND EVENTS:
- Use the storyboard's soundEvents exactly in window.SOUND_EVENTS. Do not add, remove, or retime events.
- t denotes the visual impact/peak time, not the beginning of the raw audio sample.
- The renderer applies the timed sounds to the final narration mix; never play audio in HTML.`;
  }

  private buildDirectHtmlPrompt(input: SceneHtmlGenerationInput): string {
    const width = input.isShort ? 1080 : 1920;
    const height = input.isShort ? 1920 : 1080;
    const format = input.isShort ? "vertical YouTube Shorts" : "landscape long-form YouTube";
    const duration = Math.min(Math.max(input.duration ?? 30, 1), 120);

    return `${DIRECT_HTML_SYSTEM_PROMPT}

SCENE CONTEXT:
- Scene title: ${input.sceneTitle?.trim() || input.sceneId || "Unspecified scene"}
- Format: ${format}
- Duration: ${duration.toFixed(2)} seconds

SCREEN DIMENSIONS:
- Exact canvas size: ${width}x${height} pixels.
- Keep html/body block-level. Position the root visual container at exactly ${width}x${height}px and center it using absolute positioning; do not rely on scrolling.
- Fill the screen with intentional artwork. Keep essential visual elements inside the safe area.

${SFX_GUIDE}

NARRATION SEGMENT:
${input.narration || "(silent visual hook; create a visual question without inventing narration)"}

The complete visual timeline should cover 0–${duration.toFixed(2)} seconds. Define window.renderFrame(seconds) for deterministic seeking. Output one complete HTML document only.`;
  }
}

export function sanitizeGeneratedHtml(
  raw: string,
  input: Partial<SceneHtmlGenerationInput> = {},
  soundEvents?: SoundEvent[],
): string {
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
  if (soundEvents) html = ensureSoundEventsHook(html, soundEvents);

  if (!/<\/html>\s*$/i.test(html)) {
    html = `${html}\n</html>`;
  }

  return html;
}

function ensureSoundEventsHook(html: string, soundEvents: SoundEvent[]): string {
  const serialized = JSON.stringify(soundEvents)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const hook = `<script>window.SOUND_EVENTS = ${serialized};</script>`;

  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${hook}</body>`);
  if (/<\/html>/i.test(html)) return html.replace(/<\/html>/i, `<body>${hook}</body></html>`);
  return `${html}${hook}`;
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
