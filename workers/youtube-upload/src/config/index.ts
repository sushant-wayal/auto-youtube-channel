/**
 * Worker Configuration
 * Loads environment variables and exports configuration objects
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from parent .env.local
dotenv.config({ path: path.join(__dirname, '../..', '.env.local') });

export const config = {
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
    youtube: {
        clientId: process.env.YT_CLIENT_ID || '',
        clientSecret: process.env.YT_CLIENT_SECRET || '',
        refreshToken: process.env.YT_REFRESH_TOKEN || '',
    },
    worker: {
        pollInterval: 5000, // Poll Redis every 5 seconds
        jobTimeout: 1800000, // 30 min job timeout
    },
};

// Validate required configuration
export function validateConfig(): void {
    const errors: string[] = [];

    if (!config.redis.url) {
        errors.push('REDIS_URL is required');
    }
    if (!config.youtube.clientId) {
        errors.push('YT_CLIENT_ID is required');
    }
    if (!config.youtube.clientSecret) {
        errors.push('YT_CLIENT_SECRET is required');
    }
    if (!config.youtube.refreshToken) {
        errors.push('YT_REFRESH_TOKEN is required');
    }

    if (errors.length > 0) {
        console.error('❌ Configuration errors:');
        errors.forEach(err => console.error(`   - ${err}`));
        process.exit(1);
    }

    console.log('✅ Configuration validated successfully');
}

export default config;
