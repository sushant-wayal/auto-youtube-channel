import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

const VOICEOVER_PROVIDER_KEY = 'settings:voiceover_provider';
const SCENE_RENDER_METHOD_KEY = 'settings:scene_render_method';
const THUMBNAIL_PRIMARY_ARCHETYPE_KEY = 'settings:thumbnail_primary_archetype';
const THUMBNAIL_VARIATIONS_ENABLED_KEY = 'settings:thumbnail_variations_enabled';
const THUMBNAIL_ACTIVE_ARCHETYPES_KEY = 'settings:thumbnail_active_archetypes';
const THUMBNAIL_CUSTOM_ARCHETYPES_KEY = 'settings:thumbnail_custom_archetypes';

const DEFAULT_VOICEOVER_PROVIDER = 'f5';
const DEFAULT_SCENE_RENDER_METHOD = 'code';
const DEFAULT_PRIMARY_ARCHETYPE = 'code_terminal_bug';
const DEFAULT_VARIATIONS_ENABLED = true;
const DEFAULT_ACTIVE_ARCHETYPES = ['code_terminal_bug', 'split_comparison', 'metric_showdown', 'cinematic_focal_hero'];

/**
 * GET /api/settings
 * Fetches current dynamic settings from Redis
 */
export async function GET() {
    try {
        let [
            voiceoverProvider,
            sceneRenderMethod,
            thumbnailPrimaryArchetype,
            thumbnailVariationsEnabledRaw,
            thumbnailActiveArchetypesRaw,
            thumbnailCustomArchetypesRaw,
        ] = await Promise.all([
            redis.get(VOICEOVER_PROVIDER_KEY),
            redis.get(SCENE_RENDER_METHOD_KEY),
            redis.get(THUMBNAIL_PRIMARY_ARCHETYPE_KEY),
            redis.get(THUMBNAIL_VARIATIONS_ENABLED_KEY),
            redis.get(THUMBNAIL_ACTIVE_ARCHETYPES_KEY),
            redis.get(THUMBNAIL_CUSTOM_ARCHETYPES_KEY),
        ]);

        if (!voiceoverProvider) {
            voiceoverProvider = DEFAULT_VOICEOVER_PROVIDER;
            await redis.set(VOICEOVER_PROVIDER_KEY, DEFAULT_VOICEOVER_PROVIDER);
        }

        if (!sceneRenderMethod) {
            sceneRenderMethod = DEFAULT_SCENE_RENDER_METHOD;
            await redis.set(SCENE_RENDER_METHOD_KEY, DEFAULT_SCENE_RENDER_METHOD);
        }

        if (!thumbnailPrimaryArchetype) {
            thumbnailPrimaryArchetype = DEFAULT_PRIMARY_ARCHETYPE;
            await redis.set(THUMBNAIL_PRIMARY_ARCHETYPE_KEY, DEFAULT_PRIMARY_ARCHETYPE);
        }

        const thumbnailVariationsEnabled = thumbnailVariationsEnabledRaw !== null
            ? thumbnailVariationsEnabledRaw === 'true'
            : DEFAULT_VARIATIONS_ENABLED;

        let thumbnailActiveArchetypes = DEFAULT_ACTIVE_ARCHETYPES;
        if (thumbnailActiveArchetypesRaw) {
            try {
                const parsed = JSON.parse(thumbnailActiveArchetypesRaw);
                if (Array.isArray(parsed)) {
                    thumbnailActiveArchetypes = parsed.slice(0, 4);
                }
            } catch (e) {
                // Ignore parse error
            }
        }

        let thumbnailCustomArchetypes: any[] = [];
        if (thumbnailCustomArchetypesRaw) {
            try {
                const parsed = JSON.parse(thumbnailCustomArchetypesRaw);
                if (Array.isArray(parsed)) {
                    thumbnailCustomArchetypes = parsed;
                }
            } catch (e) {
                // Ignore parse error
            }
        }

        return NextResponse.json({
            ok: true,
            voiceoverProvider,
            sceneRenderMethod,
            thumbnailPrimaryArchetype,
            thumbnailVariationsEnabled,
            thumbnailActiveArchetypes,
            thumbnailCustomArchetypes,
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
 * Updates configuration in Redis
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            voiceoverProvider,
            sceneRenderMethod,
            thumbnailPrimaryArchetype,
            thumbnailVariationsEnabled,
            thumbnailActiveArchetypes,
            thumbnailCustomArchetypes,
        } = body;

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

        if (thumbnailPrimaryArchetype !== undefined && typeof thumbnailPrimaryArchetype === 'string') {
            await redis.set(THUMBNAIL_PRIMARY_ARCHETYPE_KEY, thumbnailPrimaryArchetype.trim());
        }

        if (thumbnailVariationsEnabled !== undefined) {
            await redis.set(THUMBNAIL_VARIATIONS_ENABLED_KEY, thumbnailVariationsEnabled ? 'true' : 'false');
        }

        if (thumbnailActiveArchetypes !== undefined && Array.isArray(thumbnailActiveArchetypes)) {
            // Constraint: max 4 active archetypes
            const sanitized = thumbnailActiveArchetypes.slice(0, 4);
            await redis.set(THUMBNAIL_ACTIVE_ARCHETYPES_KEY, JSON.stringify(sanitized));
        }

        if (thumbnailCustomArchetypes !== undefined && Array.isArray(thumbnailCustomArchetypes)) {
            await redis.set(THUMBNAIL_CUSTOM_ARCHETYPES_KEY, JSON.stringify(thumbnailCustomArchetypes));
        }

        const [
            updatedVoiceoverProvider,
            updatedSceneRenderMethod,
            updatedPrimaryArchetype,
            updatedVariationsRaw,
            updatedActiveRaw,
            updatedCustomRaw,
        ] = await Promise.all([
            redis.get(VOICEOVER_PROVIDER_KEY),
            redis.get(SCENE_RENDER_METHOD_KEY),
            redis.get(THUMBNAIL_PRIMARY_ARCHETYPE_KEY),
            redis.get(THUMBNAIL_VARIATIONS_ENABLED_KEY),
            redis.get(THUMBNAIL_ACTIVE_ARCHETYPES_KEY),
            redis.get(THUMBNAIL_CUSTOM_ARCHETYPES_KEY),
        ]);

        return NextResponse.json({
            ok: true,
            voiceoverProvider: updatedVoiceoverProvider || DEFAULT_VOICEOVER_PROVIDER,
            sceneRenderMethod: updatedSceneRenderMethod || DEFAULT_SCENE_RENDER_METHOD,
            thumbnailPrimaryArchetype: updatedPrimaryArchetype || DEFAULT_PRIMARY_ARCHETYPE,
            thumbnailVariationsEnabled: updatedVariationsRaw === 'true',
            thumbnailActiveArchetypes: updatedActiveRaw ? JSON.parse(updatedActiveRaw) : DEFAULT_ACTIVE_ARCHETYPES,
            thumbnailCustomArchetypes: updatedCustomRaw ? JSON.parse(updatedCustomRaw) : [],
        });
    } catch (error: any) {
        return NextResponse.json({
            ok: false,
            error: error.message,
        }, { status: 500 });
    }
}
