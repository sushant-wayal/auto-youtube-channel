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
                model: 'gemini-2.5-pro',
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
}
