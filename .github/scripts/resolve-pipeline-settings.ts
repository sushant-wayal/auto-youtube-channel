import Redis from 'ioredis';
import { initPipeline } from './utils/status-updater';

const VOICEOVER_PROVIDER_KEY = 'settings:voiceover_provider';
const SCENE_RENDER_METHOD_KEY = 'settings:scene_render_method';

const validVoiceoverProviders = new Set(['gemini', 'f5']);
const validSceneRenderMethods = new Set(['code', 'ai']);

function normalize(
    value: string | null | undefined,
    validValues: Set<string>,
): string | null {
    const normalized = value?.trim().toLowerCase();
    return normalized && validValues.has(normalized) ? normalized : null;
}

function writeOutput(name: string, value: string): void {
    process.stdout.write(`${name}=${value}\n`);
}

async function main(): Promise<void> {
    const fallbackVoiceover =
        normalize(process.env.VOICEOVER_PROVIDER, validVoiceoverProviders) || 'gemini';
    const fallbackRenderMethod =
        normalize(process.env.SCENE_RENDER_METHOD, validSceneRenderMethods) || 'code';

    let voiceoverProvider = fallbackVoiceover;
    let sceneRenderMethod = fallbackRenderMethod;
    let source = 'environment fallback';
    let redis: Redis | undefined;

    try {
        if (!process.env.REDIS_URL) {
            throw new Error('REDIS_URL is not configured');
        }

        // Initialize pipeline status to 'running' right at workflow startup
        try {
            await initPipeline('generating...', 'Daily Video Pipeline', process.env.GITHUB_RUN_ID);
        } catch (initErr) {
            console.error('[resolve-pipeline-settings] Non-fatal initPipeline error:', initErr);
        }

        redis = new Redis(process.env.REDIS_URL, {
            connectTimeout: 10_000,
            maxRetriesPerRequest: 1,
            retryStrategy: () => null,
        });

        const [redisVoiceover, redisRenderMethod] = await redis.mget(
            VOICEOVER_PROVIDER_KEY,
            SCENE_RENDER_METHOD_KEY,
        );

        const validRedisVoiceover = normalize(redisVoiceover, validVoiceoverProviders);
        const validRedisRenderMethod = normalize(redisRenderMethod, validSceneRenderMethods);

        if (validRedisVoiceover) {
            voiceoverProvider = validRedisVoiceover;
        } else {
            console.error(
                `Redis did not contain a valid ${VOICEOVER_PROVIDER_KEY}; using environment fallback.`,
            );
        }

        if (validRedisRenderMethod) {
            sceneRenderMethod = validRedisRenderMethod;
        } else {
            console.error(
                `Redis did not contain a valid ${SCENE_RENDER_METHOD_KEY}; using environment fallback.`,
            );
        }

        source =
            validRedisVoiceover && validRedisRenderMethod
                ? 'redis'
                : 'redis with environment fallback';
    } catch (error) {
        console.error('Could not resolve pipeline settings from Redis; using environment fallback.', error);
    } finally {
        redis?.disconnect();
    }

    console.error(
        `Resolved pipeline settings from ${source}: voiceover=${voiceoverProvider}, render=${sceneRenderMethod}`,
    );
    writeOutput('voiceover_provider', voiceoverProvider);
    writeOutput('scene_render_method', sceneRenderMethod);
    writeOutput('settings_source', source);
}

main().catch((error) => {
    console.error('Failed to resolve pipeline settings:', error);
    process.exit(1);
});
