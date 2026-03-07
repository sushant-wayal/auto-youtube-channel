#!/usr/bin/env node

/**
 * Initialize Schedule Times in Redis
 * 
 * This script sets the default schedule times for shorts and long-form videos in Redis.
 * Run this script to initialize or reset schedule times to their default values.
 * 
 * Usage: node initialize-schedule-times.js
 */

const Redis = require('ioredis');

// Default schedule times
const DEFAULT_SHORTS_TIMES = [
    '06:45', // Rank 1 (Best) - 6:45 AM IST
    '07:45', // Rank 2 - 7:45 AM IST
    '08:45', // Rank 3 - 8:45 AM IST
    '12:00', // Rank 4 - 12:00 PM IST
    '14:00', // Rank 5 (Worst) - 2:00 PM IST
];

const DEFAULT_LONG_FORM_TIME = '18:30'; // 6:30 PM IST

// Redis keys
const SHORTS_TIMES_KEY = 'shorts:publish-times';
const LONG_FORM_TIME_KEY = 'longform:publish-time';
const LEGACY_SHORTS_KEY = 'shorts:publish-time'; // Legacy compatibility

async function initializeScheduleTimes() {
    // Check for REDIS_URL
    if (!process.env.REDIS_URL) {
        console.error('❌ Error: REDIS_URL environment variable is not set');
        console.error('   Please set REDIS_URL before running this script');
        console.error('   Example: export REDIS_URL="redis://localhost:6379"');
        process.exit(1);
    }

    console.log('🔗 Connecting to Redis...');
    const redis = new Redis(process.env.REDIS_URL);

    try {
        // Test connection
        await redis.ping();
        console.log('✅ Connected to Redis\n');

        // Set shorts times (ranked array)
        console.log('📱 Setting shorts schedule times (ranked):');
        await redis.set(SHORTS_TIMES_KEY, JSON.stringify(DEFAULT_SHORTS_TIMES));
        DEFAULT_SHORTS_TIMES.forEach((time, index) => {
            const rankLabels = ['Best', '2nd', '3rd', '4th', 'Worst'];
            console.log(`   Rank ${index + 1} (${rankLabels[index]}): ${time} IST`);
        });

        // Set long-form time
        console.log('\n🎬 Setting long-form video schedule time:');
        await redis.set(LONG_FORM_TIME_KEY, DEFAULT_LONG_FORM_TIME);
        console.log(`   ${DEFAULT_LONG_FORM_TIME} IST`);

        // Set legacy key for backwards compatibility
        console.log('\n🔄 Setting legacy key (backwards compatibility):');
        await redis.set(LEGACY_SHORTS_KEY, DEFAULT_SHORTS_TIMES[0]);
        console.log(`   ${LEGACY_SHORTS_KEY} = ${DEFAULT_SHORTS_TIMES[0]} IST`);

        // Verify by reading back
        console.log('\n✅ Verifying values in Redis...');
        const shortsTimesStored = await redis.get(SHORTS_TIMES_KEY);
        const longFormTimeStored = await redis.get(LONG_FORM_TIME_KEY);
        const legacyTimeStored = await redis.get(LEGACY_SHORTS_KEY);

        console.log('   Shorts times:', JSON.parse(shortsTimesStored));
        console.log('   Long-form time:', longFormTimeStored);
        console.log('   Legacy time:', legacyTimeStored);

        console.log('\n🎉 Schedule times initialized successfully!');
        console.log('\nYou can now:');
        console.log('  - View/edit times on the website dashboard (/dashboard)');
        console.log('  - View/edit times on the mobile app (Publish Schedule tab)');
        console.log('  - Use API: GET/POST /api/schedule-times');

    } catch (error) {
        console.error('❌ Error initializing schedule times:', error.message);
        process.exit(1);
    } finally {
        await redis.quit();
    }
}

// Run the script
initializeScheduleTimes().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
