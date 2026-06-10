import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

const VOICEOVER_PROVIDER_KEY = 'settings:voiceover_provider';
const SCENE_RENDER_METHOD_KEY = 'settings:scene_render_method';

const DEFAULT_VOICEOVER_PROVIDER = 'f5';
const DEFAULT_SCENE_RENDER_METHOD = 'code';

/**
 * GET /api/settings
 * Fetches current dynamic settings from Redis
 */
export async function GET() {
    try {
        let voiceoverProvider = await redis.get(VOICEOVER_PROVIDER_KEY);
        let sceneRenderMethod = await redis.get(SCENE_RENDER_METHOD_KEY);

        if (!voiceoverProvider) {
            voiceoverProvider = DEFAULT_VOICEOVER_PROVIDER;
            await redis.set(VOICEOVER_PROVIDER_KEY, DEFAULT_VOICEOVER_PROVIDER);
        }

        if (!sceneRenderMethod) {
            sceneRenderMethod = DEFAULT_SCENE_RENDER_METHOD;
            await redis.set(SCENE_RENDER_METHOD_KEY, DEFAULT_SCENE_RENDER_METHOD);
        }

        return NextResponse.json({
            ok: true,
            voiceoverProvider,
            sceneRenderMethod,
        });
    } catch (error: any) {
        return NextResponse.json({
            ok: false,
            error: error.message,
        }, { status: 500 });
    }
}

/**
 * POST /api/settings
 * Updates voiceover provider and scene rendering method in Redis
 * Body: { voiceoverProvider?: 'gemini' | 'f5', sceneRenderMethod?: 'code' | 'ai' }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { voiceoverProvider, sceneRenderMethod } = body;

        if (voiceoverProvider) {
            const provider = voiceoverProvider.toLowerCase();
            if (provider !== 'gemini' && provider !== 'f5') {
                return NextResponse.json({
                    ok: false,
                    error: 'voiceoverProvider must be either "gemini" or "f5"',
                }, { status: 400 });
            }
            await redis.set(VOICEOVER_PROVIDER_KEY, provider);
        }

        if (sceneRenderMethod) {
            const method = sceneRenderMethod.toLowerCase();
            if (method !== 'code' && method !== 'ai') {
                return NextResponse.json({
                    ok: false,
                    error: 'sceneRenderMethod must be either "code" or "ai"',
                }, { status: 400 });
            }
            await redis.set(SCENE_RENDER_METHOD_KEY, method);
        }

        const updatedVoiceoverProvider = await redis.get(VOICEOVER_PROVIDER_KEY);
        const updatedSceneRenderMethod = await redis.get(SCENE_RENDER_METHOD_KEY);

        return NextResponse.json({
            ok: true,
            voiceoverProvider: updatedVoiceoverProvider || DEFAULT_VOICEOVER_PROVIDER,
            sceneRenderMethod: updatedSceneRenderMethod || DEFAULT_SCENE_RENDER_METHOD,
        });
    } catch (error: any) {
        return NextResponse.json({
            ok: false,
            error: error.message,
        }, { status: 500 });
    }
}
