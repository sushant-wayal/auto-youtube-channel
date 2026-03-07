import GeminiClient from './gemini-client';
import { YouTubeAnalytics } from './youtube-data-service';
import { TrendingSignals, formatTrendingSignalsForPrompt } from './trend-detector';

export interface TopicIdea {
    topic: string;
    reasoning: string;
    targetFormats: {
        longForm: boolean;
        shorts: number; // 3-5
    };
    suggestedAngles: string[];
    estimatedPerformance: {
        score: number; // 0-100
        confidence: 'low' | 'medium' | 'high';
    };
}

/**
 * Gemini-powered Idea Generator
 * Analyzes channel performance and generates high-potential video topics
 */
export class GeminiIdeaGenerator {
    private geminiClient = GeminiClient.getInstance();
    private readonly MAX_RETRIES = 5;
    private readonly BASE_DELAY_MS = 2_000;
    private readonly MAX_DELAY_MS = 30_000;

    /**
     * Analyze channel performance and extract insights
     * Includes exponential backoff for transient 5xx / overload errors
     */
    async analyzeChannelPerformance(analytics: YouTubeAnalytics[]): Promise<string> {
        console.error('🤖 Analyzing channel performance with Gemini AI...');

        if (analytics.length === 0) {
            return "No historical data available for analysis.";
        }

        const shorts = analytics.filter(a => a.isShort);
        const longForm = analytics.filter(a => !a.isShort);

        // Prepare analytics summary
        const summary = {
            totalVideos: analytics.length,
            shorts: {
                count: shorts.length,
                avgViews: this.avg(shorts.map(s => s.views)),
                avgRetention: this.avg(shorts.map(s => s.averageViewPercentage)),
                topPerformers: shorts
                    .sort((a, b) => b.views - a.views)
                    .slice(0, 5)
                    .map(s => ({ title: s.title, views: s.views, retention: s.averageViewPercentage })),
            },
            longForm: {
                count: longForm.length,
                avgViews: this.avg(longForm.map(l => l.views)),
                avgCtr: this.avg(longForm.map(l => l.ctr)),
                avgRetention: this.avg(longForm.map(l => l.averageViewPercentage)),
                topPerformers: longForm
                    .sort((a, b) => b.views - a.views)
                    .slice(0, 5)
                    .map(l => ({ title: l.title, views: l.views, ctr: l.ctr, retention: l.averageViewPercentage })),
            },
        };

        const prompt = `You are an expert YouTube content strategist. Analyze this channel's performance data and provide strategic insights.

Channel Performance Summary:
${JSON.stringify(summary, null, 2)}

Provide a detailed analysis covering:
1. Content patterns that perform well (topics, themes, keywords)
2. Performance trends (shorts vs long-form, engagement patterns)
3. Audience preferences and retention signals
4. Gaps or opportunities in current content
5. Emerging patterns that could be leveraged

Be specific and data-driven. Focus on actionable insights.`;

        let attempt = 0;
        while (attempt < this.MAX_RETRIES) {
            attempt++;

            try {
                console.error(`🧠 Gemini channel analysis (attempt ${attempt}/${this.MAX_RETRIES})`);

                const genAI = this.geminiClient.getGenAI();
                const result = await genAI.models.generateContent({
                    model: "gemini-3-flash-preview",
                    contents: prompt,
                    config: {
                        temperature: 0.7,
                    }
                });

                const text = result.text || '';

                console.error('✅ Channel analysis complete');
                return text;

            } catch (error: any) {
                const apiError = error?.error || error?.response?.error || error?.cause?.error;
                const statusCode = apiError?.code || apiError?.status || error?.status || error?.code;
                const message = error?.message?.toLowerCase?.() || "";

                const isRetryable =
                    statusCode === 500 ||
                    statusCode === 503 ||
                    message.includes("internal") ||
                    message.includes("overloaded") ||
                    message.includes("unavailable");

                if (!isRetryable || attempt >= this.MAX_RETRIES) {
                    console.error('❌ Gemini channel analysis failed permanently:', error.message);
                    throw error;
                }

                const delay = Math.min(
                    this.BASE_DELAY_MS * 2 ** (attempt - 1),
                    this.MAX_DELAY_MS
                ) + Math.floor(Math.random() * 1_000); // jitter

                console.warn(`⚠️ Gemini error (retryable). Retrying in ${delay}ms...`);
                await new Promise(res => setTimeout(res, delay));
            }
        }

        throw new Error("Gemini channel analysis failed after maximum retries");
    }

    /**
     * Generate video topic ideas based on channel insights
     * Includes exponential backoff for transient 5xx / overload errors
     */
    async generateTopicIdeas(
        channelInsights: string,
        analytics: YouTubeAnalytics[],
        count: number = 10,
        trendingSignals?: TrendingSignals
    ): Promise<TopicIdea[]> {
        console.error(`🎯 Generating ${count} topic ideas with Gemini AI...`);

        const recentTitles = analytics.slice(0, 20).map(a => a.title);

        const trendingSection = trendingSignals
            ? `\nEXTERNAL TRENDING SIGNALS (use these to make ideas timely and topical):\n${formatTrendingSignalsForPrompt(trendingSignals)}`
            : '';

        const prompt = `You are an expert YouTube content strategist. Based on the channel analysis below, generate ${count} high-potential video topic ideas.

CHANNEL INSIGHTS:
${channelInsights}

RECENT VIDEOS (to avoid repetition):
${recentTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}${trendingSection}

REQUIREMENTS:
- Each topic should be GENERIC enough to produce 1 long-form video (8-15 min) AND 3-5 shorts (30-60 sec)
- Topics should leverage identified successful patterns
- Avoid topics too similar to recent videos
- Balance evergreen content with trending opportunities
- Where relevant, use the EXTERNAL TRENDING SIGNALS above to pick timely topics that are being discussed RIGHT NOW
- Consider audience retention signals

For each idea, provide:
1. Topic (clear, specific)
2. Reasoning (why it will perform well, backed by data insights)
3. Target formats (1 long + how many shorts, 3-5)
4. Suggested angles (specific angles for the long-form and shorts)
5. Performance score (0-100) and confidence (low/medium/high)

Format your response as a JSON array of objects with this structure:
[
  {
    "topic": "string",
    "reasoning": "string",
    "targetFormats": {
      "longForm": true,
      "shorts": 4
    },
    "suggestedAngles": ["angle1", "angle2"],
    "estimatedPerformance": {
      "score": 85,
      "confidence": "high"
    }
  }
]

RESPOND ONLY WITH VALID JSON ARRAY. NO MARKDOWN, NO EXPLANATIONS.`;

        let attempt = 0;
        while (attempt < this.MAX_RETRIES) {
            attempt++;

            try {
                console.error(`🧠 Gemini idea generation (attempt ${attempt}/${this.MAX_RETRIES})`);

                const genAI = this.geminiClient.getGenAI();
                const result = await genAI.models.generateContent({
                    model: "gemini-3-flash-preview",
                    contents: prompt,
                    config: {
                        temperature: 0.8,
                        responseMimeType: "application/json",
                    }
                });

                const text = result.text || '[]';

                const ideas: TopicIdea[] = JSON.parse(text);

                // Validate and sanitize
                const validIdeas = ideas
                    .filter(idea =>
                        idea.topic &&
                        idea.reasoning &&
                        idea.targetFormats?.shorts >= 3 &&
                        idea.targetFormats?.shorts <= 5
                    )
                    .slice(0, count);

                console.error(`✅ Generated ${validIdeas.length} topic ideas`);
                return validIdeas;

            } catch (error: any) {
                // Check if it's a JSON parse error with valid API response
                const isJsonError = error?.message?.includes('JSON') || error?.message?.includes('parse');

                // For JSON errors, don't retry - the response is complete but malformed
                if (isJsonError) {
                    console.error('❌ JSON parsing error in Gemini response:', error.message);
                    throw error;
                }

                const apiError = error?.error || error?.response?.error || error?.cause?.error;
                const statusCode = apiError?.code || apiError?.status || error?.status || error?.code;
                const message = error?.message?.toLowerCase?.() || "";

                const isRetryable =
                    statusCode === 500 ||
                    statusCode === 503 ||
                    message.includes("internal") ||
                    message.includes("overloaded") ||
                    message.includes("unavailable");

                if (!isRetryable || attempt >= this.MAX_RETRIES) {
                    console.error('❌ Gemini idea generation failed permanently:', error.message);
                    throw error;
                }

                const delay = Math.min(
                    this.BASE_DELAY_MS * 2 ** (attempt - 1),
                    this.MAX_DELAY_MS
                ) + Math.floor(Math.random() * 1_000); // jitter

                console.warn(`⚠️ Gemini error (retryable). Retrying in ${delay}ms...`);
                await new Promise(res => setTimeout(res, delay));
            }
        }

        throw new Error("Gemini idea generation failed after maximum retries");
    }

    /**
     * Rank and select the best topic from generated ideas
     * Includes exponential backoff for transient 5xx / overload errors
     */
    async selectBestTopic(ideas: TopicIdea[]): Promise<TopicIdea> {
        console.error('🏆 Selecting best topic with Gemini AI...');

        if (ideas.length === 0) {
            throw new Error('No ideas to select from');
        }

        if (ideas.length === 1) {
            console.error('✅ Only one idea available, selecting it');
            return ideas[0];
        }

        const prompt = `You are an expert YouTube content strategist. Review these topic ideas and select the ONE with the highest potential for success.

TOPIC IDEAS:
${JSON.stringify(ideas, null, 2)}

SELECTION CRITERIA:
1. Balance between performance potential and feasibility
2. Alignment with demonstrated channel strengths
3. Ability to generate engaging long-form + shorts content
4. Uniqueness and freshness compared to recent content
5. Audience retention and engagement potential

Respond with the INDEX (0-based) of the best topic and a brief justification.

Format: { "selectedIndex": 0, "justification": "why this is the best choice" }

RESPOND ONLY WITH VALID JSON. NO MARKDOWN.`;

        let attempt = 0;
        while (attempt < this.MAX_RETRIES) {
            attempt++;

            try {
                console.error(`🧠 Gemini topic selection (attempt ${attempt}/${this.MAX_RETRIES})`);

                const genAI = this.geminiClient.getGenAI();
                const result = await genAI.models.generateContent({
                    model: "gemini-3-flash-preview",
                    contents: prompt,
                    config: {
                        temperature: 0.3, // Lower temperature for decisive selection
                        responseMimeType: "application/json",
                    }
                });

                const text = result.text || '{"selectedIndex": 0, "justification": "Default selection"}';

                const selection: { selectedIndex: number; justification: string } = JSON.parse(text);

                const selectedTopic = ideas[selection.selectedIndex];

                console.error(`✅ Selected: "${selectedTopic.topic}"`);
                console.error(`   Reason: ${selection.justification}`);

                return selectedTopic;

            } catch (error: any) {
                // Check if it's a JSON parse error or selection logic error
                const isJsonError = error?.message?.includes('JSON') || error?.message?.includes('parse');
                const isIndexError = error?.message?.includes('undefined') || error?.message?.includes('index');

                // For non-retryable errors, fall back to highest scored idea
                if (isJsonError || isIndexError) {
                    console.error('⚠️ Error in AI selection, falling back to highest scored idea:', error.message);
                    const sorted = [...ideas].sort((a, b) =>
                        b.estimatedPerformance.score - a.estimatedPerformance.score
                    );
                    return sorted[0];
                }

                const apiError = error?.error || error?.response?.error || error?.cause?.error;
                const statusCode = apiError?.code || apiError?.status || error?.status || error?.code;
                const message = error?.message?.toLowerCase?.() || "";

                const isRetryable =
                    statusCode === 500 ||
                    statusCode === 503 ||
                    message.includes("internal") ||
                    message.includes("overloaded") ||
                    message.includes("unavailable");

                if (!isRetryable || attempt >= this.MAX_RETRIES) {
                    console.error('⚠️ Gemini selection failed, falling back to highest scored idea');
                    const sorted = [...ideas].sort((a, b) =>
                        b.estimatedPerformance.score - a.estimatedPerformance.score
                    );
                    return sorted[0];
                }

                const delay = Math.min(
                    this.BASE_DELAY_MS * 2 ** (attempt - 1),
                    this.MAX_DELAY_MS
                ) + Math.floor(Math.random() * 1_000); // jitter

                console.warn(`⚠️ Gemini error (retryable). Retrying in ${delay}ms...`);
                await new Promise(res => setTimeout(res, delay));
            }
        }

        // Final fallback
        console.error('⚠️ Maximum retries reached, falling back to highest scored idea');
        const sorted = [...ideas].sort((a, b) =>
            b.estimatedPerformance.score - a.estimatedPerformance.score
        );
        return sorted[0];
    }

    /**
     * Calculate average of numbers
     */
    private avg(numbers: number[]): number {
        if (numbers.length === 0) return 0;
        return Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length);
    }
}
