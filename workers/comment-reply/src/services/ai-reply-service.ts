import { GoogleGenAI } from '@google/genai';
import { AIReplyDecision, CommentReplySettings, VideoMetadata } from '../types';

export class AIReplyService {
    private genAI1: GoogleGenAI;
    private genAI2: GoogleGenAI | null = null;
    private lastUsedKey: number = 1;

    constructor() {
        const apiKey1 = process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY;
        const apiKey2 = process.env.GEMINI_API_KEY_2 || null;

        if (!apiKey1) {
            throw new Error('GEMINI_API_KEY_1 or GEMINI_API_KEY is required for AIReplyService');
        }

        this.genAI1 = new GoogleGenAI({ apiKey: apiKey1 });
        if (apiKey2) {
            this.genAI2 = new GoogleGenAI({ apiKey: apiKey2 });
        }
    }

    private getGenAI(): GoogleGenAI {
        if (this.genAI2) {
            this.lastUsedKey = this.lastUsedKey === 1 ? 2 : 1;
            return this.lastUsedKey === 1 ? this.genAI1 : this.genAI2;
        }
        return this.genAI1;
    }

    /**
     * Analyze comment and generate a personalized, context-aware reply
     */
    async generateReply(params: {
        commentText: string;
        authorName: string;
        videoMeta: VideoMetadata;
        settings: CommentReplySettings;
    }): Promise<AIReplyDecision> {
        const { commentText, authorName, videoMeta, settings } = params;

        const systemPrompt = `You are an expert community manager and channel host for a high-quality educational YouTube channel.
Your mission is to foster a vibrant, welcoming, and loyal community by responding thoughtfully to viewers.

CHANNEL IDENTITY & VOICE:
- Tone: ${settings.tone}
- Style: Authentic, concise (1-2 sentences), conversational, and humble.
- NEVER use generic corporate AI boilerplate (NEVER say: "As an AI...", "Thanks for reaching out!", "I hope this helps! Don't hesitate to ask if you have more questions!", "Great question!").
- Sound like a real content creator replying directly from their phone or desk.
- Custom channel guidelines: "${settings.customInstructions || 'Be helpful, genuine, and concise.'}"

VIDEO CONTEXT:
- Title: "${videoMeta.title}"
- Description excerpt: "${videoMeta.description ? videoMeta.description.slice(0, 500) : 'Educational video'}"
${videoMeta.transcript ? `\nVIDEO SPOKEN TRANSCRIPT (EXACT SPOKEN CONTENT):\n"""\n${videoMeta.transcript.slice(0, 20000)}\n"""\n` : ''}
VIEWER COMMENT:
- Author: "${authorName}"
- Comment: "${commentText}"

EVALUATION RULES:
1. Classify the comment into one of: 'question', 'feedback', 'compliment', 'critique', 'spam', 'toxic', 'other'.
2. Determine sentiment: 'positive', 'neutral', 'negative'.
3. Should we reply?
   - If 'spam', 'toxic', troll, offensive, crypto/forex, or self-promotion -> shouldReply = false.
   - If '${settings.replyToQuestionsOnly}' is true and category != 'question' -> shouldReply = false.
   - If meaningful question, compliment, feedback, or constructive critique -> shouldReply = true.
   - If pure short reaction (e.g. single emoji or "nice") -> shouldReply = true with a short, warm, natural reaction or emoji acknowledgement.
4. If shouldReply is true:
   - Craft an engaging, accurate reply directly addressing the viewer's point.
   - If the viewer asks a specific question or references a claim, use the exact spoken transcript above to give an accurate, expert answer grounded in what was actually said.
   - Keep it to 1-2 natural sentences.

Return ONLY a valid JSON object with this exact structure:
{
  "shouldReply": boolean,
  "category": "question" | "feedback" | "compliment" | "critique" | "spam" | "toxic" | "other",
  "sentiment": "positive" | "neutral" | "negative",
  "replyText": "string (or empty if shouldReply is false)",
  "confidence": 0.95,
  "reason": "short explanation of the decision"
}`;

        const MAX_RETRIES = 3;
        const BASE_DELAY_MS = 1500;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const ai = this.getGenAI();
                const modelName = attempt === 1 ? 'gemini-3-flash-preview' : 'gemini-2.5-flash';
                const response = await ai.models.generateContent({
                    model: modelName,
                    contents: systemPrompt,
                    config: {
                        temperature: 0.6,
                        responseMimeType: 'application/json',
                    },
                });

                const text = response.text;
                if (!text) throw new Error('Empty response from Gemini');

                const parsed = JSON.parse(text) as AIReplyDecision;
                return parsed;
            } catch (error: any) {
                console.error(`⚠️ Gemini reply attempt ${attempt}/${MAX_RETRIES} failed:`, error?.message || error);
                if (attempt >= MAX_RETRIES) {
                    return {
                        shouldReply: false,
                        category: 'other',
                        sentiment: 'neutral',
                        confidence: 0,
                        reason: `AI generation failed after ${MAX_RETRIES} attempts: ${error?.message || error}`,
                    };
                }
                const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
                await new Promise((res) => setTimeout(res, delay));
            }
        }

        return {
            shouldReply: false,
            category: 'other',
            sentiment: 'neutral',
            confidence: 0,
            reason: 'Unknown failure',
        };
    }
}
