/**
 * High-Quality Autonomous Thumbnail Composer
 * Generates professional, CTR-optimized YouTube thumbnails (1280x720)
 * using Gemini design direction, Pexels royalty-free tech backdrops,
 * and a Puppeteer typographic canvas renderer.
 * 
 * 100% Free - No paid API subscriptions required.
 */

import puppeteer from 'puppeteer';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import config from '../config';
import CloudinaryService from './cloudinary-service';

export interface ThumbnailComposeOptions {
    videoId: string;
    title: string;
    description?: string;
    narration?: string;
    tags?: string[];
}

export interface ThumbnailComposeResult {
    thumbnailUrl: string;
    localPath: string;
    hook: string;
    badge: string;
    themeColor: string;
}

interface DesignMetadata {
    hook: string;
    badge: string;
    accentText: string;
    highlightText: string;
    themeColor: string;
    iconType: 'server' | 'database' | 'cpu' | 'cloud' | 'shield' | 'zap' | 'code' | 'warning';
    pexelsQuery: string;
}

const ICONS: Record<string, string> = {
    server: `
      <svg viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
        <line x1="6" y1="6" x2="6.01" y2="6"></line>
        <line x1="6" y1="18" x2="6.01" y2="18"></line>
        <path d="M13 6l3 3-3 3"></path>
      </svg>`,
    database: `
      <svg viewBox="0 0 24 24">
        <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
      </svg>`,
    cpu: `
      <svg viewBox="0 0 24 24">
        <rect x="4" y="4" width="16" height="16" rx="2"></rect>
        <rect x="9" y="9" width="6" height="6"></rect>
        <line x1="9" y1="1" x2="9" y2="4"></line>
        <line x1="15" y1="1" x2="15" y2="4"></line>
        <line x1="9" y1="20" x2="9" y2="23"></line>
        <line x1="15" y1="20" x2="15" y2="23"></line>
        <line x1="20" y1="9" x2="23" y2="9"></line>
        <line x1="20" y1="15" x2="23" y2="15"></line>
        <line x1="1" y1="9" x2="4" y2="9"></line>
        <line x1="1" y1="15" x2="4" y2="15"></line>
      </svg>`,
    cloud: `
      <svg viewBox="0 0 24 24">
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
      </svg>`,
    shield: `
      <svg viewBox="0 0 24 24">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        <polyline points="9 12 11 14 15 10"></polyline>
      </svg>`,
    zap: `
      <svg viewBox="0 0 24 24">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>`,
    code: `
      <svg viewBox="0 0 24 24">
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
      </svg>`,
    warning: `
      <svg viewBox="0 0 24 24">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>`
};

// Curated high-resolution dark tech backgrounds as bulletproof fallbacks
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
     * Generate a high quality thumbnail and upload to Cloudinary
     */
    async compose(options: ThumbnailComposeOptions): Promise<ThumbnailComposeResult> {
        const { videoId, title, description, narration, tags } = options;
        console.error(`\n🎨 === HIGH-QUALITY THUMBNAIL COMPOSER ===`);
        console.error(`📹 Video ID: ${videoId}`);
        console.error(`📝 Title: ${title}`);

        // 1. Analyze script with Gemini to derive optimal click-through design
        const design = await this.analyzeWithGemini(title, description, narration, tags);
        console.error(`🎯 Design Hook: "${design.hook}"`);
        console.error(`🏷️  Badge: "${design.badge}" | Accent: "${design.accentText}"`);
        console.error(`🎨 Theme Color: ${design.themeColor}`);

        // 2. Fetch high-res backdrop from Pexels or fallback
        const bgImageUrl = await this.fetchBackdrop(design.pexelsQuery);

        // 3. Render HTML template via Puppeteer
        const html = this.buildHtml(design, bgImageUrl);
        const localPath = await this.renderToImage(videoId, html);

        // 4. Upload to Cloudinary
        console.error(`☁️ Uploading thumbnail to Cloudinary...`);
        const cloudinaryService = CloudinaryService.getInstance();
        const uploadResult = await cloudinaryService.uploadImage(
            localPath,
            'thumbnails',
            `${videoId}-thumbnail`
        );

        console.error(`✅ Thumbnail published to Cloudinary: ${uploadResult.secureUrl}`);

        return {
            thumbnailUrl: uploadResult.secureUrl,
            localPath,
            hook: design.hook,
            badge: design.badge,
            themeColor: design.themeColor
        };
    }

    /**
     * Use Gemini to synthesize thumbnail metadata optimized for high click-through-rate (CTR)
     */
    private async analyzeWithGemini(
        title: string,
        description?: string,
        narration?: string,
        tags?: string[]
    ): Promise<DesignMetadata> {
        const apiKey = config.gemini.apiKey1 || config.gemini.apiKey || process.env.GEMINI_API_KEY;

        // Fallback default design if Gemini is unavailable
        const defaultDesign: DesignMetadata = {
            hook: this.cleanFallbackHook(title),
            badge: (tags && tags[0]) ? tags[0].toUpperCase() : 'TECH',
            accentText: 'DEEP DIVE',
            highlightText: "Don't Make This Mistake",
            themeColor: '#00F0FF',
            iconType: 'server',
            pexelsQuery: 'dark tech server network'
        };

        if (!apiKey) {
            console.error('⚠️ No Gemini API key found, using heuristic thumbnail design.');
            return defaultDesign;
        }

        try {
            const ai = new GoogleGenAI({ apiKey });
            const prompt = `You are an elite YouTube thumbnail designer for a high-end tech/engineering channel (similar to Fireship, Theo, ByteByteGo).
Analyze this video context and generate compelling thumbnail layout elements:

Title: "${title}"
Description: "${description?.slice(0, 300) || ''}"
Tags: "${tags?.join(', ') || ''}"

Return a STRICT JSON object with these exact keys:
1. "hook": 2 to 4 punchy, emotional, all-caps words that create curiosity/urgency for the big headline. (e.g. "EVENT LOOP DEAD?", "99% CRASH HERE", "REDIS 10X FASTER", "NEVER AWAIT HERE", "MEMORY LEAK KILLER"). Do NOT exceed 4 words!
2. "badge": 1 or 2 uppercase words identifying the technology or topic (e.g. "NODE.JS", "POSTGRES", "DOCKER", "KAFKA", "SYSTEM DESIGN", "PYTHON").
3. "accentText": 1 or 2 words sub-badge (e.g. "DEEP DIVE", "BENCHMARK", "ARCHITECTURE", "CRITICAL", "EXPLAINED").
4. "highlightText": A concise bottom highlight phrase (e.g. "DON'T MAKE THIS MISTAKE", "WHY 99% GET THIS WRONG", "PRODUCTION NIGHTMARE", "SOLVED IN 5 MINUTES").
5. "themeColor": A vibrant neon hex color fitting the mood:
   - Performance / Danger / Warning: "#FF2A6D" or "#FF9900"
   - Speed / Optimization / Success: "#00FF66" or "#FFDD00"
   - Architecture / Future / Cyberpunk: "#00F0FF" or "#9D4EDD"
6. "iconType": One of ["server", "database", "cpu", "cloud", "shield", "zap", "code", "warning"].
7. "pexelsQuery": 3 to 4 English words for searching a dark atmospheric tech background photo (e.g. "server room dark glowing", "cyberpunk circuit motherboard", "cloud data center dark", "network wires fiber neon").

JSON Output:`;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    temperature: 0.4,
                    responseMimeType: 'application/json'
                }
            });

            const text = response.text || '';
            const parsed = JSON.parse(text);
            return {
                hook: (parsed.hook || defaultDesign.hook).toUpperCase(),
                badge: (parsed.badge || defaultDesign.badge).toUpperCase(),
                accentText: (parsed.accentText || defaultDesign.accentText).toUpperCase(),
                highlightText: (parsed.highlightText || defaultDesign.highlightText).toUpperCase(),
                themeColor: parsed.themeColor || defaultDesign.themeColor,
                iconType: ICONS[parsed.iconType] ? parsed.iconType : defaultDesign.iconType,
                pexelsQuery: parsed.pexelsQuery || defaultDesign.pexelsQuery
            };
        } catch (err) {
            console.error('⚠️ Gemini thumbnail analysis error, using fallback design:', err);
            return defaultDesign;
        }
    }

    /**
     * Fetch high-res backdrop image from Pexels API
     */
    private async fetchBackdrop(query: string): Promise<string> {
        const pexelsKey = process.env.PEXELS_API_KEY;
        const randomFallback = FALLBACK_BACKGROUNDS[Math.floor(Math.random() * FALLBACK_BACKGROUNDS.length)];

        if (!pexelsKey) {
            return randomFallback;
        }

        try {
            const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`;
            const res = await fetch(url, {
                headers: { Authorization: pexelsKey }
            });

            if (!res.ok) {
                console.error(`⚠️ Pexels returned ${res.status}, using curated fallback.`);
                return randomFallback;
            }

            const data = await res.json();
            if (data.photos && data.photos.length > 0) {
                // Pick the first photo with high resolution
                const photo = data.photos[0];
                return photo.src.large2x || photo.src.original || randomFallback;
            }
        } catch (e) {
            console.error('⚠️ Failed to fetch from Pexels:', e);
        }

        return randomFallback;
    }

    /**
     * Build the pixel-perfect HTML layout for 1280x720 16:9 canvas
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

        const iconSvg = ICONS[design.iconType] || ICONS.server;

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Anton&family=Montserrat:wght@800;900&display=swap');

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      width: 1280px;
      height: 720px;
      overflow: hidden;
      background: #06080E;
      font-family: 'Montserrat', sans-serif;
      position: relative;
    }

    /* Background image container */
    .bg-container {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image: url('${bgImageUrl}');
      background-size: cover;
      background-position: center right;
      filter: saturate(1.4) contrast(1.15) brightness(0.65);
    }

    /* Gradient overlay for perfect contrast on left text */
    .overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        90deg,
        rgba(5, 7, 12, 0.98) 0%,
        rgba(5, 7, 12, 0.92) 42%,
        rgba(5, 7, 12, 0.65) 65%,
        rgba(5, 7, 12, 0.25) 100%
      );
    }

    /* Subtle neon tech grid lines */
    .grid-lines {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
      background-size: 60px 60px;
      pointer-events: none;
    }

    /* Border Glow Frame */
    .frame-border {
      position: absolute;
      inset: 14px;
      border: 3px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      pointer-events: none;
    }

    .corner-accent {
      position: absolute;
      top: 14px;
      right: 14px;
      width: 44px;
      height: 44px;
      border-top: 4px solid ${design.themeColor};
      border-right: 4px solid ${design.themeColor};
    }

    /* Content Area */
    .content {
      position: relative;
      z-index: 10;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding-left: 70px;
      max-width: 820px;
    }

    /* Category Pill Badge */
    .badge-row {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 24px;
    }

    .pill-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: ${design.themeColor};
      color: #05070C;
      font-weight: 900;
      font-size: 20px;
      letter-spacing: 2px;
      text-transform: uppercase;
      padding: 8px 22px;
      border-radius: 8px;
      box-shadow: 0 0 25px ${design.themeColor}66;
    }

    .sub-pill {
      display: inline-flex;
      align-items: center;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #FFFFFF;
      font-weight: 800;
      font-size: 18px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      padding: 7px 18px;
      border-radius: 8px;
    }

    /* Big Bold Headline */
    .headline-container {
      margin-bottom: 26px;
    }

    .headline-line1 {
      font-family: 'Anton', 'Montserrat', sans-serif;
      font-size: 108px;
      line-height: 0.95;
      letter-spacing: 1px;
      color: #FFFFFF;
      text-transform: uppercase;
      text-shadow: 
        0 4px 20px rgba(0, 0, 0, 0.9),
        0 0 40px rgba(0, 0, 0, 0.8);
      filter: drop-shadow(0 8px 12px rgba(0, 0, 0, 0.9));
    }

    .headline-line2 {
      font-family: 'Anton', 'Montserrat', sans-serif;
      font-size: 104px;
      line-height: 0.95;
      letter-spacing: 1px;
      text-transform: uppercase;
      background: linear-gradient(180deg, #FFFFFF 20%, ${design.themeColor} 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 6px 20px ${design.themeColor}88);
    }

    /* Bottom Highlight Banner */
    .highlight-card {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      background: rgba(15, 20, 32, 0.85);
      border-left: 5px solid ${design.themeColor};
      border-radius: 0 10px 10px 0;
      padding: 12px 24px;
      backdrop-filter: blur(12px);
      width: fit-content;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }

    .highlight-text {
      color: #E2E8F0;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    /* Right visual illustration card */
    .right-graphic {
      position: absolute;
      right: 75px;
      top: 50%;
      transform: translateY(-50%);
      width: 380px;
      height: 380px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
    }

    .graphic-glow {
      position: absolute;
      width: 280px;
      height: 280px;
      background: ${design.themeColor}33;
      border-radius: 50%;
      filter: blur(60px);
    }

    .icon-container {
      position: relative;
      z-index: 2;
      width: 240px;
      height: 240px;
      background: rgba(10, 15, 26, 0.75);
      border: 2px solid ${design.themeColor}88;
      border-radius: 28px;
      box-shadow: 
        0 0 40px ${design.themeColor}44,
        inset 0 0 25px ${design.themeColor}22;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(16px);
    }

    .icon-container svg {
      width: 130px;
      height: 130px;
      fill: none;
      stroke: ${design.themeColor};
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      filter: drop-shadow(0 0 15px ${design.themeColor});
    }
  </style>
</head>
<body>
  <div class="bg-container"></div>
  <div class="overlay"></div>
  <div class="grid-lines"></div>
  <div class="frame-border"></div>
  <div class="corner-accent"></div>

  <div class="content">
    <div class="badge-row">
      <div class="pill-badge">⚡ ${design.badge}</div>
      <div class="sub-pill">${design.accentText}</div>
    </div>

    <div class="headline-container">
      <div class="headline-line1">${line1}</div>
      ${line2 ? `<div class="headline-line2">${line2}</div>` : ''}
    </div>

    <div class="highlight-card">
      <span style="font-size: 22px;">⚠️</span>
      <span class="highlight-text">${design.highlightText}</span>
    </div>
  </div>

  <div class="right-graphic">
    <div class="graphic-glow"></div>
    <div class="icon-container">
      ${iconSvg}
    </div>
  </div>
</body>
</html>`;
    }

    /**
     * Render the HTML page to a high-quality JPEG image via Puppeteer
     */
    private async renderToImage(videoId: string, html: string): Promise<string> {
        const tmpDir = process.env.WORK_DIR || path.join(process.cwd(), 'videos', '.tmp-thumbnails');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        const outputPath = path.join(tmpDir, `${videoId}-thumbnail.jpg`);

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
            await page.setContent(html, { waitUntil: 'networkidle0' });

            await page.screenshot({
                path: outputPath,
                type: 'jpeg',
                quality: 95
            });

            console.error(`✅ Rendered thumbnail image to: ${outputPath}`);
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
}

export default ThumbnailComposer;
