/**
 * SFX Mixer
 * Builds a per-scene animation sound-effects audio layer from a list of
 * timed SoundEvent objects, then mixes it at a low volume into the scene
 * narration audio.
 *
 * SFX files live in:  workers/video-assembler/src/lib/assests/sfx/
 *
 * Volume hierarchy:
 *   Narration voiceover  100%
 *   Animation SFX         25%   ← this module
 *   Background music      15%   ← handled by video-assembly.ts
 */

import path from 'path';
import fs from 'fs';
import { runFFmpeg } from '../video/ffmpeg-utils';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

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
  /** Start time in seconds from the beginning of the scene */
  t: number;
  /** Which SFX to play */
  type: SfxType;
  /** 0–1 relative intensity (applied as a per-event volume multiplier) */
  intensity?: number;
  /** Duration in seconds for continuous sounds (e.g. typewriter, data stream) */
  duration?: number;
}

// ---------------------------------------------------------------------------
// File map — type → WAV filename in the sfx/ directory
// ---------------------------------------------------------------------------

function resolveSfxDir(): string {
  const candidates = [
    path.join(__dirname, 'sfx'),
    path.join(__dirname, '..', '..', 'src', 'lib', 'assests', 'sfx'),
    path.join(process.cwd(), 'workers', 'video-assembler', 'src', 'lib', 'assests', 'sfx'),
    path.join(process.cwd(), 'src', 'lib', 'assests', 'sfx'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }
  return path.join(__dirname, 'sfx');
}

const SFX_DIR = resolveSfxDir();

const SFX_FILE_MAP: Record<SfxType, string> = {
  whoosh:     'whoosh.wav',
  pop:        'pop.wav',
  chime:      'chime.wav',
  swipe:      'swipe.wav',
  swoosh:     'swoosh.wav',
  typewriter: 'single-key-press.wav',
  tick:       'single-tick.wav',
  expand:     'expand-bloom.wav',
  ping:       'digital-ping.wav',
  data:       'data-blip.wav',
};

/**
 * Measured lead times (ms) to peak amplitude for each SFX WAV file.
 * Subtracting this lead time ensures the peak impact of the sound aligns
 * perfectly with the visual animation timestamp t.
 */
const SFX_PEAK_OFFSETS_MS: Record<SfxType, number> = {
  typewriter: 56,
  tick:       65,
  chime:      74,
  data:       146,
  whoosh:     162,
  swipe:      189,
  pop:        202,
  ping:       237,
  swoosh:     430,
  expand:     564,
};

/** Global SFX volume (applied on top of per-event intensity) */
const SFX_BASE_VOLUME = 0.40;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sfxPath(type: SfxType): string {
  return path.join(SFX_DIR, SFX_FILE_MAP[type]);
}

function fileExists(p: string): boolean {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Core: build a silence-padded SFX audio layer WAV
// ---------------------------------------------------------------------------

/**
 * Build a single WAV file that contains all sound events placed at their
 * correct offsets within the scene.
 *
 * Algorithm:
 *  1. Filter out events whose SFX file is missing on disk.
 *  2. For each surviving event, calculate the peak-aligned delay:
 *     delayMs = max(0, t*1000 - SFX_PEAK_OFFSETS_MS[type])
 *  3. Use FFmpeg's `adelay` filter to delay the clip, then scale its amplitude.
 *  4. Mix all delayed clips together with `amix`, padded to `duration`
 *     seconds of silence.
 *
 * @param events     Sound events for this scene.
 * @param duration   Total scene duration in seconds (determines output length).
 * @param outputPath Where to write the resulting WAV file.
 * @returns          true if a layer was written, false if events were empty/all missing.
 */
export async function buildSfxLayer(
  events: SoundEvent[],
  duration: number,
  outputPath: string,
): Promise<boolean> {

  // Validate cached/API data as well as checking that the mapped sample exists.
  const candidates = (Array.isArray(events) ? events : []).filter(e => {
    if (!e || !Number.isFinite(e.t) || e.t < 0 || e.t >= duration || !Object.prototype.hasOwnProperty.call(SFX_FILE_MAP, e.type)) {
      console.error(`  ⚠️  Invalid SFX event skipped (t=${e?.t}, type=${e?.type})`);
      return false;
    }
    const p = sfxPath(e.type);
    if (!fileExists(p)) {
      console.error(`  ⚠️  SFX file missing for type "${e.type}", skipping event at t=${e.t}s`);
      return false;
    }
    return true;
  }).sort((a, b) => a.t - b.t);

  const valid: SoundEvent[] = [];
  for (const event of candidates) {
    const previous = valid[valid.length - 1];
    if (previous && event.t - previous.t < 0.2) {
      const eventIntensity = Number.isFinite(event.intensity) ? event.intensity! : 0.7;
      const previousIntensity = Number.isFinite(previous.intensity) ? previous.intensity! : 0.7;
      if (eventIntensity > previousIntensity) valid[valid.length - 1] = event;
      continue;
    }
    if (valid.length === 8) break;
    valid.push(event);
  }

  if (valid.length === 0) {
    return false;
  }

  console.error(`  🔊 Building SFX layer: ${valid.length} event(s) over ${duration.toFixed(2)}s`);

  /*
   * FFmpeg command structure (N events):
   *
   *   -f lavfi -i anullsrc=r=48000:cl=stereo          ← base silence
   *   -i sfx/whoosh.wav                                ← event 0
   *   -i sfx/pop.wav                                   ← event 1
   *   ...
   *   -filter_complex "
   *     [1]volume=V0,adelay=D0|D0[e0];
   *     [2]volume=V1,adelay=D1|D1[e1];
   *     ...
   *     [0][e0][e1]...amix=inputs=N+1:duration=first:dropout_transition=0[out]
   *   "
   *   -map [out] -t DURATION -c:a pcm_s16le -ar 48000 -ac 2
   */

  // Build inputs array: silence source first, then one per event
  const inputs: Array<{ flags?: string[]; path: string }> = [
    { flags: ['-f', 'lavfi'], path: 'anullsrc=r=48000:cl=stereo' },
    ...valid.map(e => ({ path: sfxPath(e.type) })),
  ];

  // Build filter_complex
  const delayFilters: string[] = [];
  const mixInputs: string[] = ['[0]'];
  const targetSamples = Math.ceil(duration * 48_000);

  valid.forEach((e, idx) => {
    const inputIdx = idx + 1; // 0 is the silence source
    const peakOffsetMs = SFX_PEAK_OFFSETS_MS[e.type] ?? 0;
    const targetMs = Math.round(Math.max(0, e.t) * 1000);
    const delayMs = Math.max(0, targetMs - peakOffsetMs);
    const intensity = Number.isFinite(e.intensity) ? Math.min(1, Math.max(0, e.intensity!)) : 0.7;
    // amix in the bundled FFmpeg normalizes by its number of inputs. Keep a
    // silence input plus all padded event inputs, then compensate that fixed
    // divisor so each cue keeps its intended level.
    const vol = (intensity * SFX_BASE_VOLUME * (valid.length + 1)).toFixed(4);
    const label = `[e${idx}]`;

    let chain = `[${inputIdx}]`;

    // If duration is specified, loop the sound sample and trim it to duration
    if ((e.type === 'typewriter' || e.type === 'data') && typeof e.duration === 'number' && Number.isFinite(e.duration) && e.duration > 0) {
      const durSec = Math.min(1.2, e.duration).toFixed(3);
      chain += `aloop=loop=-1:size=2e+09,atrim=0:${durSec},`;
    }

    chain += `volume=${vol},aresample=48000,adelay=${delayMs}|${delayMs},apad=whole_len=${targetSamples}${label}`;
    delayFilters.push(chain);
    mixInputs.push(label);
  });

  const numInputs = mixInputs.length; // silence + N events
  const filterComplex =
    delayFilters.join(';') +
    `;${mixInputs.join('')}amix=inputs=${numInputs}:duration=first:dropout_transition=0,alimiter=limit=0.95:level=disabled[out]`;

  await runFFmpeg({
    inputs,
    output: outputPath,
    args: [
      '-filter_complex', filterComplex,
      '-map', '[out]',
      '-t', duration.toFixed(4),
      '-c:a', 'pcm_s16le',
      '-ar', '48000',
      '-ac', '2',
    ],
  });

  console.error(`  ✅ SFX layer written: ${path.basename(outputPath)}`);
  return true;
}

// ---------------------------------------------------------------------------
// Core: mix SFX layer into existing narration WAV
// ---------------------------------------------------------------------------

/**
 * Mix a pre-built SFX layer WAV into the scene narration WAV.
 * The SFX layer is added at SFX_BASE_VOLUME (already baked in) on top of
 * the narration at 100%.
 *
 * Produces a new WAV file at `outputPath`. Inputs are not deleted.
 */
export async function mixSfxIntoNarration(
  narrationPath: string,
  sfxLayerPath: string,
  duration: number,
  outputPath: string,
): Promise<void> {
  const targetDuration = duration.toFixed(4);
  const targetSamples = Math.ceil(duration * 48_000);
  /*
   * FFmpeg:
   *   [0:a] narration at 100%
   *   [1:a] sfx layer (already at 25% from buildSfxLayer)
   *   Pad/trim both inputs to the scene length, compensate amix's default
   *   two-input normalization, then limit peaks without ducking the voice.
   */
  await runFFmpeg({
    inputs: [narrationPath, sfxLayerPath],
    output: outputPath,
    args: [
      '-filter_complex', `[0:a]aresample=48000,apad=whole_len=${targetSamples},atrim=0:${targetDuration},volume=2[narration];[1:a]aresample=48000,atrim=0:${targetDuration},volume=2[sfx];[narration][sfx]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.98:level=disabled[out]`,
      '-map', '[out]',
      '-t', targetDuration,
      '-c:a', 'pcm_s16le',
      '-ar', '48000',
      '-ac', '2',
    ],
  });
}

// ---------------------------------------------------------------------------
// Convenience: build + mix in one call (used by video-assembly.ts)
// ---------------------------------------------------------------------------

/**
 * If `events` is non-empty, build a SFX layer and mix it into `narrationPath`,
 * writing the result to `outputPath`.
 *
 * Returns true if a mix was performed, false if nothing was done
 * (caller should then just use the original narration path as-is).
 */
export async function applySfxToScene(
  events: SoundEvent[],
  narrationPath: string,
  duration: number,
  sfxTmpPath: string,
  outputPath: string,
): Promise<boolean> {
  if (!events || events.length === 0) {
    return false;
  }

  const layerBuilt = await buildSfxLayer(events, duration, sfxTmpPath);
  if (!layerBuilt) {
    return false;
  }

  await mixSfxIntoNarration(narrationPath, sfxTmpPath, duration, outputPath);
  return true;
}
