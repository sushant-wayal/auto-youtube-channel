/**
 * GitHub Actions Script: Generate Video Script
 * Called by: generate-script job
 */

import { validateConfig } from '../../shared/config';
import Redis from 'ioredis';

// Fallback video ideas pool (used if Redis queue is empty)
const VIDEO_IDEAS = [
    "The Science Behind Dreams",
    "How Quantum Computing Works",
    "The Future of Artificial Intelligence",
    "Understanding Black Holes",
    "The History of the Internet",
    "Climate Change Solutions",
    "The Human Brain Explained",
    "Space Exploration Milestones",
    "Ancient Civilizations Mystery",
    "The Evolution of Technology",
];

interface VideoScript {
    title: string;
    description: string;
    tags: string[];
    narration: string;
    scenes: Array<{
        id: string;
        narration: string;
        baseDuration: number;
        holdDuration: number;
        actions: any[];
    }>;
    shorts: Array<{
        id: string;
        hook: string;
        instagramCaption: string;
        scenes: Array<{
            id: string;
            narration: string;
            baseDuration: number;
            holdDuration: number;
            actions: any[];
        }>;
    }>;
}

async function generateScript(customIdea?: string): Promise<{ videoId: string; script: VideoScript; seriesContext?: any }> {
    validateConfig(['website']);
    const sceneRenderMethod =
        process.env.SCENE_RENDER_METHOD?.toLowerCase() === 'ai' ? 'ai' : 'code';

    let videoIdea: string;
    let seriesContext: any = undefined;
    let poppedIdeaRaw: string | undefined = undefined;

    if (customIdea) {
        // Use custom idea from workflow input
        videoIdea = customIdea;
        console.error(`💡 Using custom video idea: "${videoIdea}"`);
    } else {
        // Try to get idea from Redis queue (simple LPOP from existing queue)
        try {
            const redis = new Redis(process.env.REDIS_URL!);
            
            // Initialize Gemini rate limit queue keys
            await redis.set('html_queue:turn', '1');
            await redis.set('html_queue:last_enquiry', '0');

            const queueKey = 'video:ideas'; // TEST queue - separate from production

            const ideaRaw = await redis.lpop(queueKey);
            poppedIdeaRaw = ideaRaw || undefined;
            await redis.quit();

            if (ideaRaw) {
                try {
                    const parsedIdea = JSON.parse(ideaRaw);
                    if (parsedIdea && typeof parsedIdea === 'object' && parsedIdea.topic) {
                        // It's a semantic learning queue item from series-manager
                        videoIdea = parsedIdea.topic;
                        
                        if (parsedIdea.seriesContext) {
                            seriesContext = parsedIdea.seriesContext;
                            console.error(`📥 Series episode from Redis queue: "${videoIdea}" (Series: ${seriesContext.seriesTitle})`);
                        } else {
                            console.error(`📥 Structured video idea from Redis queue: "${videoIdea}"`);
                        }
                    } else if (parsedIdea && typeof parsedIdea === 'object' && parsedIdea.idea) {
                        // Support legacy structured format
                        videoIdea = parsedIdea.idea;
                        seriesContext = parsedIdea.seriesContext;
                        console.error(`📥 Structured video idea from Redis queue: "${videoIdea}"`);
                    } else {
                        // It's a JSON string but not our format, just use as string
                        videoIdea = ideaRaw;
                        console.error(`📥 Video idea from Redis queue: "${videoIdea}"`);
                    }
                } catch (e) {
                    // Not JSON, use raw string
                    videoIdea = ideaRaw;
                    console.error(`📥 Plain video idea from Redis queue: "${videoIdea}"`);
                }
            } else {
                // Fallback to random idea from pool
                videoIdea = VIDEO_IDEAS[Math.floor(Math.random() * VIDEO_IDEAS.length)];
                console.error(`🎲 Random video idea (queue empty): "${videoIdea}"`);
            }
        } catch (error) {
            console.warn('⚠️ Redis not available, using random idea:', error);
            videoIdea = VIDEO_IDEAS[Math.floor(Math.random() * VIDEO_IDEAS.length)];
            console.error(`💡 Video idea: "${videoIdea}"`);
        }
    }

    try {
        const websiteDomain = process.env.WEBSITE_DOMAIN || 'http://localhost:3000';

        // Call the script generation API
        const response = await fetch(`${websiteDomain}/api/generate-script`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Carry the Redis-resolved setting into the separately deployed website API.
            body: JSON.stringify({ videoIdea, sceneRenderMethod, seriesContext }),
        });

        if (!response.ok) {
            throw new Error(`Script generation failed: ${response.statusText}`);
        }

        const data = await response.json() as { script?: VideoScript; error?: string };

        if (!data.script) {
            throw new Error(data.error || 'Failed to generate script');
        }

        const videoId = `video-${Date.now()}`;
        console.error(`✅ Generated ${sceneRenderMethod}-render script: "${data.script.title}"`);

        return { videoId, script: data.script, seriesContext };
    } catch (error) {
        if (poppedIdeaRaw && !customIdea) {
            console.error(`🔄 Script generation failed. Rolling back idea to Redis queue...`);
            try {
                const redis = new Redis(process.env.REDIS_URL!);
                await redis.lpush('video:ideas', poppedIdeaRaw);
                await redis.quit();
                console.error(`✅ Rollback successful.`);
            } catch (rbError) {
                console.error(`❌ Rollback failed:`, rbError);
            }
        }
        throw error;
    }
}

// Main execution
(async () => {
    try {
        const customIdea = process.argv[2]; // Optional custom idea from workflow input
        const result = await generateScript(customIdea);

        // Output as JSON string for GitHub Actions
        console.log(JSON.stringify(result));
        process.exit(0);
    } catch (error) {
        console.error('❌ Script generation failed:', error);
        process.exit(1);
    }
})();
