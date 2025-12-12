/**
 * Worker Configuration
 * Loads environment variables and exports configuration objects
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from parent .env.local
dotenv.config({ path: path.join(__dirname, '../../..', '.env.local') });

export const config = {
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
        apiKey: process.env.CLOUDINARY_API_KEY || '',
        apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    },
    gemini: {
        apiKey: process.env.GEMINI_API_KEY || '',
    },
    pexels: {
        apiKey: process.env.PEXELS_API_KEY || '',
    },
    worker: {
        pollInterval: 5000, // Poll Redis every 5 seconds
        jobTimeout: 3600000, // 1 hr job timeout
        workDir: '/tmp/videos',
        tmpDir: '/tmp/clips',
        assetsDir: path.join(__dirname, 'assets'),
    },
};

// Validate required configuration
export function validateConfig(): void {
    const errors: string[] = [];

    if (!config.redis.url) {
        errors.push('REDIS_URL is required');
    }
    if (!config.cloudinary.apiKey) {
        errors.push('CLOUDINARY_API_KEY is required');
    }
    if (!config.cloudinary.apiSecret) {
        errors.push('CLOUDINARY_API_SECRET is required');
    }
    if (!config.gemini.apiKey) {
        errors.push('GEMINI_API_KEY is required');
    }
    if (!config.pexels.apiKey) {
        errors.push('PEXELS_API_KEY is required');
    }

    if (errors.length > 0) {
        console.error('❌ Configuration errors:');
        errors.forEach(err => console.error(`   - ${err}`));
        process.exit(1);
    }

    console.log('✅ Configuration validated successfully');
}

export default config;
