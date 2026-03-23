import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

const SHORTS_TIMES_KEY = 'shorts:publish-times';
const LONG_FORM_TIME_KEY = 'longform:publish-time';

const DEFAULT_SHORTS_TIMES = [
    '16:30', // Rank 1 (Best)
    '18:00', // Rank 2
    '20:00', // Rank 3
    '12:00', // Rank 4
    '14:00', // Rank 5 (Worst)
];

const DEFAULT_LONG_FORM_TIME = '18:30';

// GitHub API configuration for updating Instagram workflow schedules
const GITHUB_TOKEN = process.env.GITHUB_PAT; // Personal Access Token with repo write access
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'sushant';
const GITHUB_REPO = process.env.GITHUB_REPO || 'video-genration-on-worker';
const WORKFLOW_PATH = '.github/workflows/instagram-upload.yml';

/**
 * Convert IST time (HH:MM) to UTC cron expression
 * IST is UTC+5:30
 */
function istToCronUTC(istTime: string): string {
    const [hours, minutes] = istTime.split(':').map(Number);

    // Convert IST to UTC (subtract 5 hours 30 minutes)
    let utcHours = hours - 5;
    let utcMinutes = minutes - 30;

    if (utcMinutes < 0) {
        utcMinutes += 60;
        utcHours -= 1;
    }

    if (utcHours < 0) {
        utcHours += 24;
    }

    return `${utcMinutes} ${utcHours} * * *`;
}

/**
 * Generate updated workflow YAML content with new cron schedules
 */
function generateWorkflowContent(shortsTimes: string[]): string {
    const cronExpressions = shortsTimes.map((time, idx) => {
        const cron = istToCronUTC(time);
        return `    # SHORT_${idx}: ${time} IST = ${cron.split(' ').slice(0, 2).reverse().join(':')} UTC\n    - cron: '${cron}'`;
    });

    return `name: Instagram Reel Upload

# 5 scheduled times for 5 shorts (IST converted to UTC)
# These cron schedules are updated dynamically via GitHub API when user changes times
on:
  schedule:
${cronExpressions.join('\n')}
  workflow_dispatch:
    inputs:
      short_index:
        description: 'Short index to upload (0-4). Leave empty to auto-detect from current time.'
        required: false
        type: string

jobs:
  upload-reel:
    name: Upload Instagram Reel
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install ioredis node-fetch@2

      - name: Upload to Instagram
        run: node .github/scripts/upload-instagram-reel.js
        env:
          REDIS_URL: \${{ secrets.REDIS_URL }}
          SHORT_INDEX_INPUT: \${{ inputs.short_index }}
          INSTAGRAM_ACCESS_TOKEN: \${{ secrets.INSTAGRAM_ACCESS_TOKEN }}
          INSTAGRAM_PAGE_ID: \${{ secrets.INSTAGRAM_PAGE_ID }}
`;
}

/**
 * Update the Instagram workflow file via GitHub API
 */
async function updateGitHubWorkflow(shortsTimes: string[]): Promise<{ success: boolean; error?: string }> {
    if (!GITHUB_TOKEN) {
        console.log('[schedule-times] GITHUB_PAT not configured, skipping workflow update');
        return { success: false, error: 'GITHUB_PAT not configured' };
    }

    try {
        // Step 1: Get current file SHA (required for update)
        const getResponse = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${WORKFLOW_PATH}`,
            {
                headers: {
                    Authorization: `Bearer ${GITHUB_TOKEN}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            }
        );

        if (!getResponse.ok) {
            const errorText = await getResponse.text();
            throw new Error(`Failed to get workflow file: ${getResponse.status} - ${errorText}`);
        }

        const fileData = await getResponse.json();
        const currentSha = fileData.sha;

        // Step 2: Generate new content
        const newContent = generateWorkflowContent(shortsTimes);
        const encodedContent = Buffer.from(newContent).toString('base64');

        // Step 3: Update file via GitHub API
        const updateResponse = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${WORKFLOW_PATH}`,
            {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${GITHUB_TOKEN}`,
                    Accept: 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: `chore: update Instagram upload schedule times\n\nNew times (IST): ${shortsTimes.join(', ')}`,
                    content: encodedContent,
                    sha: currentSha,
                    branch: 'main',
                }),
            }
        );

        if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            throw new Error(`Failed to update workflow file: ${updateResponse.status} - ${errorText}`);
        }

        console.log('[schedule-times] GitHub workflow updated successfully');
        return { success: true };
    } catch (error: any) {
        console.error('[schedule-times] GitHub workflow update failed:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * GET /api/schedule-times
 * Returns both shorts and long-form schedule times
 */
export async function GET() {
    try {
        const shortsTimesJson = await redis.get(SHORTS_TIMES_KEY);
        const longFormTime = await redis.get(LONG_FORM_TIME_KEY);

        const shortsTimes = shortsTimesJson
            ? JSON.parse(shortsTimesJson)
            : DEFAULT_SHORTS_TIMES;

        return NextResponse.json({
            ok: true,
            shortsTimes,
            longFormTime: longFormTime || DEFAULT_LONG_FORM_TIME,
        });
    } catch (error: any) {
        return NextResponse.json({
            ok: false,
            error: error.message,
        }, { status: 500 });
    }
}

/**
 * POST /api/schedule-times
 * Updates shorts times (array of 5) or long-form time (string)
 * Body: { shortsTimes?: string[], longFormTime?: string }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { shortsTimes, longFormTime } = body;

        // Validate time format (HH:MM)
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

        // Update shorts times if provided
        if (shortsTimes) {
            if (!Array.isArray(shortsTimes) || shortsTimes.length !== 5) {
                return NextResponse.json({
                    ok: false,
                    error: 'shortsTimes must be an array of exactly 5 times',
                }, { status: 400 });
            }

            // Validate each time
            for (const time of shortsTimes) {
                if (!timeRegex.test(time)) {
                    return NextResponse.json({
                        ok: false,
                        error: `Invalid time format: ${time}. Use HH:MM (24-hour format)`,
                    }, { status: 400 });
                }
            }

            await redis.set(SHORTS_TIMES_KEY, JSON.stringify(shortsTimes));

            // Update GitHub workflow cron schedules to match new times
            const workflowUpdateResult = await updateGitHubWorkflow(shortsTimes);
            if (!workflowUpdateResult.success) {
                console.warn('[schedule-times] Instagram workflow update skipped:', workflowUpdateResult.error);
            }
        }

        // Update long-form time if provided
        if (longFormTime) {
            if (!timeRegex.test(longFormTime)) {
                return NextResponse.json({
                    ok: false,
                    error: 'Invalid time format for longFormTime. Use HH:MM (24-hour format)',
                }, { status: 400 });
            }

            await redis.set(LONG_FORM_TIME_KEY, longFormTime);
        }

        // Return updated values
        const shortsTimesJson = await redis.get(SHORTS_TIMES_KEY);
        const updatedLongFormTime = await redis.get(LONG_FORM_TIME_KEY);

        return NextResponse.json({
            ok: true,
            shortsTimes: shortsTimesJson ? JSON.parse(shortsTimesJson) : DEFAULT_SHORTS_TIMES,
            longFormTime: updatedLongFormTime || DEFAULT_LONG_FORM_TIME,
        });
    } catch (error: any) {
        return NextResponse.json({
            ok: false,
            error: error.message,
        }, { status: 500 });
    }
}
