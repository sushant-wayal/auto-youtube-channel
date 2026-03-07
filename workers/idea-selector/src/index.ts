#!/usr/bin/env node
/**
 * Hybrid Idea Selector Worker
 * 
 * Combines AI intelligence with deterministic safety rails:
 * 1. Fetches channel data via YouTube API (autonomous)
 * 2. Generates ideas with Gemini AI (creative)
 * 3. Applies hard elimination rules (anti-hallucination)
 * 4. Validates with formula-based ranking (deterministic)
 * 5. AI makes final selection (intelligent)
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') });

import { YouTubeDataService } from './lib/youtube-data-service';
import { GeminiIdeaGenerator, TopicIdea } from './lib/gemini-idea-generator';
import { HybridValidator } from './lib/hybrid-validator';
import { fetchTrendingSignals, TrendingSignals } from './lib/trend-detector';

interface IdeaSelectorResult {
    success: boolean;
    selectedTopic?: TopicIdea;
    channelInsights?: string;
    generatedIdeas?: TopicIdea[];
    trendingSignals?: TrendingSignals;
    error?: string;
}

interface IdeaSelectorOptions {
    existingQueueIdeas?: string[]; // Ideas already in the queue to avoid duplicates
}

async function runIdeaSelector(options: IdeaSelectorOptions = {}): Promise<IdeaSelectorResult> {
    console.error('🚀 Starting Autonomous Idea Selector Worker...\n');

    try {
        // Validate environment variables
        const requiredEnvVars = [
            'GEMINI_API_KEY_1',
            'YT_CLIENT_ID',
            'YT_CLIENT_SECRET',
            'YT_REFRESH_TOKEN',
        ];

        const missingVars = requiredEnvVars.filter(v => !process.env[v]);
        if (missingVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
        }

        // Step 0: Fetch trending signals (concurrent, non-blocking on failure)
        console.error('📡 STEP 0: Fetching trending signals...');
        let trendingSignals: TrendingSignals | undefined;
        try {
            trendingSignals = await fetchTrendingSignals();
        } catch (err: any) {
            console.error(`⚠️  Trend detection failed (non-fatal), continuing without: ${err.message}`);
        }

        // Step 1: Fetch channel videos from YouTube
        console.error('\n📊 STEP 1: Fetching channel data from YouTube...');
        const youtubeService = new YouTubeDataService();
        const recentVideos = await youtubeService.fetchRecentVideos(50);

        if (recentVideos.length === 0) {
            throw new Error('No videos found in channel. Cannot generate ideas.');
        }

        // Step 2: Fetch analytics for videos
        console.error('\n📈 STEP 2: Fetching video analytics...');
        const analytics = await youtubeService.fetchVideoAnalytics(recentVideos, 90); // last 90 days

        if (analytics.length === 0) {
            console.error('⚠️ No analytics data available. Using limited analysis...');
        }

        // Step 3: Analyze channel performance with Gemini AI
        console.error('\n🤖 STEP 3: Analyzing channel performance with AI...');
        const geminiGenerator = new GeminiIdeaGenerator();
        const channelInsights = await geminiGenerator.analyzeChannelPerformance(analytics);

        console.error('\n📊 Channel Insights:');
        console.error('─'.repeat(80));
        console.error(channelInsights);
        console.error('─'.repeat(80));

        // Step 4: Generate topic ideas with Gemini AI (+ trending signals)
        console.error('\n💡 STEP 4: Generating video topic ideas with AI...');
        const rawIdeas = await geminiGenerator.generateTopicIdeas(channelInsights, analytics, 15, trendingSignals);

        console.error(`   Generated ${rawIdeas.length} raw AI ideas`);

        // Step 5: HYBRID - Apply hard elimination rules (anti-hallucination)
        console.error('\n🛡️  STEP 5: Applying Hard Elimination Rules...');
        const validator = new HybridValidator();
        const history = validator.convertAnalyticsToHistory(analytics);

        // Also consider existing queue ideas as "recent" to avoid duplicates
        const queueIdeas = options.existingQueueIdeas || [];
        const nonEliminated = validator.applyHardElimination(rawIdeas, history, queueIdeas);

        console.error(`   ${nonEliminated.length} ideas passed elimination`);

        // Step 6: HYBRID - Formula-based ranking validation
        console.error('\n📐 STEP 6: Formula-Based Ranking Validation...');
        const hybridScores = validator.applyFormulaRanking(nonEliminated, history);

        // Take top 5 by hybrid score
        const topIdeas = hybridScores.slice(0, 5).map(h => h.idea);

        console.error(`\n🎯 Top 5 Validated Ideas:`);
        hybridScores.slice(0, 5).forEach((h, i) => {
            console.error(`${i + 1}. ${h.idea.topic}`);
            console.error(`   AI: ${h.aiScore}, Formula: ${h.formulaScore.toFixed(1)}, Hybrid: ${h.hybrid.toFixed(1)}`);
        });

        // Step 7: AI final selection from validated top 5
        console.error('\n🏆 STEP 7: AI Final Selection (from validated top 5)...');
        const selectedTopic = await geminiGenerator.selectBestTopic(topIdeas);

        console.error('\n' + '═'.repeat(80));
        console.error('✅ SELECTED TOPIC (Hybrid: AI + Rules)');
        console.error('═'.repeat(80));
        console.error(`\n📌 Topic: ${selectedTopic.topic}`);
        console.error(`\n📊 Performance Score: ${selectedTopic.estimatedPerformance.score}/100 (${selectedTopic.estimatedPerformance.confidence} confidence)`);
        console.error(`\n🎬 Target Formats:`);
        console.error(`   - 1 Long-form video (8-15 min)`);
        console.error(`   - ${selectedTopic.targetFormats.shorts} Shorts (30-60 sec each)`);
        console.error(`\n💭 Reasoning:`);
        console.error(selectedTopic.reasoning);
        console.error(`\n🎨 Suggested Angles:`);
        selectedTopic.suggestedAngles.forEach((angle, i) => {
            console.error(`   ${i + 1}. ${angle}`);
        });
        console.error(`\n🛡️  Validation: Passed hard elimination + formula ranking`);
        console.error('═'.repeat(80));

        // Output result
        const result: IdeaSelectorResult = {
            success: true,
            selectedTopic,
            channelInsights,
            generatedIdeas: topIdeas, // Return only validated top 5
            trendingSignals,
        };

        // Write to stdout for consumption by other systems
        console.log(JSON.stringify(result, null, 2));

        return result;

    } catch (error: any) {
        console.error('\n❌ ERROR:', error.message);
        console.error(error.stack);

        const result: IdeaSelectorResult = {
            success: false,
            error: error.message,
        };

        console.log(JSON.stringify(result, null, 2));
        return result;
    }
}

// Run if executed directly
if (require.main === module) {
    runIdeaSelector()
        .then(() => {
            console.error('\n✅ Idea Selector Worker completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Idea Selector Worker failed:', error);
            process.exit(1);
        });
}

export { runIdeaSelector, IdeaSelectorResult, TopicIdea };
