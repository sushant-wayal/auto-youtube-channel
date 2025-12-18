# OpenAI TTS Integration

This directory contains the OpenAI Text-to-Speech setup for generating high-quality voiceovers.

## Setup

### API Key Required

You need an OpenAI API key:

1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Add to `.env.local`:
```bash
OPENAI_API_KEY=sk-proj-...
```

## Pricing

OpenAI TTS is **very affordable**:
- **$0.015 per 1,000 characters** (tts-1 model)
- **$0.030 per 1,000 characters** (tts-1-hd model - higher quality)

For a typical 7-minute video (6,000 characters):
- Cost: ~$0.09 (less than 10 cents!)
- Generation time: ~10-15 seconds total

## How It Works

### Direct OpenAI SDK
Uses the official OpenAI Node.js SDK to call their TTS API.

### Voice Options
Choose from 6 high-quality voices:
- **alloy** - Neutral
- **echo** - Male
- **fable** - British accent
- **onyx** - Deep male (default)
- **nova** - Female
- **shimmer** - Soft female

### Smart Chunking
- Up to 4,096 characters per request
- Respects sentence boundaries
- 500ms delays between chunks
- Seamless concatenation

## Usage

### Through Pipeline
```typescript
import VideoGenerationPipeline from "@/lib/pipeline";

const pipeline = new VideoGenerationPipeline();
const audioUrl = await pipeline.generateAudio(script);
```

### Direct Usage
```typescript
import TTSService from "@/lib/audio";

const tts = new TTSService();
const audioPath = await tts.generateLongFormSpeech(
  "Your narration text here",
  "./output.mp3",
  { voice: "onyx", speed: 1.0 }
);
```

## Features

### 1. Text Processing
- Removes `[PAUSE]` markers and converts to commas
- Cleans extra whitespace

### 2. Smart Chunking
- 4,000-character chunks (under OpenAI's 4,096 limit)
- Respects sentence boundaries
- 500ms delays between chunks

### 3. File Management
- Saves to `public/generated/`
- Auto-creates directories
- Returns public URL

## Why OpenAI TTS?

✅ **Reliable** - Always available, no cold starts
✅ **Fast** - ~1 second per chunk
✅ **High Quality** - Natural-sounding voices
✅ **Affordable** - Less than $0.10 per video
✅ **Simple** - No complex setup or fallbacks needed

## Troubleshooting

### "OPENAI_API_KEY not found" error
Make sure you have `OPENAI_API_KEY` in `.env.local`:

```bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
```

Then restart your dev server:
```bash
# Stop with Ctrl+C, then:
npm run dev
```

### Rate limit errors?
OpenAI has generous rate limits:
- Tier 1 (new): 3 RPM (requests per minute)
- Tier 2 ($5+ spent): 50 RPM

Our 500ms delay ensures you stay well under limits.

## Previous: Hugging Face Issues

⚠️ Hugging Face TTS models are no longer available through their standard Inference API. We've switched to OpenAI for reliability and quality.

# Hugging Face TTS Integration (Free Tier)

⚠️ **Important Note**: The Hugging Face free Inference API has significant limitations:
- Models often in "cold start" (20-30 second delays)
- Rate limits and timeouts are common
- Some models may not be available
- Generation can take 5-10 minutes for a full video

**For production use, we recommend OpenAI TTS** (see below).

## Current Setup: Hugging Face Free

### How It Works
Using the `@huggingface/inference` SDK with these models:
- `facebook/fastspeech2-en-ljspeech` (primary)
- `espnet/kan-bayashi_ljspeech_joint_finetune_conformer_fastspeech2_hifigan` (fallback)

### Limitations
- ❌ Slow (25-30s per chunk due to cold starts)
- ❌ Unreliable (models may timeout)
- ❌ Small chunks required (200 chars max)
- ❌ Poor quality audio
- ❌ No voice options

### Setup
```bash
# Add to .env.local (optional, works without it)
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxx
```

## Recommended: OpenAI TTS

For reliable, fast, high-quality audio:

### Pricing
- **$0.015 per 1,000 characters** (tts-1 model)
- A 7-minute video (~6,000 chars) = **~$0.09**

### Benefits
- ✅ Fast (~1 second per chunk)
- ✅ Reliable (always available)
- ✅ High quality (6 professional voices)
- ✅ Large chunks (4,096 chars)
- ✅ Simple API

### Setup OpenAI
1. Get API key: https://platform.openai.com/api-keys
2. Add to `.env.local`:
```bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
```

### Switch to OpenAI
The code is ready - just uncomment the OpenAI version and comment out Hugging Face in `tts-service.ts`.

Or get a free trial: OpenAI gives $5 free credit for new accounts = **500+ videos**!

## Troubleshooting HF Issues

### "No Inference Provider available"
These models aren't on the free inference API. Try waiting or use OpenAI.

### "Model is currently loading"
Cold start - wait 25-30 seconds. The code automatically retries.

### Timeout errors
HF free API is unreliable. Try:
1. Shorter scripts
2. Try again in a few minutes
3. Use OpenAI TTS instead

### Rate limit errors
HF free API has strict limits. The code adds 3-second delays between chunks, but you may still hit limits.

## Why OpenAI is Better

| Feature | Hugging Face Free | OpenAI TTS |
|---------|------------------|------------|
| Speed | 25-30s per chunk | 1s per chunk |
| Reliability | Poor | Excellent |
| Quality | Basic | Professional |
| Cost | Free | $0.09 per video |
| Setup | Complex | Simple |

**Bottom line**: HF free is good for testing, but for actual video production, OpenAI is worth the $0.09 per video.
