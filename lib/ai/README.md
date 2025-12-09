# Gemini AI Integration

This directory contains the Gemini AI client setup for the project with proper abstractions for easy integration.

## Setup

1. **Get your API key** from [Google AI Studio](https://aistudio.google.com/app/apikey)

2. **Create a `.env.local` file** in the root directory:
```bash
GEMINI_API_KEY=your_actual_api_key_here
```

3. **Import and use** anywhere in your project:

```typescript
import { GeminiService } from "@/lib/ai";

const geminiService = new GeminiService();
const response = await geminiService.generateText("Your prompt here");
```

## Architecture

### `gemini-client.ts`
- **Singleton pattern** ensures only one instance of the Gemini client exists
- Handles API key validation and initialization
- Provides access to different Gemini models

### `gemini-service.ts`
- **High-level abstraction** over the Gemini API
- Provides convenient methods for common use cases
- Handles error management and response parsing

## Available Methods

### 1. Simple Text Generation
```typescript
const response = await geminiService.generateText("Your prompt");
```

### 2. Text Generation with Config
```typescript
const response = await geminiService.generateText("Your prompt", {
  temperature: 0.9,
  maxOutputTokens: 1000,
  topP: 0.95,
  model: "gemini-2.0-flash-exp"
});
```

### 3. Streaming Response
```typescript
for await (const chunk of geminiService.generateTextStream("Your prompt")) {
  console.log(chunk); // Process each chunk in real-time
}
```

### 4. Chat Sessions
```typescript
const chat = geminiService.startChat({ temperature: 0.7 });
const result1 = await chat.sendMessage("First message");
const result2 = await chat.sendMessage("Follow-up question");
```

### 5. Multimodal (Text + Images)
```typescript
const response = await geminiService.generateFromMultimodal(
  "Analyze this image",
  [{ mimeType: "image/jpeg", data: base64ImageData }]
);
```

### 6. Token Counting
```typescript
const count = await geminiService.countTokens("Your prompt");
```

## Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `model` | string | Model name (default: "gemini-2.0-flash-exp") |
| `temperature` | number | 0.0 to 1.0 - Controls randomness |
| `maxOutputTokens` | number | Maximum tokens in response |
| `topP` | number | Nucleus sampling parameter |
| `topK` | number | Top-k sampling parameter |

## Usage in Next.js

### Server Components
```typescript
import { GeminiService } from "@/lib/ai";

export default async function Page() {
  const gemini = new GeminiService();
  const content = await gemini.generateText("Generate content");
  
  return <div>{content}</div>;
}
```

### API Routes
```typescript
import { GeminiService } from "@/lib/ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { prompt } = await request.json();
  const gemini = new GeminiService();
  const response = await gemini.generateText(prompt);
  
  return NextResponse.json({ response });
}
```

### Server Actions
```typescript
"use server";
import { GeminiService } from "@/lib/ai";

export async function generateContent(prompt: string) {
  const gemini = new GeminiService();
  return await gemini.generateText(prompt);
}
```

## Examples

See `examples.ts` for detailed usage examples including:
- Simple text generation
- Custom configurations
- Streaming responses
- Chat sessions
- Multimodal content
- Token counting
- Different models

## Best Practices

1. **Always use environment variables** for API keys
2. **Handle errors gracefully** - all methods include error handling
3. **Use streaming** for long-form content to improve UX
4. **Monitor token usage** to manage costs
5. **Adjust temperature** based on use case (lower for factual, higher for creative)
