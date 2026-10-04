/**
 * YouTube Studio "Ask Studio" Autonomous Thumbnail Composer
 * 
 * Analyzes:
 * 1. Channel Past Videos & High-CTR styles via YouTube Data API
 * 2. Video Audio/Visual Content (script narration, hooks, visual scene directives)
 * 3. Free Generative Visuals:
 *    - Pollinations.ai FLUX.1-schnell (100% free, no API keys, cinematic 3D renders)
 *    - Pexels royalty-free backdrops (API fallback)
 *    - Curated 4K Dark Tech Photography (local fallback)
 * 4. Multi-Archetype Studio Canvas Renderer via Puppeteer:
 *    - code_terminal_bug: VS Code / macOS dark terminal with syntax highlighting and bug pointer
 *    - split_comparison: Dual card showdown (X vs Y / Old vs New) with glowing VS medallion
 *    - metric_showdown: Horizontal performance benchmark comparison with speed multipliers
 *    - cinematic_focal_hero: 3D holographic architecture schematic with cyber grid
 * 
 * 100% Free - Zero paid image generation subscriptions required.
 */

import puppeteer from 'puppeteer';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import config from '../config';
import CloudinaryService from './cloudinary-service';
import { YouTubeDataService } from './youtube-data-service';
import Redis from 'ioredis';

export interface ThumbnailComposeOptions {
    videoId: string;
    title: string;
    description?: string;
    narration?: string;
    tags?: string[];
    scenes?: Array<{
        id?: string;
        narration?: string;
        actions?: any[];
    }>;
    generateVariations?: boolean;
}

export interface ThumbnailComposeResult {
    thumbnailUrl: string;
    localPath: string;
    hook: string;
    badge: string;
    archetype: 'code_terminal_bug' | 'split_comparison' | 'metric_showdown' | 'cinematic_focal_hero';
    themeColor: string;
    variations?: Array<{
        thumbnailUrl: string;
        localPath: string;
        hook: string;
        badge: string;
        archetype: string;
    }>;
}

interface CodeSnippet {
    filename: string;
    language: string;
    lines: Array<{
        num: number;
        text: string;
        isError?: boolean;
        errorTag?: string;
    }>;
    pointerBadge?: string;
}

interface ComparisonData {
    leftTitle: string;
    leftMetric: string;
    leftBadge: string;
    leftNote: string;
    rightTitle: string;
    rightMetric: string;
    rightBadge: string;
    rightNote: string;
    vsText: string;
}

interface MetricBenchmarkData {
    metricTitle: string;
    oldLabel: string;
    oldValue: string;
    oldBarPercent: number;
    newLabel: string;
    newValue: string;
    newBarPercent: number;
    multiplierBadge: string;
}

interface DesignMetadata {
    archetype: 'code_terminal_bug' | 'split_comparison' | 'metric_showdown' | 'cinematic_focal_hero';
    hook: string;
    badge: string;
    accentText: string;
    highlightText: string;
    themeColor: string;
    fluxPrompt: string;
    pexelsQuery: string;
    codeSnippet?: CodeSnippet;
    comparison?: ComparisonData;
    benchmark?: MetricBenchmarkData;
}

const FALLBACK_BACKGROUNDS = [
    'https://images.pexels.com/photos/37730212/pexels-photo-37730212.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=720&w=1280',
    'https://images.pexels.com/photos/1181244/pexels-photo-1181244.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=720&w=1280',
    'https://images.pexels.com/photos/2582937/pexels-photo-2582937.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=720&w=1280',
    'https://images.pexels.com/photos/2881229/pexels-photo-2881229.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=720&w=1280'
];

export class ThumbnailComposer {
    private static instance: ThumbnailComposer;

    public static getInstance(): ThumbnailComposer {
        if (!ThumbnailComposer.instance) {
            ThumbnailComposer.instance = new ThumbnailComposer();
        }
        return ThumbnailComposer.instance;
    }

    /**
     * Generate a studio-grade YouTube thumbnail and publish to Cloudinary
     */
    async compose(options: ThumbnailComposeOptions): Promise<ThumbnailComposeResult> {
        const { videoId, title, description, narration, tags, scenes, generateVariations } = options;
        console.error(`\n🎨 === YOUTUBE STUDIO "ASK STUDIO" THUMBNAIL COMPOSER ===`);
        console.error(`📹 Video ID: ${videoId}`);
        console.error(`📝 Title: ${title}`);

        // 1. Gather Channel Intelligence (past videos & style patterns)
        const channelContext = await this.getChannelIntelligence();
        if (channelContext.length > 0) {
            console.error(`📺 Grounded with ${channelContext.length} past channel video patterns`);
        }

        // 2. Synthesize Studio Design Metadata with Gemini
        const design = await this.analyzeWithGemini(title, description, narration, tags, scenes, channelContext);
        console.error(`🎯 Archetype: [${design.archetype.toUpperCase()}] | Hook: "${design.hook}"`);
        console.error(`🏷️  Badge: "${design.badge}" | Accent: "${design.accentText}"`);
        console.error(`🎨 Theme Color: ${design.themeColor}`);

        // 3. Fetch high-definition backdrop (FLUX.1 -> Pexels -> Curated 4K)
        const bgImageUrl = await this.fetchBackdrop(design.fluxPrompt, design.pexelsQuery);

        // 4. Render HTML canvas to JPEG via Puppeteer
        const html = this.buildHtml(design, bgImageUrl);
        const localPath = await this.renderToImage(videoId, html);

        // 5. Upload to Cloudinary
        console.error(`☁️ Uploading primary thumbnail to Cloudinary...`);
        const cloudinaryService = CloudinaryService.getInstance();
        const uploadResult = await cloudinaryService.uploadImage(
            localPath,
            'thumbnails',
            `${videoId}-thumbnail`
        );

        console.error(`✅ Primary thumbnail published: ${uploadResult.secureUrl}`);

        const result: ThumbnailComposeResult = {
            thumbnailUrl: uploadResult.secureUrl,
            localPath,
            hook: design.hook,
            badge: design.badge,
            archetype: design.archetype,
            themeColor: design.themeColor,
            variations: []
        };

        // 6. Optional: Generate YouTube Studio "Test & Compare" variations
        if (generateVariations) {
            const alternativeArchetypes: Array<'split_comparison' | 'code_terminal_bug' | 'metric_showdown' | 'cinematic_focal_hero'> = [
                'split_comparison', 'code_terminal_bug', 'metric_showdown', 'cinematic_focal_hero'
            ].filter(a => a !== design.archetype) as any;

            for (let i = 0; i < Math.min(2, alternativeArchetypes.length); i++) {
                try {
                    const altArch = alternativeArchetypes[i];
                    console.error(`🧪 Generating Test & Compare variation #${i + 1} (${altArch})...`);
                    const altDesign: DesignMetadata = {
                        ...design,
                        archetype: altArch,
                        themeColor: i === 0 ? '#FF2A6D' : '#00FF66'
                    };
                    const altHtml = this.buildHtml(altDesign, bgImageUrl);
                    const altLocalPath = await this.renderToImage(`${videoId}-var${i + 1}`, altHtml);
                    const altUpload = await cloudinaryService.uploadImage(
                        altLocalPath,
                        'thumbnails',
                        `${videoId}-thumbnail-var${i + 1}`
                    );
                    result.variations?.push({
                        thumbnailUrl: altUpload.secureUrl,
                        localPath: altLocalPath,
                        hook: altDesign.hook,
                        badge: altDesign.badge,
                        archetype: altArch
                    });
                } catch (varErr) {
                    console.warn(`⚠️ Failed to generate variation #${i + 1}:`, varErr);
                }
            }

            // Cache variations in Redis for pipeline monitoring / mobile UI
            if (process.env.REDIS_URL && result.variations && result.variations.length > 0) {
                try {
                    const redis = new Redis(process.env.REDIS_URL);
                    await redis.set(
                        `pipeline:status:thumbnail_variations`,
                        JSON.stringify([result.thumbnailUrl, ...result.variations.map(v => v.thumbnailUrl)]),
                        'EX',
                        60 * 60 * 24 * 7
                    );
                    await redis.quit();
                } catch (rErr) {
                    // Non-fatal
                }
            }
        }

        return result;
    }

    /**
     * Gather channel intelligence: top past video titles & thumbnails for style consistency
     */
    private async getChannelIntelligence(): Promise<string[]> {
        if (!config.youtube.clientId || !config.youtube.refreshToken) {
            return [];
        }

        try {
            // Check Redis cache first
            if (process.env.REDIS_URL) {
                try {
                    const redis = new Redis(process.env.REDIS_URL);
                    const cached = await redis.get('channel:thumbnail_context');
                    await redis.quit();
                    if (cached) {
                        return JSON.parse(cached);
                    }
                } catch (e) {
                    // Ignore cache read error
                }
            }

            const yt = new YouTubeDataService();
            const recent = await yt.fetchRecentVideos(20, 180);
            const longForm = recent.filter(v => !v.isShort);
            const titles = longForm.slice(0, 8).map(v => v.title);

            if (process.env.REDIS_URL && titles.length > 0) {
                try {
                    const redis = new Redis(process.env.REDIS_URL);
                    await redis.set('channel:thumbnail_context', JSON.stringify(titles), 'EX', 86400);
                    await redis.quit();
                } catch (e) {
                    // Ignore cache write error
                }
            }

            return titles;
        } catch (err: any) {
            console.warn('⚠️ Could not fetch YouTube channel history for thumbnail context:', err?.message || err);
            return [];
        }
    }

    /**
     * Synthesize high-CTR thumbnail design metadata using Gemini
     */
    private async analyzeWithGemini(
        title: string,
        description?: string,
        narration?: string,
        tags?: string[],
        scenes?: Array<{ narration?: string; actions?: any[] }>,
        channelTitles: string[] = []
    ): Promise<DesignMetadata> {
        const candidateKeys = [
            config.gemini.apiKey1,
            config.gemini.apiKey2,
            config.gemini.apiKey,
            process.env.GEMINI_API_KEY_1,
            process.env.GEMINI_API_KEY_2,
            process.env.GEMINI_API_KEY,
        ].filter((k): k is string => Boolean(k?.trim()));
        const uniqueKeys = Array.from(new Set(candidateKeys));

        // Default heuristic design
        const defaultDesign: DesignMetadata = {
            archetype: 'split_comparison',
            hook: this.cleanFallbackHook(title),
            badge: (tags && tags[0]) ? tags[0].toUpperCase() : 'TECH',
            accentText: 'DEEP DIVE',
            highlightText: "DON'T MAKE THIS MISTAKE",
            themeColor: '#00F0FF',
            fluxPrompt: 'cinematic dark futuristic quantum server room glowing neon blue cables 8k octane render',
            pexelsQuery: 'dark tech server network',
            comparison: {
                leftTitle: 'OLD WAY',
                leftMetric: '450ms',
                leftBadge: '⛔ SLOW',
                leftNote: 'Traditional approach',
                rightTitle: 'NEW WAY',
                rightMetric: '12ms',
                rightBadge: '⚡ 10X FASTER',
                rightNote: 'Optimized modern pattern',
                vsText: 'VS'
            }
        };

        if (uniqueKeys.length === 0) {
            console.error('⚠️ No Gemini API key found, using heuristic thumbnail design.');
            return defaultDesign;
        }

        // Extract scene excerpts for visual grounding
        const sceneExcerpts = (scenes || [])
            .slice(0, 3)
            .map(s => s.narration || '')
            .filter(Boolean)
            .join(' | ')
            .slice(0, 350);

        const prompt = `You are the Lead YouTube Studio Thumbnail Designer for a top-tier engineering channel (similar to Fireship, Theo, ByteByteGo, ByteMonk).
Your goal is to design an ultra-high CTR, clickable YouTube thumbnail (1280x720) that hooks engineers instantly.

VIDEO CONTEXT:
Title: "${title}"
Description: "${description?.slice(0, 300) || ''}"
Tags: "${tags?.join(', ') || ''}"
Key Visual Cues from Script: "${sceneExcerpts || narration?.slice(0, 350) || ''}"

${channelTitles.length > 0 ? `Channel Past Video Titles for tone consistency:\n${channelTitles.map(t => '- ' + t).join('\n')}\n` : ''}

CRITICAL RULES:
1. Select the BEST layout ARCHETYPE for this topic:
   - "code_terminal_bug": Use when the video discusses a coding pitfall, bad syntax, concurrency bug, memory leak, or language feature mistake.
   - "split_comparison": Use when the video compares two technologies, architectures, or frameworks (e.g., REST vs gRPC, Monolith vs Microservices, Postgres vs Mongo, Old vs New).
   - "metric_showdown": Use when the video is about speed, latency, optimization, benchmarks, or throughput gains (e.g. 10x faster, memory reduction).
   - "cinematic_focal_hero": Use for conceptual deep dives, hardware, AI, distributed systems, quantum computing, or architecture topology.
2. "hook": 2 to 4 punchy, emotional, curiosity-gap all-caps words (e.g. "NEVER AWAIT HERE", "STOP USING REST", "EVENT LOOP DEAD", "REDIS 10X FASTER", "99% CRASH HERE"). DO NOT exceed 4 words!
3. "badge": 1 or 2 uppercase words identifying the technology/topic (e.g. "NODE.JS", "POSTGRES", "DOCKER", "KAFKA", "KUBERNETES", "REACT").
4. "accentText": 1 or 2 words sub-badge (e.g. "CRITICAL BUG", "ARCHITECTURE", "BENCHMARK", "EXPLAINED").
5. "highlightText": Bottom high-contrast alert text (e.g. "KILLS SERVER THRUPUT", "DON'T MAKE THIS MISTAKE", "WHY 99% GET THIS WRONG").
6. "themeColor": Neon accent hex fitting the mood:
   - Danger/Bug/Crash: "#FF2A6D" or "#FF9900"
   - Speed/Optimization/Success: "#00FF66" or "#00F0FF"
   - Futuristic/Architecture/Deep Dive: "#00F0FF" or "#9D4EDD"
7. "fluxPrompt": Highly detailed 10-word prompt for generating a photorealistic, cinematic 3D macro tech backdrop using FLUX.1.
8. Archetype-specific structured data:
   - If "code_terminal_bug": include "codeSnippet" with "filename", "language", 3-5 "lines" of code ({ "num": 1, "text": "...", "isError": true, "errorTag": "💥 10X SLOWER" }), and "pointerBadge" ("⚠️ DEADLOCK HAZARD").
   - If "split_comparison": include "comparison" with left/right titles, metrics, badges, and notes.
   - If "metric_showdown": include "benchmark" with old/new labels, values, percentages (0-100), and "multiplierBadge" ("35X FASTER").

Return STRICT JSON only matching this schema:
{
  "archetype": "code_terminal_bug" | "split_comparison" | "metric_showdown" | "cinematic_focal_hero",
  "hook": "string",
  "badge": "string",
  "accentText": "string",
  "highlightText": "string",
  "themeColor": "string",
  "fluxPrompt": "string",
  "pexelsQuery": "string",
  "codeSnippet": { ... },
  "comparison": { ... },
  "benchmark": { ... }
}`;

        const CANDIDATE_MODELS = [
            process.env.GEMINI_MODEL,
            'gemini-3.8-flash',
            'gemini-3-flash-preview',
            'gemini-3.5-flash-lite',
            'gemini-3.1-flash-lite',
            'gemini-2.5-flash',
        ].filter((m): m is string => Boolean(m));

        for (const apiKey of uniqueKeys) {
            try {
                const ai = new GoogleGenAI({ apiKey });
                let response: any = null;

                for (const model of CANDIDATE_MODELS) {
                    try {
                        response = await ai.models.generateContent({
                            model,
                            contents: prompt,
                            config: {
                                temperature: 0.35,
                                responseMimeType: 'application/json'
                            }
                        });
                        if (response?.text) break;
                    } catch (err: any) {
                        console.warn(`⚠️ Thumbnail analysis failed on model ${model}:`, err?.message || err);
                    }
                }

                if (response?.text) {
                    const parsed = JSON.parse(response.text);
                    const validArchetypes = ['code_terminal_bug', 'split_comparison', 'metric_showdown', 'cinematic_focal_hero'];
                    const archetype = validArchetypes.includes(parsed.archetype) ? parsed.archetype : defaultDesign.archetype;

                    return {
                        archetype,
                        hook: (parsed.hook || defaultDesign.hook).toUpperCase(),
                        badge: (parsed.badge || defaultDesign.badge).toUpperCase(),
                        accentText: (parsed.accentText || defaultDesign.accentText).toUpperCase(),
                        highlightText: (parsed.highlightText || defaultDesign.highlightText).toUpperCase(),
                        themeColor: parsed.themeColor || defaultDesign.themeColor,
                        fluxPrompt: parsed.fluxPrompt || defaultDesign.fluxPrompt,
                        pexelsQuery: parsed.pexelsQuery || defaultDesign.pexelsQuery,
                        codeSnippet: parsed.codeSnippet,
                        comparison: parsed.comparison,
                        benchmark: parsed.benchmark
                    };
                }
            } catch (keyErr: any) {
                console.warn(`⚠️ Gemini API key attempt failed, trying next key:`, keyErr?.message || keyErr);
            }
        }

        console.error('⚠️ All Gemini keys and models failed for thumbnail analysis, using fallback design.');
        return defaultDesign;
    }

    /**
     * Fetch high-definition backdrop image:
     * 1. Pollinations.ai FLUX.1 (Free AI generation)
     * 2. Pexels API (if key available)
     * 3. Curated 4K Dark Tech Photography (local fallback)
     */
    private async fetchBackdrop(fluxPrompt: string, pexelsQuery: string): Promise<string> {
        const randomFallback = FALLBACK_BACKGROUNDS[Math.floor(Math.random() * FALLBACK_BACKGROUNDS.length)];

        // 1. Try Pollinations FLUX.1 (Free, stunning, zero API key)
        try {
            console.error(`🎨 Fetching AI backdrop via FLUX.1 (Pollinations)...`);
            const promptEnc = encodeURIComponent(`${fluxPrompt}, dark atmosphere, cinematic lighting, 8k, photorealistic`);
            const seed = Math.floor(Math.random() * 1000000);
            const fluxUrl = `https://image.pollinations.ai/prompt/${promptEnc}?width=1280&height=720&model=flux&nologo=true&seed=${seed}`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s max timeout

            const res = await fetch(fluxUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok && res.headers.get('content-type')?.includes('image')) {
                console.error(`✅ FLUX.1 backdrop generated successfully!`);
                return fluxUrl;
            }
        } catch (e: any) {
            console.warn(`⚠️ FLUX.1 backdrop generation timed out or failed, falling back to photography:`, e?.message || e);
        }

        // 2. Try Pexels API
        const pexelsKey = process.env.PEXELS_API_KEY;
        if (pexelsKey) {
            try {
                const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(pexelsQuery)}&per_page=5&orientation=landscape`;
                const res = await fetch(url, { headers: { Authorization: pexelsKey } });
                if (res.ok) {
                    const data = await res.json();
                    if (data.photos && data.photos.length > 0) {
                        return data.photos[0].src.large2x || data.photos[0].src.original || randomFallback;
                    }
                }
            } catch (e) {
                console.warn('⚠️ Pexels fetch failed, using curated backdrop.');
            }
        }

        return randomFallback;
    }

    /**
     * Build the pixel-perfect HTML layout based on selected archetype
     */
    private buildHtml(design: DesignMetadata, bgImageUrl: string): string {
        const words = design.hook.split(' ');
        let line1 = '';
        let line2 = '';
        if (words.length <= 2) {
            line1 = words.join(' ');
        } else {
            const mid = Math.ceil(words.length / 2);
            line1 = words.slice(0, mid).join(' ');
            line2 = words.slice(mid).join(' ');
        }

        const baseCss = `
            @import url('https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@500;700;800&family=Montserrat:wght@700;800;900&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                width: 1280px; height: 720px; overflow: hidden;
                background: #030509; font-family: 'Montserrat', sans-serif;
                position: relative; color: #FFF;
            }
            .bg-container {
                position: absolute; inset: 0;
                background-image: url('${bgImageUrl}');
                background-size: cover; background-position: center right;
                filter: saturate(1.35) contrast(1.2) brightness(0.42);
            }
            .overlay {
                position: absolute; inset: 0;
                background: linear-gradient(90deg, rgba(2,4,8,0.98) 0%, rgba(2,4,8,0.92) 46%, rgba(2,4,8,0.65) 75%, rgba(2,4,8,0.3) 100%);
            }
            .grid-lines {
                position: absolute; inset: 0;
                background-image: linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px);
                background-size: 50px 50px; pointer-events: none;
            }
            .frame-border {
                position: absolute; inset: 12px;
                border: 2px solid rgba(255,255,255,0.07);
                border-radius: 18px; pointer-events: none;
            }
            .corner-accent {
                position: absolute; top: 12px; right: 12px; width: 42px; height: 42px;
                border-top: 4px solid ${design.themeColor}; border-right: 4px solid ${design.themeColor};
            }
            .content-left {
                position: absolute; top: 0; left: 0; bottom: 0; width: 620px;
                z-index: 10; display: flex; flex-direction: column; justify-content: center;
                padding-left: 64px;
            }
            .badge-row {
                display: flex; align-items: center; gap: 12px; margin-bottom: 20px;
            }
            .pill-badge {
                background: ${design.themeColor}; color: #000;
                font-size: 19px; font-weight: 900; letter-spacing: 2px;
                padding: 8px 18px; border-radius: 8px; text-transform: uppercase;
                box-shadow: 0 0 25px ${design.themeColor}77;
            }
            .sub-pill {
                background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
                color: rgba(255,255,255,0.85); font-size: 15px; font-weight: 800;
                letter-spacing: 2px; padding: 7px 16px; border-radius: 8px;
            }
            .headline {
                font-family: 'Anton', sans-serif; font-size: 82px; line-height: 0.96;
                letter-spacing: 2px; text-transform: uppercase; margin-bottom: 24px;
                background: linear-gradient(180deg, #FFFFFF 0%, #D8E2F0 50%, #90A4BF 100%);
                -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                filter: drop-shadow(0 6px 16px rgba(0,0,0,0.9));
            }
            .headline-glow {
                color: ${design.themeColor}; -webkit-text-fill-color: ${design.themeColor};
                filter: drop-shadow(0 0 35px ${design.themeColor}88);
            }
            .highlight-alert {
                display: inline-flex; align-items: center; gap: 10px;
                background: rgba(255, 42, 109, 0.15); border: 2px solid #FF2A6D;
                border-radius: 10px; padding: 10px 18px; width: fit-content;
                box-shadow: 0 0 25px rgba(255, 42, 109, 0.35);
            }
            .highlight-alert.cyan {
                background: rgba(0, 240, 255, 0.15); border-color: #00F0FF;
                box-shadow: 0 0 25px rgba(0, 240, 255, 0.35);
            }
            .highlight-alert.green {
                background: rgba(0, 255, 102, 0.15); border-color: #00FF66;
                box-shadow: 0 0 25px rgba(0, 255, 102, 0.35);
            }
            .alert-text {
                color: #FFF; font-size: 18px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase;
            }
            .content-right {
                position: absolute; top: 0; right: 48px; bottom: 0; width: 560px;
                z-index: 10; display: flex; align-items: center; justify-content: center;
            }
        `;

        let rightContentHtml = '';

        if (design.archetype === 'code_terminal_bug') {
            const snippet = design.codeSnippet || {
                filename: 'worker-pool.ts',
                language: 'typescript',
                lines: [
                    { num: 1, text: 'for (const item of queue) {' },
                    { num: 2, text: '  await processItem(item);', isError: true, errorTag: '💥 10X SLOWER' },
                    { num: 3, text: '}' }
                ],
                pointerBadge: 'DEADLOCK HAZARD'
            };

            const codeRowsHtml = snippet.lines.map(line => `
                <div class="code-line ${line.isError ? 'error-line' : ''}">
                    <span class="line-num">${line.num}</span>
                    <span class="code-text">${this.escapeHtml(line.text)}</span>
                    ${line.errorTag ? `<span class="error-tag">${line.errorTag}</span>` : ''}
                </div>
            `).join('');

            rightContentHtml = `
                <div class="terminal-window">
                    <div class="terminal-header">
                        <div class="traffic-lights">
                            <div class="light red"></div>
                            <div class="light yellow"></div>
                            <div class="light green"></div>
                        </div>
                        <div class="filename">${snippet.filename}</div>
                        <div style="width: 40px;"></div>
                    </div>
                    <div class="code-body">
                        ${codeRowsHtml}
                    </div>
                </div>
                ${snippet.pointerBadge ? `
                    <div class="pointer-callout">
                        <span>⚠️</span> ${snippet.pointerBadge}
                    </div>
                ` : ''}
            `;
        } else if (design.archetype === 'split_comparison') {
            const comp = design.comparison || {
                leftTitle: 'REST API',
                leftMetric: '450ms',
                leftBadge: '⛔ HIGH OVERHEAD',
                leftNote: 'JSON Serialization Bottleneck',
                rightTitle: 'gRPC',
                rightMetric: '14ms',
                rightBadge: '⚡ PRODUCTION READY',
                rightNote: 'Binary Protocol Buffers',
                vsText: 'VS'
            };

            rightContentHtml = `
                <div class="vs-container">
                    <div class="compare-card left">
                        <div>
                            <div class="card-header">${comp.leftTitle}</div>
                            <div class="card-metric" style="color: #FF2A6D;">${comp.leftMetric}</div>
                            <div class="card-badge left-badge">${comp.leftBadge}</div>
                        </div>
                        <div class="card-footer">${comp.leftNote}</div>
                    </div>
                    <div class="vs-circle">${comp.vsText || 'VS'}</div>
                    <div class="compare-card right">
                        <div>
                            <div class="card-header">${comp.rightTitle}</div>
                            <div class="card-metric" style="color: #00FF66;">${comp.rightMetric}</div>
                            <div class="card-badge right-badge">${comp.rightBadge}</div>
                        </div>
                        <div class="card-footer">${comp.rightNote}</div>
                    </div>
                </div>
            `;
        } else if (design.archetype === 'metric_showdown') {
            const bench = design.benchmark || {
                metricTitle: 'LATENCY BENCHMARK',
                oldLabel: 'BEFORE OPTIMIZATION',
                oldValue: '480 ms',
                oldBarPercent: 95,
                newLabel: 'POST-OPTIMIZATION',
                newValue: '14 ms',
                newBarPercent: 18,
                multiplierBadge: '34X FASTER'
            };

            rightContentHtml = `
                <div class="metric-card">
                    <div class="metric-title">${bench.metricTitle}</div>
                    <div class="bar-group">
                        <div class="bar-label-row">
                            <span>${bench.oldLabel}</span>
                            <span style="color: #FF2A6D; font-weight: 800;">${bench.oldValue}</span>
                        </div>
                        <div class="bar-track">
                            <div class="bar-fill red" style="width: ${bench.oldBarPercent}%;"></div>
                        </div>
                    </div>
                    <div class="bar-group" style="margin-top: 24px;">
                        <div class="bar-label-row">
                            <span>${bench.newLabel}</span>
                            <span style="color: #00FF66; font-weight: 800;">${bench.newValue}</span>
                        </div>
                        <div class="bar-track">
                            <div class="bar-fill green" style="width: ${bench.newBarPercent}%;"></div>
                        </div>
                    </div>
                    <div class="multiplier-banner">
                        <span>⚡</span> ${bench.multiplierBadge}
                    </div>
                </div>
            `;
        } else {
            // cinematic_focal_hero
            rightContentHtml = `
                <div class="hero-schematic">
                    <div class="schematic-halo"></div>
                    <div class="schematic-node node-center">
                        <svg viewBox="0 0 24 24" width="64" height="64" stroke="${design.themeColor}" stroke-width="2" fill="none">
                            <rect x="2" y="2" width="20" height="8" rx="2"></rect>
                            <rect x="2" y="14" width="20" height="8" rx="2"></rect>
                            <line x1="6" y1="6" x2="6.01" y2="6"></line>
                            <line x1="6" y1="18" x2="6.01" y2="18"></line>
                        </svg>
                        <div class="node-tag">SYSTEM CORE</div>
                    </div>
                    <div class="node-satellites">
                        <div class="sat-item sat-top">
                            <span>99.99% UPTIME</span>
                        </div>
                        <div class="sat-item sat-bottom">
                            <span>ZERO LATENCY</span>
                        </div>
                    </div>
                </div>
            `;
        }

        const alertClass = design.archetype === 'split_comparison' || design.archetype === 'metric_showdown'
            ? 'green' : (design.archetype === 'cinematic_focal_hero' ? 'cyan' : '');

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    ${baseCss}

    /* Terminal Styles */
    .terminal-window {
        width: 530px; background: rgba(9, 13, 20, 0.94);
        border: 2px solid rgba(0, 240, 255, 0.35); border-radius: 14px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.85), 0 0 35px rgba(0, 240, 255, 0.2);
        overflow: hidden; font-family: 'JetBrains Mono', monospace;
    }
    .terminal-header {
        background: rgba(255,255,255,0.06); padding: 12px 16px;
        display: flex; align-items: center; justify-content: space-between;
        border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .traffic-lights { display: flex; gap: 8px; }
    .light { width: 12px; height: 12px; border-radius: 50%; }
    .light.red { background: #FF5F56; }
    .light.yellow { background: #FFBD2E; }
    .light.green { background: #27C93F; }
    .filename { color: #8F9BA8; font-size: 13px; font-weight: 700; letter-spacing: 1px; }
    .code-body { padding: 22px; font-size: 16px; line-height: 1.7; }
    .code-line { display: flex; align-items: center; }
    .line-num { width: 32px; color: #4A5568; font-size: 13px; user-select: none; }
    .code-text { color: #E2E8F0; }
    .error-line {
        background: rgba(255, 42, 109, 0.25); border-left: 4px solid #FF2A6D;
        margin: 6px -22px; padding: 4px 18px;
    }
    .error-tag {
        display: inline-flex; align-items: center; gap: 6px;
        background: #FF2A6D; color: #FFF; font-size: 12px; font-weight: 900;
        padding: 3px 8px; border-radius: 4px; margin-left: 12px;
        box-shadow: 0 0 12px #FF2A6D;
    }
    .pointer-callout {
        position: absolute; bottom: 85px; right: 30px;
        background: #FF2A6D; color: #FFF; font-weight: 900; font-size: 18px;
        letter-spacing: 1.5px; padding: 12px 20px; border-radius: 8px;
        box-shadow: 0 0 35px #FF2A6D; display: flex; align-items: center; gap: 8px;
        transform: rotate(-3deg);
    }

    /* Comparison Styles */
    .vs-container { display: flex; align-items: center; gap: 18px; position: relative; }
    .compare-card {
        width: 240px; height: 330px; border-radius: 16px;
        padding: 24px 18px; display: flex; flex-direction: column;
        justify-content: space-between; backdrop-filter: blur(14px);
        box-shadow: 0 16px 40px rgba(0,0,0,0.8);
    }
    .compare-card.left {
        background: rgba(255, 42, 109, 0.08); border: 2px solid rgba(255, 42, 109, 0.5);
    }
    .compare-card.right {
        background: rgba(0, 255, 102, 0.08); border: 2px solid rgba(0, 255, 102, 0.5);
    }
    .card-header {
        font-size: 24px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase;
    }
    .compare-card.left .card-header { color: #FF2A6D; }
    .compare-card.right .card-header { color: #00FF66; }
    .card-metric {
        font-family: 'Anton', sans-serif; font-size: 48px; line-height: 1; margin: 14px 0 6px;
    }
    .card-badge {
        display: inline-block; font-size: 13px; font-weight: 900;
        letter-spacing: 1px; padding: 6px 12px; border-radius: 6px;
        text-transform: uppercase; width: fit-content;
    }
    .left-badge {
        background: rgba(255, 42, 109, 0.2); color: #FF2A6D; border: 1px solid #FF2A6D;
    }
    .right-badge {
        background: rgba(0, 255, 102, 0.2); color: #00FF66; border: 1px solid #00FF66;
        box-shadow: 0 0 15px rgba(0, 255, 102, 0.4);
    }
    .card-footer {
        font-size: 13px; color: rgba(255,255,255,0.7); font-weight: 700;
        border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px;
    }
    .vs-circle {
        position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
        width: 66px; height: 66px; border-radius: 50%;
        background: #04060B; border: 3px solid #00F0FF; box-shadow: 0 0 35px #00F0FF;
        display: flex; align-items: center; justify-content: center;
        font-family: 'Anton', sans-serif; font-size: 26px; color: #00F0FF; z-index: 20;
    }

    /* Metric Showdown Styles */
    .metric-card {
        width: 520px; background: rgba(9, 13, 20, 0.94);
        border: 2px solid rgba(0, 255, 102, 0.35); border-radius: 16px;
        padding: 32px 28px; box-shadow: 0 20px 50px rgba(0,0,0,0.85);
    }
    .metric-title {
        font-size: 20px; font-weight: 900; letter-spacing: 2px; color: #FFF;
        margin-bottom: 24px; text-transform: uppercase;
    }
    .bar-group { display: flex; flex-direction: column; gap: 8px; }
    .bar-label-row {
        display: flex; justify-content: space-between; font-size: 16px; font-weight: 800;
    }
    .bar-track {
        height: 20px; background: rgba(255,255,255,0.06); border-radius: 10px; overflow: hidden;
    }
    .bar-fill.red {
        height: 100%; background: linear-gradient(90deg, #FF2A6D, #FF5F56);
        box-shadow: 0 0 20px rgba(255, 42, 109, 0.6);
    }
    .bar-fill.green {
        height: 100%; background: linear-gradient(90deg, #00FF66, #27C93F);
        box-shadow: 0 0 20px rgba(0, 255, 102, 0.6);
    }
    .multiplier-banner {
        margin-top: 28px; background: #00FF66; color: #000;
        font-family: 'Anton', sans-serif; font-size: 34px; letter-spacing: 2px;
        padding: 12px 20px; border-radius: 10px; text-align: center;
        box-shadow: 0 0 35px rgba(0, 255, 102, 0.5);
    }

    /* Cinematic Focal Styles */
    .hero-schematic {
        position: relative; width: 440px; height: 440px;
        display: flex; align-items: center; justify-content: center;
    }
    .schematic-halo {
        position: absolute; width: 380px; height: 380px; border-radius: 50%;
        background: radial-gradient(circle, ${design.themeColor}33 0%, transparent 70%);
        filter: blur(25px);
    }
    .node-center {
        width: 170px; height: 170px; border-radius: 24px;
        background: rgba(10, 15, 24, 0.9); border: 3px solid ${design.themeColor};
        box-shadow: 0 0 45px ${design.themeColor}66;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 12px; z-index: 10;
    }
    .node-tag {
        font-size: 13px; font-weight: 900; letter-spacing: 1px; color: ${design.themeColor};
    }
    .sat-item {
        position: absolute; background: rgba(255,255,255,0.08);
        border: 2px solid rgba(255,255,255,0.25); backdrop-filter: blur(10px);
        padding: 10px 18px; border-radius: 10px; font-size: 15px; font-weight: 900;
        letter-spacing: 1.5px;
    }
    .sat-top { top: 40px; right: 20px; border-color: ${design.themeColor}; color: ${design.themeColor}; }
    .sat-bottom { bottom: 40px; left: 20px; border-color: #FF2A6D; color: #FF2A6D; }
  </style>
</head>
<body>
  <div class="bg-container"></div>
  <div class="overlay"></div>
  <div class="grid-lines"></div>
  <div class="frame-border"></div>
  <div class="corner-accent"></div>

  <div class="content-left">
    <div class="badge-row">
      <span class="pill-badge">${design.badge}</span>
      <span class="sub-pill">${design.accentText}</span>
    </div>

    <div class="headline">
      ${line1}<br/>
      ${line2 ? `<span class="headline-glow">${line2}</span>` : ''}
    </div>

    <div class="highlight-alert ${alertClass}">
      <span>⚠️</span>
      <span class="alert-text">${design.highlightText}</span>
    </div>
  </div>

  <div class="content-right">
    ${rightContentHtml}
  </div>
</body>
</html>`;
    }

    /**
     * Render HTML to JPEG via Puppeteer with zero-timeout safety
     */
    private async renderToImage(videoId: string, html: string): Promise<string> {
        const tmpDir = process.env.WORK_DIR || path.join(process.cwd(), 'videos', '.tmp-thumbnails');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        const outputPath = path.join(tmpDir, `${videoId}-thumbnail.jpg`);

        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });

        try {
            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });

            // Fast reliable page load
            await page.setContent(html, { waitUntil: 'load', timeout: 12000 });
            await page.evaluateHandle('document.fonts.ready').catch(() => {});

            await page.screenshot({
                path: outputPath,
                type: 'jpeg',
                quality: 95
            });

            console.error(`✅ Rendered studio thumbnail image to: ${outputPath}`);
            return outputPath;
        } finally {
            await browser.close();
        }
    }

    /**
     * Fallback title cleaner if AI is offline
     */
    private cleanFallbackHook(title: string): string {
        const clean = title.replace(/[:\-–—].*$/, '').trim();
        const words = clean.split(' ');
        return words.slice(0, 3).join(' ').toUpperCase();
    }

    private escapeHtml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

export default ThumbnailComposer;
