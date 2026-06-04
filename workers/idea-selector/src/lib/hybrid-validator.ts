import { TopicIdea } from './gemini-idea-generator';
import { YouTubeAnalytics } from './youtube-data-service';
import { Idea, UploadRecord } from '../types';
import { hardEliminate } from './eliminator';
import { rankIdeas } from './ranker';

/**
 * Hybrid Idea Validator
 * Validates AI-generated ideas against historical data to prevent hallucination
 */
export class HybridValidator {

    /**
     * Convert AI-generated TopicIdea to traditional Idea format for validation
     */
    convertToIdea(topicIdea: TopicIdea, format: 'short' | 'long'): Idea {
        return {
            topic: this.extractTopic(topicIdea.topic),
            subtopic: this.extractSubtopic(topicIdea.topic),
            angle: topicIdea.suggestedAngles[0] || topicIdea.topic,
        };
    }

    /**
     * Convert YouTube analytics to UploadRecord format
     */
    convertAnalyticsToHistory(analytics: YouTubeAnalytics[]): UploadRecord[] {
        return analytics.map(a => ({
            topic: this.extractTopic(a.title),
            subtopic: this.extractSubtopic(a.title),
            angle: a.title,
            format: a.isShort ? 'short' : 'long' as 'short' | 'long',
            uploadTimestamp: new Date(a.publishedAt).getTime(),
            impressions: a.impressions,
            ctr: a.ctr / 100, // Convert percentage to 0-1
            retention: a.averageViewPercentage / 100, // Convert to 0-1
            comments: a.comments,
        }));
    }

    /**
     * Apply hard elimination rules to AI ideas
     * @param aiIdeas - AI-generated topic ideas
     * @param history - Historical upload records
     * @param queueIdeas - Ideas already in the queue (to avoid duplicates)
     */
    applyHardElimination(
        aiIdeas: TopicIdea[],
        history: UploadRecord[],
        queueIdeas: string[] = []
    ): TopicIdea[] {
        console.error('\n🚫 STEP: Hard Elimination (Anti-Hallucination)');

        const beforeCount = aiIdeas.length;

        // Filter out ideas that are too similar to queue ideas
        let remainingIdeas = aiIdeas;
        if (queueIdeas.length > 0) {
            console.error(`   📋 Checking against ${queueIdeas.length} queued ideas...`);
            remainingIdeas = aiIdeas.filter(aiIdea => {
                // Check if AI idea topic is too similar to any queued idea
                const aiTopicLower = aiIdea.topic.toLowerCase();
                const isSimilarToQueue = queueIdeas.some(queueIdea => {
                    const queueLower = queueIdea.toLowerCase();
                    // Consider similar if:
                    // 1. Exact match
                    // 2. Queue idea is substring of AI idea
                    // 3. AI idea is substring of queue idea
                    // 4. High word overlap (>60%)
                    if (aiTopicLower === queueLower) return true;
                    if (aiTopicLower.includes(queueLower) || queueLower.includes(aiTopicLower)) return true;

                    const aiWords = new Set(aiTopicLower.split(/\s+/).filter(w => w.length > 3));
                    const queueWords = new Set(queueLower.split(/\s+/).filter(w => w.length > 3));
                    const commonWords = [...aiWords].filter(w => queueWords.has(w));
                    const overlapRatio = commonWords.length / Math.min(aiWords.size, queueWords.size);

                    return overlapRatio > 0.6;
                });

                return !isSimilarToQueue;
            });

            const queueEliminated = beforeCount - remainingIdeas.length;
            if (queueEliminated > 0) {
                console.error(`   ✗ ${queueEliminated} ideas eliminated (similar to queued ideas)`);
            }
        }

        // Convert AI ideas to both formats for checking
        const ideasToCheck: Idea[] = [];
        const ideaMapping: Map<Idea, TopicIdea> = new Map();

        for (const aiIdea of remainingIdeas) {
            const shortIdea = this.convertToIdea(aiIdea, 'short');
            const longIdea = this.convertToIdea(aiIdea, 'long');
            ideasToCheck.push(shortIdea, longIdea);
            ideaMapping.set(shortIdea, aiIdea);
            ideaMapping.set(longIdea, aiIdea);
        }

        // Apply elimination rules (30-day window, overuse threshold)
        const eligible = hardEliminate(ideasToCheck, history, {
            recentDaysWindow: 30,
            topicOveruseThreshold: 2.0,
        });

        // Get unique AI ideas that passed
        const passedAiIdeas = new Set<TopicIdea>();
        for (const idea of eligible) {
            const aiIdea = ideaMapping.get(idea);
            if (aiIdea) passedAiIdeas.add(aiIdea);
        }

        const result = Array.from(passedAiIdeas);
        const eliminated = beforeCount - result.length;

        console.error(`   ✓ ${result.length} ideas passed hard elimination`);
        console.error(`   ✗ ${eliminated} ideas eliminated (duplicates, recent, overused)`);

        if (result.length === 0) {
            console.error('   ⚠️  All ideas eliminated! Relaxing constraints...');
            // Fallback: return top 3 AI ideas by composite score
            return aiIdeas
                .sort((a, b) => this.getCompositeScore(b) - this.getCompositeScore(a))
                .slice(0, 3);
        }

        return result;
    }

    /**
     * Apply formula-based ranking to validate AI scores
     */
    applyFormulaRanking(
        aiIdeas: TopicIdea[],
        history: UploadRecord[]
    ): Array<{ idea: TopicIdea; aiScore: number; formulaScore: number; hybrid: number }> {
        console.error('\n📊 STEP: Formula-Based Validation');

        // Convert to traditional format
        const ideas = aiIdeas.map(ai => this.convertToIdea(ai, 'long'));

        // Get formula-based ranking
        const rankedIdeas = rankIdeas(ideas, history);

        // Calculate hybrid scores (combine AI + formula)
        const results = aiIdeas.map((aiIdea, index) => {
            const formulaRank = rankedIdeas.findIndex(
                ranked => ranked.topic === this.extractTopic(aiIdea.topic) &&
                    ranked.subtopic === this.extractSubtopic(aiIdea.topic)
            );

            // Normalize scores 0-100
            const aiScore = this.clampScore(aiIdea.performanceScore ?? aiIdea.estimatedPerformance.score);
            const formulaScore = formulaRank >= 0
                ? 100 - (formulaRank / rankedIdeas.length * 100)
                : 50;
            const breadthScore = this.clampScore(aiIdea.audienceBreadthScore);
            const titleScore = this.clampScore(aiIdea.titlePotentialScore);
            const breadthAdjusted = breadthScore < 50 ? breadthScore * 0.35 : breadthScore;

            // Hybrid: performance + formula + audience breadth + title potential
            const hybrid = (aiScore * 0.34) + (formulaScore * 0.18) + (breadthAdjusted * 0.28) + (titleScore * 0.20);

            return { idea: aiIdea, aiScore, formulaScore, hybrid };
        });

        // Sort by hybrid score
        results.sort((a, b) => b.hybrid - a.hybrid);

        console.error('   Top 3 Hybrid Scores:');
        results.slice(0, 3).forEach((r, i) => {
            console.error(`   ${i + 1}. ${r.idea.topic}`);
            console.error(`      AI: ${r.aiScore}, Breadth: ${r.idea.audienceBreadthScore}, Title: ${r.idea.titlePotentialScore}, Formula: ${r.formulaScore.toFixed(1)}, Hybrid: ${r.hybrid.toFixed(1)}`);
        });

        return results;
    }

    /**
     * Validate AI idea feasibility against historical data
     */
    validateFeasibility(
        aiIdea: TopicIdea,
        analytics: YouTubeAnalytics[]
    ): { feasible: boolean; reason: string; confidence: number } {
        // Check if topic aligns with channel's historical content
        const topicKeywords = this.extractKeywords(aiIdea.topic);
        const channelKeywords = analytics
            .flatMap(a => this.extractKeywords(a.title))
            .reduce((acc, kw) => {
                acc[kw] = (acc[kw] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

        // Calculate overlap
        const overlap = topicKeywords.filter(kw => channelKeywords[kw] > 0).length;
        const overlapPercent = overlap / Math.max(topicKeywords.length, 1);

        if (overlapPercent < 0.2) {
            return {
                feasible: false,
                reason: 'Topic too far from channel\'s historical content',
                confidence: overlapPercent,
            };
        }

        // Check if format mix is realistic
        const shortCount = analytics.filter(a => a.isShort).length;
        const longCount = analytics.filter(a => !a.isShort).length;
        const hasShortExperience = shortCount > 0;
        const hasLongExperience = longCount > 0;

        if (aiIdea.targetFormats.longForm && !hasLongExperience) {
            return {
                feasible: false,
                reason: 'No historical long-form content to validate against',
                confidence: 0,
            };
        }

        if (aiIdea.targetFormats.shorts > 0 && !hasShortExperience) {
            return {
                feasible: false,
                reason: 'No historical shorts to validate against',
                confidence: 0,
            };
        }

        return {
            feasible: true,
            reason: 'Aligns with channel\'s content patterns',
            confidence: overlapPercent,
        };
    }

    /**
     * Extract main topic from title (simple heuristic)
     */
    private extractTopic(title: string): string {
        // Remove common words and take first meaningful word
        const words = title.toLowerCase().split(/\s+/)
            .filter(w => !['the', 'a', 'an', 'how', 'to', 'with', 'for', 'in', 'on'].includes(w));
        return words[0] || title.split(/\s+/)[0] || 'general';
    }

    /**
     * Extract subtopic from title
     */
    private extractSubtopic(title: string): string {
        const words = title.toLowerCase().split(/\s+/);
        return words.slice(0, 2).join(' ') || 'general';
    }

    /**
     * Extract keywords from text
     */
    private extractKeywords(text: string): string[] {
        return text.toLowerCase()
            .split(/\s+/)
            .filter(w => w.length > 3)
            .filter(w => !['the', 'and', 'for', 'with', 'this', 'that', 'from'].includes(w));
    }

    private clampScore(score: number): number {
        if (!Number.isFinite(score)) return 0;
        return Math.max(0, Math.min(100, Math.round(score)));
    }

    private getCompositeScore(idea: TopicIdea): number {
        const breadth = this.clampScore(idea.audienceBreadthScore);
        const title = this.clampScore(idea.titlePotentialScore);
        const performance = this.clampScore(idea.performanceScore ?? idea.estimatedPerformance.score);
        const breadthAdjusted = breadth < 50 ? breadth * 0.35 : breadth;

        return (performance * 0.34) + (breadthAdjusted * 0.28) + (title * 0.20);
    }
}
