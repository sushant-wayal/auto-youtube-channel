/**
 * Shared Configuration
 * Centralized configuration for all workers and services
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root .env.local
dotenv.config({ path: path.join(__dirname, '../..', '.env.local') });

export const config = {
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
        apiKey: process.env.CLOUDINARY_API_KEY || '',
        apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    },
    gemini: {
        apiKey1: process.env.GEMINI_API_KEY_1 || '',
        apiKey2: process.env.GEMINI_API_KEY_2 || '',
        // Fallback for single key setup
        apiKey: process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1 || '',
    },
    voiceover: {
        provider: (process.env.VOICEOVER_PROVIDER || 'gemini').toLowerCase(),
        f5: {
            referenceAudioPath: process.env.F5_REFERENCE_AUDIO_PATH || '',
            referenceText: process.env.F5_REFERENCE_TEXT || '',
            pythonBin: process.env.F5_PYTHON_BIN || process.env.PYTHON_BIN || '',
        },
    },
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
    youtube: {
        clientId: process.env.YT_CLIENT_ID || '',
        clientSecret: process.env.YT_CLIENT_SECRET || '',
        refreshToken: process.env.YT_REFRESH_TOKEN || '',
    },
    website: {
        domain: process.env.WEBSITE_DOMAIN || 'http://localhost:3000',
    },
    video: {
        long: {
            width: 1920,
            height: 1080,
            fps: 30,
        },
        short: {
            width: 1080,
            height: 1920,
            fps: 30,
        },
    },
    thumbnail: {
        enabled: process.env.ENABLE_THUMBNAIL_GENERATION === 'true',
    },
    workDir: process.env.WORK_DIR || path.join(process.cwd(), 'videos'),
};

// Validate required configuration
export function validateConfig(required: string[] = []): void {
    const errors: string[] = [];

    // Common validations
    if (required.includes('cloudinary')) {
        if (!config.cloudinary.cloudName) errors.push('CLOUDINARY_CLOUD_NAME is required');
        if (!config.cloudinary.apiKey) errors.push('CLOUDINARY_API_KEY is required');
        if (!config.cloudinary.apiSecret) errors.push('CLOUDINARY_API_SECRET is required');
    }

    if (required.includes('gemini')) {
        // Check for key rotation setup (preferred) or fallback to single key
        if (!config.gemini.apiKey1 && !config.gemini.apiKey) {
            errors.push('GEMINI_API_KEY_1 or GEMINI_API_KEY is required');
        }
        if (config.gemini.apiKey1 && !config.gemini.apiKey2) {
            console.warn('⚠️ GEMINI_API_KEY_2 not set - key rotation disabled');
        }
    }

    if (required.includes('voiceover')) {
        const provider = config.voiceover.provider;
        if (provider !== 'gemini' && provider !== 'f5') {
            errors.push('VOICEOVER_PROVIDER must be either "gemini" or "f5"');
        }

        if (provider === 'gemini') {
            if (!config.gemini.apiKey1 && !config.gemini.apiKey) {
                errors.push('GEMINI_API_KEY_1 or GEMINI_API_KEY is required for Gemini voiceover');
            }
        }

        if (provider === 'f5') {
            if (!config.gemini.apiKey1 && !config.gemini.apiKey) {
                console.warn('⚠️ GEMINI_API_KEY_1 or GEMINI_API_KEY not set - Gemini fallback disabled');
            }
        }
    }

    if (required.includes('redis')) {
        if (!config.redis.url) errors.push('REDIS_URL is required');
    }

    if (required.includes('youtube')) {
        if (!config.youtube.clientId) errors.push('YT_CLIENT_ID is required');
        if (!config.youtube.clientSecret) errors.push('YT_CLIENT_SECRET is required');
        if (!config.youtube.refreshToken) errors.push('YT_REFRESH_TOKEN is required');
    }

    if (required.includes('website')) {
        if (!config.website.domain) errors.push('WEBSITE_DOMAIN is required');
    }

    if (errors.length > 0) {
        console.error('❌ Configuration errors:');
        errors.forEach(err => console.error(`   - ${err}`));
        process.exit(1);
    }

    console.error('✅ Configuration validated successfully');
}

export default config;
