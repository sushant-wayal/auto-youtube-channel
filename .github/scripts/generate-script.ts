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
        scenes: Array<{
            id: string;
            narration: string;
            baseDuration: number;
            holdDuration: number;
            actions: any[];
        }>;
    }>;
}

async function generateScript(customIdea?: string): Promise<{ videoId: string; script: VideoScript }> {
    validateConfig(['website']);

    let videoIdea: string;

    if (customIdea) {
        // Use custom idea from workflow input
        videoIdea = customIdea;
        console.error(`💡 Using custom video idea: "${videoIdea}"`);
    } else {
        // Try to get idea from Redis queue (simple LPOP from existing queue)
        try {
            const redis = new Redis(process.env.REDIS_URL!);
            
            // Initialize Gemini rate limit queue keys if they don't exist
            await redis.setnx('html_queue:turn', '1');
            await redis.setnx('html_queue:last_enquiry', '0');

            const queueKey = 'video:ideas'; // TEST queue - separate from production

            const idea = await redis.lpop(queueKey);
            await redis.quit();

            if (idea) {
                videoIdea = idea;
                console.error(`📥 Video idea from Redis queue: "${videoIdea}"`);
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

    const websiteDomain = process.env.WEBSITE_DOMAIN || 'http://localhost:3000';

    // Call the script generation API
    const response = await fetch(`${websiteDomain}/api/generate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoIdea }),
    });

    if (!response.ok) {
        throw new Error(`Script generation failed: ${response.statusText}`);
    }

    const data = await response.json() as { script?: VideoScript; error?: string };

    if (!data.script) {
        throw new Error(data.error || 'Failed to generate script');
    }

    const videoId = `video-${Date.now()}`;
    console.error(`✅ Generated script: "${data.script.title}"`);

    return { videoId, script: data.script };
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
