import { GoogleGenAI } from '@google/genai';
import crypto from 'crypto';
import { SeriesState, LearningQueueItem } from './types';

export class SeriesAIService {
    private ai: GoogleGenAI;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY is missing");
        this.ai = new GoogleGenAI({ apiKey });
    }

    async generateNextEpisodes(series: SeriesState, count: number = 3): Promise<LearningQueueItem[]> {
        const prompt = `You are an expert curriculum designer managing an adaptive learning journey.

SERIES GOAL: ${series.learningGoal}
ALREADY COVERED (History):
${series.history.length > 0 ? series.history.map(h => `- Ep ${h.episodeNum}: ${h.topic}`).join("\n") : "None (Starting new series)"}

CURRENT PENDING QUEUE:
${series.learningQueue.filter(q => q.status === "pending").map(q => `- ${q.topic} (${q.learningObjective})`).join("\n") || "Queue is empty"}

TASK:
Based on the overarching goal, the history of what has already been taught, and the existing items still pending in the queue, infer what logical concepts remain.
Generate the NEXT ${count} episodes to add to the queue.

REQUIREMENTS:
- Progress difficulty naturally.
- Ensure each topic is distinct but builds upon previous knowledge.
- The topics must be independently valuable to a new viewer.

Return ONLY a valid JSON array of objects with this exact structure:
[
  {
    "topic": "Topic Name",
    "learningObjective": "Clear objective of what the viewer will learn",
    "difficulty": "beginner" | "intermediate" | "advanced",
    "estimatedDuration": "10m",
    "prerequisites": ["List of concepts they should know, even if covered earlier"]
  }
]`;

        try {
            const response = await this.ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    temperature: 0.7,
                    responseMimeType: "application/json",
                }
            });

            const text = response.text;
            if (!text) throw new Error("Empty response from AI");
            
            const parsed = JSON.parse(text);
            return parsed.map((item: any) => ({
                ...item,
                episodeId: crypto.randomUUID(),
                status: "pending"
            }));
        } catch (error) {
            console.error("Failed to generate next episodes:", error);
            throw error;
        }
    }

    async decideAndInventNewSeries(
        allSeriesContext: SeriesState[],
        activeCount: number,
        channelAnalytics: any[]
    ): Promise<{ shouldCreate: boolean; id?: string; title?: string; learningGoal?: string }> {
        // Enforce constraints before asking AI:
        // Cap is 10, but the healthy target is only 2-3 active series to avoid overkilling the series format
        if (activeCount >= 3) {
            console.error(`[SeriesAIService] Healthy active series limit reached (${activeCount} active). Preserving channel bandwidth for standalone topics.`);
            return { shouldCreate: false };
        }

        // Only force creation if there are literally zero active series on the channel
        const forceCreate = activeCount === 0;

        const allSeriesStr = allSeriesContext.length > 0
            ? allSeriesContext.map(s => `- ID: ${s.id} | Title: ${s.title} | Goal: ${s.learningGoal} | Status: ${s.status}`).join("\n")
            : "No previous series history.";

        // Sort analytics by views and retention for the AI to see the top performers
        const sortedAnalytics = channelAnalytics
            .sort((a, b) => b.views - a.views)
            .slice(0, 20); // Top 20 recent videos

        const analyticsStr = sortedAnalytics.length > 0
            ? sortedAnalytics.map(a => `- Title: "${a.title}" | Views: ${a.views} | CTR: ${a.ctr}% | Retention: ${a.averageViewPercentage}%`).join("\n")
            : "No analytics available yet.";

        const prompt = `You are the lead channel strategist for a highly technical YouTube channel.
Your goal is to decide if we should launch a NEW multi-part series, keeping in mind that STANDALONE videos are the primary format of this channel.

CRITICAL POLICY:
- Most videos on the channel MUST be standalone videos. Series/playlists must NOT dominate the channel.
- A series should ONLY be created if there is overwhelming audience demand in a specific niche that cannot be satisfied in a single standalone video.
- The healthy target is only 2 to 3 active series concurrently (absolute max cap 10). Currently active: ${activeCount}.
- Do NOT create a series just because you can. Only create one if there is an undeniable performance signal.

CURRENT CONTEXT:
Active Series Count: ${activeCount} (Target: 2-3, Max: 10)
Force Creation? ${forceCreate ? "YES (Zero active series exist, create 1 focused series)" : "NO (Only create if analytics show overwhelming demand)"}

PREVIOUS/EXISTING SERIES (Do NOT duplicate these):
${allSeriesStr}

CHANNEL PERFORMANCE ANALYTICS (Top recent long-form videos):
${analyticsStr}

TASK:
1. If Force Creation is YES, create 1 cohesive, high-demand series.
2. If Force Creation is NO, default to shouldCreate: false unless you see exceptional breakout metrics for an uncovered topic.
3. If creating a new series, provide a catchy 'title', a concise 'learningGoal', and a url-friendly 'id' (e.g. 'mastering-system-design').

Return ONLY a valid JSON object with this exact structure:
{
  "shouldCreate": boolean,
  "id": "string (optional)",
  "title": "string (optional)",
  "learningGoal": "string (optional)"
}`;

        try {
            const response = await this.ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    temperature: 0.7,
                    responseMimeType: "application/json",
                }
            });

            const text = response.text;
            if (!text) throw new Error("Empty response from AI");
            
            return JSON.parse(text);
        } catch (error) {
            console.error("Failed to decide on new series:", error);
            throw error;
        }
    }
}
