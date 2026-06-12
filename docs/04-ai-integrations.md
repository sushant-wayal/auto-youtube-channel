# AI Integrations

> Gemini AI for content generation, idea selection, scene rendering, and text-to-speech. F5-TTS for open-source voice cloning.

This document covers all AI integrations in the video generation pipeline.

---

## Overview

The pipeline uses two AI systems:

1. **Google Gemini AI** — script generation, idea analysis, TTS voice-over, and (optionally) scene HTML
2. **F5-TTS** — open-source voice clone TTS (alternative to Gemini TTS)

### Gemini Models Used

| Purpose | Model | Temperature | Notes |
|---------|-------|-------------|-------|
| Channel analysis | `gemini-3-flash-preview` | 0.7 | Balanced creativity |
| Idea generation | `gemini-3-flash-preview` | 0.8 | JSON output |
| Topic selection | `gemini-3-flash-preview` | 0.3 | Decisive |
| Script generation | `gemini-3-flash-preview` | 1.0 | Max creativity, JSON |
| AI scene HTML | `gemini-3-flash-preview` | — | Full HTML generation |
| Text-to-Speech | `gemini-2.5-flash-preview-tts` | 1.0 | Audio output modality |

---

## API Key Rotation (Gemini)

The system supports **dual API key rotation** to double effective rate limits:

```bash
GEMINI_API_KEY_1=your_first_key
GEMINI_API_KEY_2=your_second_key   # Optional
```

### Rotation Logic

```typescript
class GeminiClient {
  private currentKeyIndex = 0;
  private apiKeys: string[];  // [key1, key2] or [key1]

  getGenAI(): GoogleGenAI {
    const key = this.apiKeys[this.currentKeyIndex];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    return new GoogleGenAI({ apiKey: key });
  }
}
```

Benefits:
- Doubles effective RPM (requests per minute) for TTS-heavy workloads
- Automatic fallover if one key is exhausted
- Falls back gracefully to a single key

---

## Text-to-Speech: Gemini TTS

**Service:** `workers/voice-over-generation/src/lib/gemini/gemini-tts-service.ts`

### Configuration

```typescript
{
  model: "gemini-2.5-flash-preview-tts",
  config: {
    responseModalities: ["AUDIO"],
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } },
    temperature: 1,
    maxOutputTokens: 32000,
  }
}
```

### Available Voices

| Voice | Characteristics |
|-------|-----------------|
| `Puck` | Friendly, warm — **default** |
| `Charon` | Deep, authoritative |
| `Kore` | Clear, professional |
| `Fenrir` | Strong, confident |
| `Aoede` | Soft, pleasant |

### Audio Format

| Property | Value |
|----------|-------|
| Sample Rate | 24,000 Hz |
| Bit Depth | 16-bit signed PCM |
| Channels | Mono |
| Container | WAV (44-byte header added manually) |

### WAV Header Construction

Gemini returns raw base64-encoded PCM bytes. The service adds the WAV container:

```typescript
private addWavHeader(audioData: Buffer): Buffer {
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  const header = Buffer.alloc(44);
  // RIFF chunk
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + audioData.length, 4);  // File size - 8
  header.write('WAVE', 8);
  // fmt chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);               // Chunk size
  header.writeUInt16LE(1, 20);                // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  // data chunk
  header.write('data', 36);
  header.writeUInt32LE(audioData.length, 40);

  return Buffer.concat([header, audioData]);
}
```

### Silent Audio (Empty Narration)

Hook scenes and scenes with `narration = ""` get 1-second silence:

```typescript
private createSilenceAudio(outputPath: string, durationSeconds: number = 1.0): void {
  const numSamples = Math.floor(24000 * durationSeconds);
  const silentPCM = Buffer.alloc(numSamples * 2, 0); // 16-bit = 2 bytes per sample
  const wavBuffer = this.addWavHeader(silentPCM);
  fs.writeFileSync(outputPath, wavBuffer);
}
```

---

## Text-to-Speech: F5-TTS (Voice Clone)

**Service:** `workers/voice-over-generation/src/lib/f5/f5-tts-service.ts`

F5-TTS is an open-source neural TTS system that clones a reference voice.

### Requirements

- Python 3.11+
- `pip install git+https://github.com/SWivid/F5-TTS.git`
- Bundled reference audio: `assets/shorter-better-reference-audio.wav`
- Default reference text: `"Sounds simple, right? Not quite. There's one detail most people miss..."`

### Batch Processing (Critical for Performance)

**All non-empty narrations are processed in a single Python invocation** to avoid loading the large F5-TTS model for every scene:

```python
# Generated Python script (written to disk, then executed)
from f5_tts.api import F5TTS
import soundfile as sf

tts = F5TTS()  # Model loaded ONCE

tasks = [
  {"text": "Scene 1 narration...", "output": "/tmp/scene_0.wav"},
  {"text": "Scene 2 narration...", "output": "/tmp/scene_1.wav"},
  # ...
]

for task in tasks:
    wav, sr = tts.infer(
        ref_file="/path/to/reference.wav",
        ref_text="Sounds simple, right?...",
        gen_text=task["text"]
    )
    sf.write(task["output"], wav, sr)
```

### Text Sanitization (F5-TTS)

F5-TTS does not handle all text formats well. The service sanitizes:

| Pattern | Replacement |
|---------|-------------|
| `[PAUSE...]` tags | removed |
| `[...]` bracket tags | removed |
| `<...>` SSML-like tags | removed |
| `hyphenated-words` | `hyphenated words` (spaces) |
| `–`, `—`, `_`, `*`, `~`, `\``, `` ` `` | removed |
| Repeated punctuation `!!`, `...` | collapsed |
| Leading/trailing whitespace | trimmed |

---

## Provider Selection and Fallback

The voiceover worker automatically handles provider failover:

```typescript
// Configured via VOICEOVER_PROVIDER = 'gemini' | 'f5'
const primary = config.voiceover.provider;           // 'gemini'
const fallback = primary === 'gemini' ? 'f5' : 'gemini'; // 'f5'

try {
  return await runWithProvider(primary, narrations, videoId, voice);
} catch (primaryError) {
  console.error(`Primary provider (${primary}) failed, trying fallback...`);
  cleanupTempDir();
  return await runWithProvider(fallback, narrations, videoId, voice);
}
```

---

## Exponential Backoff (All Gemini Calls)

Every Gemini API call (ideas, scripts, TTS) uses this retry pattern:

```typescript
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 30_000;

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  try {
    const result = await genAI.models.generateContent(...);
    return result;
  } catch (error) {
    const isRetryable =
      statusCode === 429 ||         // Rate limited
      statusCode === 500 ||         // Internal server error
      statusCode === 503 ||         // Service unavailable
      message.includes('overloaded') ||
      message.includes('unavailable') ||
      message.includes('internal') ||
      message.includes('fetch failed') ||
      error.code === 'ECONNRESET' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      message.includes('socket hang up');

    if (!isRetryable || attempt >= MAX_RETRIES) throw error;

    const delay = Math.min(
      BASE_DELAY_MS * Math.pow(2, attempt - 1),
      MAX_DELAY_MS
    ) + Math.floor(Math.random() * 1_000); // jitter

    console.error(`Attempt ${attempt} failed. Retrying in ${delay}ms...`);
    await sleep(delay);
  }
}
```

---

## Idea Generation

**Service:** `workers/idea-selector/src/lib/gemini-idea-generator.ts`

### TopicIdea Structure (Full)

```typescript
interface TopicIdea {
  topic: string;
  reasoning: string;
  curiosityAngle:
    | 'Myth' | 'Hidden Cost' | 'Surprising Truth'
    | 'Counterintuitive Behavior' | 'Tradeoff'
    | 'Failure Mode' | 'Common Mistake';
  audienceBreadthScore: number;    // 0–100
  titlePotentialScore: number;     // 0–100
  performanceScore: number;        // 0–100 (AI estimate)
  targetFormats: {
    longForm: boolean;             // Always true
    shorts: number;                // 3–5
  };
  suggestedAngles: string[];
  estimatedPerformance: {
    score: number;
    confidence: 'low' | 'medium' | 'high';
  };
}
```

### Hybrid Validation & Scoring

After AI generates 15 raw ideas, deterministic rules are applied:

**Hard Elimination:**
```typescript
function hardEliminate(ideas: TopicIdea[], history: VideoHistory[], queueIdeas: string[]) {
  return ideas.filter(idea => {
    // Block if uploaded in last 30 days
    const recentMatch = history.find(v =>
      isSimilar(idea.topic, v.title) && daysSince(v.uploadedAt) < 30
    );
    if (recentMatch) return false;

    // Block if overused (same domain > 2x threshold)
    const domainCount = history.filter(v => sameDomain(v.title, idea.topic)).length;
    if (domainCount > OVERUSE_THRESHOLD * 2) return false;

    // Block if > 60% word overlap with queued ideas
    const queueDupe = queueIdeas.some(q => wordOverlap(idea.topic, q) > 0.6);
    if (queueDupe) return false;

    return true;
  });
}
```

**Formula-Based Ranking:**
```typescript
function rankIdeas(ideas: TopicIdea[], history: VideoHistory[]): HybridScore[] {
  return ideas.map(idea => {
    const aiScore = idea.performanceScore;
    const formulaScore = calculateFormula(idea, history);  // CTR, retention, views
    const audienceBreadth = idea.audienceBreadthScore;
    const titlePotential = idea.titlePotentialScore;

    // Weighted composite score
    const hybrid = (aiScore * 0.34) + (formulaScore * 0.18) +
                   (audienceBreadth * 0.28) + (titlePotential * 0.20);

    return { idea, hybrid };
  }).sort((a, b) => b.hybrid - a.hybrid);
}
```

**Final Selection:**
- Gemini picks the single best topic from top 5 by hybrid score
- Temperature 0.3 for decisive, consistent choices
- Returns `{ index: number, justification: string }`
- Falls back to rank #1 formula pick on any Gemini error

---

## Script Generation

**API Route:** `website/app/api/generate-script/`

### Script Structure

```typescript
interface VideoScript {
  title: string;
  description: string;
  tags: string[];
  narration: string;      // Full concatenated narration text
  scenes: SceneIR[];      // Visual scenes with ActionIR
  shorts: ShortScript[];  // 3–5 shorts with hook + content scenes
}

interface ShortScript {
  id: string;             // "short-0", "short-1", etc.
  hook: string;           // The attention-grabbing hook text
  scenes: [
    SceneIR,             // Hook scene: id="hook", empty narration, 0.8–1.5s duration
    SceneIR              // Content scene: has narration and actions
  ];
}
```

### Script Generation Process

```
1. VideoIdea string → prompt Gemini
2. Gemini generates:
   - Title, description (with chapter placeholders), tags
   - Full narration text for entire video
   - 5–10 scenes, each with:
       sceneTitle (for YouTube chapters)
       baseDuration + holdDuration
       narration (per-scene text)
       actions[] (ActionIR primitives)
   - 3–5 shorts, each with:
       hook text
       hook scene (id="hook", narration="", baseDuration 0.8–1.5)
       content scene (with narration + actions)
3. Parsed JSON validated and returned
```

---

## AI Scene HTML (ai render mode)

**API Route:** `website/app/api/generate-scene-html/`

When `SCENE_RENDER_METHOD=ai`, each scene's HTML is generated by Gemini instead of by `SceneHtmlRenderer`.

### Rate-Limit Queue

To prevent hitting Gemini's per-minute request quota during batch scene rendering, the API uses a Redis-based serialized queue:

```typescript
// Redis keys
'html_queue:turn'         // Integer: current turn number
'html_queue:processing'   // String: 'true' when a request is active
'html_queue:last_enquiry' // Timestamp: when last request was made

// API endpoint logic
async function generateSceneHtml(narration: string) {
  // Wait for our turn
  while (redis.get('html_queue:processing') === 'true') {
    await sleep(500);
  }

  // Mark as processing
  await redis.set('html_queue:processing', 'true');

  // Generate HTML with Gemini
  const html = await gemini.generateContent({ prompt: narration });

  // Schedule 22-second cooldown before next request can proceed
  setTimeout(async () => {
    await redis.del('html_queue:processing');
    await redis.incr('html_queue:turn');
  }, 22_000);

  return html;
}
```

The `generate-script.ts` CI script initializes these keys at the start of each pipeline run:
```typescript
await redis.set('html_queue:turn', '1');
await redis.set('html_queue:last_enquiry', '0');
```

---

## Trend Detection

**Service:** `workers/idea-selector/src/lib/trend-detector.ts`

All three sources run **concurrently** (`Promise.allSettled`). Individual failures are non-fatal.

### Source 1: YouTube Trending

```typescript
// YouTube Data API v3
GET https://www.googleapis.com/youtube/v3/videos?
  part=snippet,statistics&
  chart=mostPopular&
  videoCategoryId=28&   // Science & Technology
  regionCode=IN&        // India
  maxResults=15&
  key={YT_API_KEY}

// Returns top 15 S&T trending videos in India
// → Used to identify currently popular tech topics
```

### Source 2: Hacker News

```typescript
// HN Algolia API
GET https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30

// Filter by tech keywords: ['javascript', 'typescript', 'python', 'ai', 'llm',
//   'database', 'api', 'cloud', 'devops', 'backend', 'frontend', ...]
// → Returns HN posts matching tech topics from today's front page
```

### Source 3: Reddit

```typescript
// Reddit JSON API (no auth required)
GET https://www.reddit.com/r/programming+webdev+javascript+typescript+
    node+ExperiencedDevs+devops+learnprogramming/top.json?
    t=day&
    limit=20

// → Top posts from tech subreddits in the last 24 hours
```

---

## Rate Limits and Quotas

### Gemini API (Approximate Free Tier)

| Model | RPM | TPD |
|-------|-----|-----|
| `gemini-3-flash-preview` | 15 | 1,500,000 |
| `gemini-2.5-flash-preview-tts` | 15 | Varies |

### Pipeline Usage Per Run

| Step | Model | Approx Tokens |
|------|-------|---------------|
| Channel analysis | gemini-3-flash | ~2,000 |
| Idea generation (15 ideas) | gemini-3-flash | ~5,000 |
| Topic selection | gemini-3-flash | ~1,000 |
| Script generation | gemini-3-flash | ~10,000–20,000 |
| TTS per scene (~8 scenes) | gemini-2.5-flash-tts | ~1,000 per scene |
| TTS per short (~3–5 shorts) | gemini-2.5-flash-tts | ~500 per short scene |

With key rotation, the pipeline comfortably fits within free tier quotas.

---

## Best Practices

### Prompt Engineering

1. **Be specific** — Clear instructions reduce hallucinations and off-format responses
2. **Provide context** — Include channel analytics, history, and queue state
3. **Request JSON** — Use `responseMimeType: "application/json"` for structured output
4. **Lower temperature for selection** — 0.3 for decisive topic selection, 1.0 for creative script writing

### Error Handling

1. **Always retry with backoff** — Transient errors (429, 503, overloaded) are common
2. **Add random jitter** — Prevents thundering herd on rate limit resets
3. **Fallback gracefully** — Formula ranking if AI topic selection fails; silence if TTS fails
4. **Log to stderr** — All progress logs via `console.error()`, only structured output to stdout

### F5-TTS Performance

1. **Batch all narrations** — Load model once, process all scenes sequentially
2. **Sanitize text** — Remove SSML/markdown that confuses the TTS model
3. **Use shorter reference audio** — Shorter clips improve prosody matching
4. **Cache model on CI** — Current setup downloads fresh each run (no caching)

---

## Next: [05-github-actions.md](./05-github-actions.md)
