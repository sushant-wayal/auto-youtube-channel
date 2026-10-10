import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

// Never cache this route — mobile app needs fresh data on every poll
export const dynamic = 'force-dynamic';

const PIPELINE_STATUS_KEY = 'pipeline:latest-status';
const PUSH_TOKEN_KEY = 'push:token';
const LONG_FORM_TIME_KEY = 'longform:publish-time';
const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

// The secret token GitHub Actions must pass in the Authorization header
// Set PIPELINE_WEBHOOK_SECRET in Vercel env vars
const WEBHOOK_SECRET = process.env.PIPELINE_WEBHOOK_SECRET;

function getRedisClient() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error('REDIS_URL not configured');
    return new Redis(redisUrl);
}

async function sendPushNotification(
    pushToken: string,
    overallStatus: 'success' | 'failure',
    videoId: string,
    videoTitle: string,
    scheduledTime: string | null,
    youtubeId?: string,
    errorSummary?: string | null
) {
    const isSuccess = overallStatus === 'success';
    const title = isSuccess
        ? '✦ Serenity Studio • Video Scheduled'
        : '▲ Serenity Studio • Pipeline Alert';

    let body: string;
    if (!isSuccess) {
        body = errorSummary
            ? `"${videoTitle}" halted: ${errorSummary}. Tap to inspect telemetry.`
            : `"${videoTitle}" halted during generation. Tap to inspect telemetry.`;
    } else if (scheduledTime) {
        body = `"${videoTitle}" is queued for broadcast • Goes live at ${scheduledTime} IST`;
    } else {
        body = `"${videoTitle}" is rendered & scheduled for YouTube premiere`;
    }

    const message = {
        to: pushToken,
        sound: 'default',
        title,
        body,
        subtitle: 'Studio Automation Telemetry',
        data: {
            screen: 'Pipeline',
            targetScreen: 'Pipeline',
            videoId,
            youtubeId: youtubeId ?? null,
            status: overallStatus,
            videoTitle,
        },
        channelId: 'pipeline',
        priority: 'high',
    };

    const resp = await fetch(EXPO_PUSH_API, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Expo push API returned ${resp.status}: ${text}`);
    }

    const result = await resp.json();
    console.log('[pipeline-status] Push notification result:', JSON.stringify(result));
    return result;
}

// POST /api/pipeline-status  — called by GitHub Actions pipeline-summary job
export async function POST(req: NextRequest) {
    // Authenticate with shared secret
    const authHeader = req.headers.get('authorization');
    if (!WEBHOOK_SECRET || authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    let redis: Redis | null = null;
    try {
        const body = await req.json();
        const {
            overallStatus,
            videoId,
            videoTitle,
            youtubeId,
            videoUrl,
            thumbnailUrl,
            description,
            scriptData,
            runId,
            jobs,
        }: {
            overallStatus: 'success' | 'failure';
            videoId: string;
            videoTitle?: string;
            youtubeId?: string;
            videoUrl?: string;
            thumbnailUrl?: string;
            description?: string;
            scriptData?: any;
            runId?: string | number;
            jobs?: Record<string, string>;
        } = body;

        if (!overallStatus) {
            return NextResponse.json({ ok: false, error: 'Missing required overallStatus' }, { status: 400 });
        }

        redis = getRedisClient();

        // Determine effective videoId and title, falling back gracefully if script generation failed
        let effectiveVideoId = (videoId && videoId.trim()) || '';
        if (!effectiveVideoId) {
            const savedVideoId = await redis.hget('pipeline:status:metadata', 'videoId');
            if (savedVideoId && savedVideoId !== 'generating...') {
                effectiveVideoId = savedVideoId;
            } else if (runId) {
                effectiveVideoId = `run-${runId}`;
            } else {
                effectiveVideoId = `run-${Date.now()}`;
            }
        }

        let effectiveVideoTitle = (videoTitle && videoTitle.trim()) || '';
        if (!effectiveVideoTitle) {
            const savedTitle = await redis.hget('pipeline:status:metadata', 'videoTitle');
            if (savedTitle && savedTitle !== 'Daily Video Pipeline') {
                effectiveVideoTitle = savedTitle;
            } else if (runId) {
                effectiveVideoTitle = `Pipeline Run #${runId}`;
            } else {
                effectiveVideoTitle = effectiveVideoId;
            }
        }

        // Infer error summary if pipeline failed and errorSummary wasn't explicitly provided
        let resolvedErrorSummary = body.errorSummary || null;
        if (!resolvedErrorSummary && overallStatus === 'failure' && jobs) {
            const failedJob = Object.entries(jobs).find(([_, st]) => st === 'failure');
            if (failedJob) {
                const jobLabels: Record<string, string> = {
                    populateIdeas: 'Populate Ideas',
                    generateScript: 'Script Generation',
                    renderScenes: 'Scene Rendering',
                    generateVoiceover: 'Voiceover Synthesis',
                    assembleLongForm: 'Video Assembly',
                    generateThumbnail: 'Thumbnail Generation',
                    uploadYoutube: 'YouTube Upload',
                    shortsProcessing: 'Shorts Processing',
                    linkShorts: 'Link Shorts',
                };
                resolvedErrorSummary = `${jobLabels[failedJob[0]] || failedJob[0]} failed`;
            }
        }

        // Persist final overall status (handled by Redis status tracking)
        await redis.set('pipeline:status:overall', overallStatus, 'EX', 60 * 60 * 24 * 7);

        // Persist metadata including runId
        const metaFields: Record<string, string> = {
            videoId: effectiveVideoId,
            videoTitle: effectiveVideoTitle,
            ranAt: new Date().toISOString(),
        };
        if (youtubeId) metaFields.youtubeId = youtubeId;
        if (videoUrl) metaFields.videoUrl = videoUrl;
        if (thumbnailUrl) metaFields.thumbnailUrl = thumbnailUrl;
        if (description) metaFields.description = description;
        if (runId) metaFields.runId = String(runId);
        if (scriptData) metaFields.scriptData = typeof scriptData === 'string' ? scriptData : JSON.stringify(scriptData);
        if (resolvedErrorSummary) metaFields.errorSummary = resolvedErrorSummary;

        for (const [k, v] of Object.entries(metaFields)) {
            await redis.hset('pipeline:status:metadata', k, v);
        }
        await redis.expire('pipeline:status:metadata', 60 * 60 * 24 * 7);

        // Persist final job statuses from the pipeline summary
        if (jobs) {
            for (const [jobName, jobStatus] of Object.entries(jobs)) {
                if (jobStatus) {
                    await redis.hset('pipeline:status:jobs', jobName, jobStatus);
                }
            }
            await redis.expire('pipeline:status:jobs', 60 * 60 * 24 * 7);
        }

        // Archive to historical runs list for Jarvis and analytics (keep latest 50 runs)
        try {
            const historyEntry = {
                videoId: effectiveVideoId,
                videoTitle: effectiveVideoTitle,
                overallStatus,
                youtubeId: youtubeId || null,
                videoUrl: videoUrl || null,
                thumbnailUrl: thumbnailUrl || null,
                ranAt: metaFields.ranAt,
                runId: runId ? String(runId) : null,
                jobs: jobs || {},
                errorSummary: resolvedErrorSummary,
            };
            await redis.lpush('pipeline:history', JSON.stringify(historyEntry));
            await redis.ltrim('pipeline:history', 0, 49);
        } catch (histErr: any) {
            console.error('[pipeline-status] Failed to archive run to history:', histErr.message);
        }

        // Send push notification if a mobile token is registered
        const pushToken = await redis.get(PUSH_TOKEN_KEY);
        if (pushToken) {
            try {
                const scheduledTime = await redis.get(LONG_FORM_TIME_KEY); // e.g. "20:00"
                await sendPushNotification(pushToken, overallStatus, effectiveVideoId, effectiveVideoTitle, scheduledTime, youtubeId, resolvedErrorSummary);
            } catch (pushErr: any) {
                console.error('[pipeline-status] Push notification error:', pushErr.message);
            }
        } else {
            console.log('[pipeline-status] No push token registered, skipping notification');
        }

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error('[pipeline-status] Error:', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    } finally {
        await redis?.quit();
    }
}

// GET /api/pipeline-status  — polled by the mobile app
export async function GET() {
    let redis: Redis | null = null;
    try {
        redis = getRedisClient();
        
        const overall = await redis.get('pipeline:status:overall');
        
        // If the new keys don't exist, check fallback for older runs
        if (!overall) {
            const raw = await redis.get(PIPELINE_STATUS_KEY);
            if (!raw) {
                return NextResponse.json({ ok: true, status: null });
            }
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.shorts) && Array.isArray(parsed.shortCaptions)) {
                parsed.shorts = parsed.shorts.map((s: any, idx: number) => ({
                    ...s,
                    caption: s.caption || parsed.shortCaptions[s.shortIndex ?? idx] || '',
                }));
            }
            return NextResponse.json({ ok: true, status: parsed });
        }

        const metadata = await redis.hgetall('pipeline:status:metadata');
        const jobs = await redis.hgetall('pipeline:status:jobs');
        const rawSceneUrls = await redis.lrange('pipeline:status:sceneUrls', 0, -1);
        const rawVoiceoverUrls = await redis.lrange('pipeline:status:voiceoverUrls', 0, -1);

        // Filter out stale media URLs from previous pipeline runs
        let sceneUrls = rawSceneUrls || [];
        if (metadata.videoId && sceneUrls.length > 0) {
            const matchingScenes = sceneUrls.filter(u => u.includes(metadata.videoId));
            if (matchingScenes.length > 0) {
                sceneUrls = matchingScenes;
            } else if (jobs.renderScenes === 'running' || jobs.renderScenes === 'pending') {
                sceneUrls = [];
                redis.del('pipeline:status:sceneUrls').catch(() => {});
            }
        }

        let voiceoverUrls = rawVoiceoverUrls || [];
        if (metadata.videoId && voiceoverUrls.length > 0) {
            const matchingVo = voiceoverUrls.filter(u => u.includes(metadata.videoId));
            if (matchingVo.length > 0) {
                voiceoverUrls = matchingVo;
            } else if (jobs.generateVoiceover === 'running' || jobs.generateVoiceover === 'pending') {
                voiceoverUrls = [];
                redis.del('pipeline:status:voiceoverUrls').catch(() => {});
            }
        }
        const ideasAdded = await redis.lrange('pipeline:status:ideasAdded', 0, -1);
        const queuedIdeasRaw = await redis.lrange('video:ideas', 0, -1);
        const queuedIdeas = queuedIdeasRaw.map(raw => {
            try {
                const parsed = JSON.parse(raw);
                return {
                    topic: parsed.topic || parsed.idea || raw,
                    isSeries: !!(parsed.isSeries || parsed.seriesContext),
                    seriesTitle: parsed.seriesContext?.seriesTitle || null,
                    learningObjective: parsed.seriesContext?.learningObjective || null,
                };
            } catch {
                return {
                    topic: raw,
                    isSeries: false,
                    seriesTitle: null,
                    learningObjective: null,
                };
            }
        });
        
        const shortsRaw = await redis.lrange(`pipeline:shorts:${metadata.videoId}`, 0, -1);
        const shorts = shortsRaw.map(s => {
            try { return JSON.parse(s); } catch { return null; }
        }).filter(Boolean).sort((a: any, b: any) => (a.shortIndex ?? 0) - (b.shortIndex ?? 0));

        let parsedScriptData = null;
        let sceneNarrations: string[] = [];
        let shortHooks: string[] = [];
        let shortCaptions: string[] = [];

        if (metadata.scriptData) {
            try {
                parsedScriptData = typeof metadata.scriptData === 'string'
                    ? JSON.parse(metadata.scriptData)
                    : metadata.scriptData;
                const scenesArr = parsedScriptData?.script?.scenes || parsedScriptData?.scenes;
                const shortsArr = parsedScriptData?.script?.shorts || parsedScriptData?.shorts;
                if (scenesArr) {
                    sceneNarrations = scenesArr.map((s: any) => s.narration || '');
                }
                if (shortsArr) {
                    shortHooks = shortsArr.map((s: any) => s.hook || '');
                    shortCaptions = shortsArr.map((s: any) => s.instagramCaption || s.caption || '');
                }
            } catch (e) {
                console.error('[pipeline-status] Error parsing scriptData:', e);
            }
        }

        const enhancedShorts = shorts.map((s: any, idx: number) => {
            const shortIdx = s.shortIndex ?? idx;
            const caption = s.caption || shortCaptions[shortIdx] || parsedScriptData?.shorts?.[shortIdx]?.instagramCaption || parsedScriptData?.script?.shorts?.[shortIdx]?.instagramCaption || '';
            return {
                ...s,
                caption,
            };
        });

        const isAnyJobRunning = Object.values(jobs).some(j => j === 'running');
        let computedOverall = overall;
        if (isAnyJobRunning) {
            computedOverall = 'running';
        }

        const [thumbnailVariationsRaw, abTestRaw] = await Promise.all([
            redis.get('pipeline:status:thumbnail_variations'),
            redis.get('pipeline:thumbnail:ab_test'),
        ]);

        let thumbnailVariations: string[] = [];
        if (thumbnailVariationsRaw) {
            try {
                const parsed = JSON.parse(thumbnailVariationsRaw);
                if (Array.isArray(parsed)) thumbnailVariations = parsed;
            } catch {}
        }
        if (thumbnailVariations.length === 0 && metadata.thumbnailVariations) {
            try {
                const parsed = JSON.parse(metadata.thumbnailVariations);
                if (Array.isArray(parsed)) thumbnailVariations = parsed;
            } catch {}
        }
        if (thumbnailVariations.length === 0 && metadata.thumbnailUrl) {
            thumbnailVariations = [metadata.thumbnailUrl];
        }

        let abTesting: any = null;
        if (abTestRaw) {
            try { abTesting = JSON.parse(abTestRaw); } catch {}
        }

        const activeThumb = metadata.selectedThumbnailUrl || metadata.thumbnailUrl || null;

        const status = {
            overallStatus: computedOverall,
            ranAt: metadata.ranAt || new Date().toISOString(),
            runId: metadata.runId || null,
            videoId: metadata.videoId,
            videoTitle: metadata.videoTitle || metadata.videoId,
            youtubeId: metadata.youtubeId || null,
            videoUrl: metadata.videoUrl || null,
            thumbnailUrl: activeThumb,
            selectedThumbnailUrl: activeThumb,
            thumbnailVariations,
            abTesting,
            description: metadata.description || null,
            sceneUrls: sceneUrls || [],
            voiceoverUrls: voiceoverUrls || [],
            sceneNarrations,
            shortHooks,
            shortCaptions,
            ideasAdded: ideasAdded || [],
            queuedIdeas: queuedIdeas || [],
            scriptData: parsedScriptData,
            shorts: enhancedShorts,
            errorSummary: metadata.errorSummary || null,
            jobs: {
                populateIdeas: jobs.populateIdeas ?? null,
                generateScript: jobs.generateScript ?? null,
                renderScenes: jobs.renderScenes ?? null,
                generateVoiceover: jobs.generateVoiceover ?? null,
                assembleLongForm: jobs.assembleLongForm ?? null,
                generateThumbnail: jobs.generateThumbnail ?? null,
                uploadYoutube: jobs.uploadYoutube ?? null,
                shortsProcessing: jobs.shortsProcessing ?? null,
            },
        };

        return NextResponse.json({ ok: true, status });
    } catch (err: any) {
        console.error('[pipeline-status] Error:', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    } finally {
        await redis?.quit();
    }
}
