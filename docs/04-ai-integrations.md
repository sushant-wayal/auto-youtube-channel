# AI Integrations

> Gemini AI for content generation, idea selection, and text-to-speech

This document covers all AI integrations in the video generation pipeline.

---

## Overview

The pipeline uses **Google Gemini AI** for three main purposes:

1. **Idea Generation** - Analyze channel performance and generate video topics
2. **Script Generation** - Create video scripts with scenes and narration
3. **Text-to-Speech** - Generate voice-over narration audio

### Models Used

| Purpose | Model | Notes |
|---------|-------|-------|
| Channel Analysis | `gemini-3-flash-preview` | Temperature: 0.7 |
| Idea Generation | `gemini-3-flash-preview` | Temperature: 0.8, JSON output |
| Topic Selection | `gemini-3-flash-preview` | Temperature: 0.3 (decisive) |
| Script Generation | `gemini-3-flash-preview` | Temperature: 1.0, structured output |
| Text-to-Speech | `gemini-2.5-flash-preview-tts` | Temperature: 1.0, audio output |

---

## API Key Rotation

The system uses **dual API key rotation** to double rate limits:

```typescript
// Environment variables
GEMINI_API_KEY_1=your_first_key
GEMINI_API_KEY_2=your_second_key
```

### Rotation Logic

```typescript
class GeminiClient {
  private currentKeyIndex = 0;
  private apiKeys: string[];

  getGenAI(): GoogleGenAI {
    // Round-robin between keys
    const key = this.apiKeys[this.currentKeyIndex];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;

    console.error(`Using Gemini API Key ${this.currentKeyIndex + 1}`);
    return new GoogleGenAI({ apiKey: key });
  }
}
```

### Benefits

- Doubles effective rate limit
- Automatic failover if one key is exhausted
- Falls back to single key if only one provided

---

## Text-to-Speech (TTS)

### Service Location

`workers/voice-over-generation/src/lib/ai/gemini-tts-service.ts`

### Available Voices

| Voice | Characteristics |
|-------|-----------------|
| `Puck` | Friendly, warm (default) |
| `Charon` | Deep, authoritative |
| `Kore` | Clear, professional |
| `Fenrir` | Strong, confident |
| `Aoede` | Soft, pleasant |

### Usage

```typescript
const ttsService = new GeminiTTSService();

// Generate single audio
const audioBuffer = await ttsService.generateSpeech(
  "Hello, welcome to our video about HTTP protocols.",
  { voice: "Puck", speed: 1.0 }
);

// Generate per-scene narrations
const urls = await ttsService.generateNarrationAudios(
  jobId,
  ["Scene 1 narration...", "Scene 2 narration...", ""],
  outputDir,
  { voice: "Puck" }
);
```

### Audio Format

| Property | Value |
|----------|-------|
| Sample Rate | 24 kHz |
| Bit Depth | 16-bit |
| Channels | Mono |
| Format | WAV (PCM) |

### WAV Header Generation

Gemini TTS returns raw PCM data. The service adds proper WAV headers:

```typescript
private addWavHeader(audioData: Buffer): Buffer {
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;

  // Create 44-byte WAV header
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + audioData.length, 4);
  header.write('WAVE', 8);
  // ... fmt and data chunks

  return Buffer.concat([header, audioData]);
}
```

### Silent Audio Generation

For scenes with empty narration (e.g., hook scenes):

```typescript
private async createSilenceAudio(outputPath: string, durationSeconds: number) {
  const numSamples = Math.floor(24000 * durationSeconds);
  const silentData = Buffer.alloc(numSamples * 2, 0); // 16-bit = 2 bytes
  const wavBuffer = this.addWavHeader(silentData);
  fs.writeFileSync(outputPath, wavBuffer);
}
```

### Long-Form Narration

Gemini 2.5 Flash TTS handles 5-10 minute narrations in a single request:

```typescript
// No chunking needed
const audioPath = await ttsService.generateNarrationAudio(
  fullNarrationText, // Can be thousands of words
  outputPath,
  { voice: "Puck" }
);
```

---

## Idea Generation

### Service Location

`workers/idea-selector/src/lib/gemini-idea-generator.ts`

### Topic Idea Structure

```typescript
interface TopicIdea {
  topic: string;              // Clear, specific topic
  reasoning: string;          // Why it will perform well
  targetFormats: {
    longForm: boolean;        // Always true
    shorts: number;           // 3-5 shorts
  };
  suggestedAngles: string[];  // Specific content angles
  estimatedPerformance: {
    score: number;            // 0-100
    confidence: 'low' | 'medium' | 'high';
  };
}
```

### Channel Analysis Flow

```typescript
const generator = new GeminiIdeaGenerator();

// Step 1: Analyze channel performance
const insights = await generator.analyzeChannelPerformance(analytics);

// Step 2: Generate topic ideas (with optional trending signals)
const ideas = await generator.generateTopicIdeas(
  insights,
  analytics,
  15, // Generate 15 ideas
  trendingSignals
);

// Step 3: Select best topic
const best = await generator.selectBestTopic(ideas);
```

### Analysis Prompt

```
You are an expert YouTube content strategist. Analyze this channel's performance data...

1. Content patterns that perform well (topics, themes, keywords)
2. Performance trends (shorts vs long-form, engagement patterns)
3. Audience preferences and retention signals
4. Gaps or opportunities in current content
5. Emerging patterns that could be leveraged
```

### Idea Generation Prompt

```
Generate {count} high-potential video topic ideas.

REQUIREMENTS:
- Each topic should be GENERIC enough to produce 1 long-form (8-15 min) AND 3-5 shorts
- Topics should leverage identified successful patterns
- Avoid topics too similar to recent videos
- Balance evergreen content with trending opportunities
- Consider audience retention signals
```

### Topic Selection

The final selection uses lower temperature (0.3) for decisive choices:

```typescript
const selection = await genAI.models.generateContent({
  model: "gemini-3-flash-preview",
  contents: selectionPrompt,
  config: {
    temperature: 0.3, // Low for decisive selection
    responseMimeType: "application/json",
  }
});
```

---

## Hybrid Validation

The idea selector implements a hybrid AI + rules system:

### Hard Elimination Rules

Applied **after** AI generation to catch hallucinations:

```typescript
class HybridValidator {
  applyHardElimination(
    ideas: TopicIdea[],
    history: VideoHistory[],
    queueIdeas: string[]
  ): TopicIdea[] {
    return ideas.filter(idea => {
      // Too similar to recent video
      if (this.isTooSimilar(idea.topic, history)) return false;

      // Already in queue
      if (queueIdeas.some(q => this.isSimilar(idea.topic, q))) return false;

      // Invalid format count
      if (idea.targetFormats.shorts < 3 || idea.targetFormats.shorts > 5) return false;

      return true;
    });
  }
}
```

### Formula-Based Ranking

Deterministic scoring applied to validated ideas:

```typescript
applyFormulaRanking(ideas: TopicIdea[], history: VideoHistory[]): HybridScore[] {
  return ideas.map(idea => {
    const noveltyScore = this.calculateNovelty(idea.topic, history);
    const trendScore = this.calculateTrendAlignment(idea);
    const aiScore = idea.estimatedPerformance.score;

    // Hybrid score = weighted combination
    const hybrid = (aiScore * 0.4) + (noveltyScore * 0.3) + (trendScore * 0.3);

    return { idea, aiScore, formulaScore: noveltyScore + trendScore, hybrid };
  }).sort((a, b) => b.hybrid - a.hybrid);
}
```

---

## Error Handling

### Exponential Backoff

All Gemini calls implement retry with exponential backoff:

```typescript
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 30_000;

let attempt = 0;
while (attempt < MAX_RETRIES) {
  attempt++;

  try {
    const result = await genAI.models.generateContent(...);
    return result;
  } catch (error) {
    const isRetryable =
      statusCode === 429 ||  // Rate limited
      statusCode === 500 ||  // Server error
      statusCode === 503 ||  // Service unavailable
      message.includes("overloaded");

    if (!isRetryable || attempt >= MAX_RETRIES) throw error;

    const delay = Math.min(
      BASE_DELAY_MS * 2 ** (attempt - 1),
      MAX_DELAY_MS
    ) + Math.floor(Math.random() * 1_000); // jitter

    await sleep(delay);
  }
}
```

### Retryable Errors

| Error | Retryable |
|-------|-----------|
| 429 Rate Limited | Yes |
| 500 Internal Error | Yes |
| 503 Service Unavailable | Yes |
| "overloaded" message | Yes |
| "unavailable" message | Yes |
| Network errors | Yes |
| JSON parse errors | No |
| Invalid response | No |

---

## Script Generation

### Service Location

`website/lib/pipeline/script-generation.ts`

### Script Structure

```typescript
interface VideoScript {
  title: string;
  description: string;
  tags: string[];
  narration: string;  // Full script narration
  scenes: SceneIR[];  // Visual scenes with actions
  shorts: ShortScript[]; // 5 shorts with hooks
}
```

### Generation Process

1. **Topic Input** - Video idea/topic
2. **Research Phase** - AI gathers relevant information
3. **Script Writing** - Full narration with educational content
4. **Scene Breakdown** - Divide into 5-10 visual scenes
5. **Action Design** - Visual primitives for each scene
6. **Shorts Extraction** - Create 5 shorts with hooks

### Temperature Settings

| Phase | Temperature | Reason |
|-------|-------------|--------|
| Research | 0.7 | Balanced creativity |
| Script Writing | 1.0 | Maximum creativity |
| Scene Actions | 0.8 | Creative but structured |
| Shorts Hooks | 1.0 | Catchy, attention-grabbing |

---

## Rate Limits and Usage

### Gemini API Quotas

| Model | RPM (Requests/Min) | TPM (Tokens/Min) |
|-------|-------------------|------------------|
| gemini-3-flash-preview | 15 | 1,000,000 |
| gemini-2.5-flash-preview-tts | 15 | 32,000 |

### Pipeline Usage

| Step | Model | Approx Tokens |
|------|-------|--------------|
| Channel Analysis | gemini-3-flash | ~2,000 |
| Idea Generation | gemini-3-flash | ~5,000 |
| Topic Selection | gemini-3-flash | ~1,000 |
| Script Generation | gemini-3-flash | ~10,000 |
| TTS (per scene) | gemini-2.5-flash-tts | ~1,000 |

With key rotation, the pipeline comfortably fits within quotas.

---

## Best Practices

### Prompt Engineering

1. **Be specific** - Clear instructions reduce hallucinations
2. **Provide context** - Include relevant data (analytics, history)
3. **Request JSON** - Use `responseMimeType: "application/json"` for structured output
4. **Set temperature** - Lower for factual, higher for creative

### Error Handling

1. **Always retry** - Transient errors are common
2. **Add jitter** - Prevents thundering herd
3. **Fallback gracefully** - Use default values on failure
4. **Log extensively** - Debug information is crucial

### Performance

1. **Batch requests** - Group similar operations
2. **Rotate keys** - Double effective rate limit
3. **Cache results** - Reuse unchanged analytics
4. **Stream when possible** - Reduce latency for long responses

---

## Next: [05-github-actions.md](./05-github-actions.md)
