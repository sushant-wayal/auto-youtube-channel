/**
 * Worker Configuration
 * Loads environment variables and exports configuration objects
 */

import dotenv from 'dotenv';
import path from 'path';
import { CLIPS } from "../constants";

// Load environment variables from parent .env.local
dotenv.config({ path: path.join(__dirname, '../..', '.env.local') });

export const config = {
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
    gemini: {
        apiKey: process.env.GEMINI_API_KEY || '',
    },
    pexels: {
        apiKey: process.env.PEXELS_API_KEY || '',
    },
    worker: {
        pollInterval: 5000, // Poll Redis every 5 seconds
        jobTimeout: 1800000, // 30 min job timeout
        workDir: path.join(__dirname, CLIPS), // Directory for narration files
    },
};

// Validate required configuration
export function validateConfig(): void {
    const errors: string[] = [];

    if (!config.redis.url) {
        errors.push('REDIS_URL is required');
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
