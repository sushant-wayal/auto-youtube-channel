/**
 * GitHub Actions Script: Generate Live Stream Script
 * Called by: live-generate-script job in live-stream.yml
 *
 * Outputs (to $GITHUB_OUTPUT):
 *   video_id    — unique live-{timestamp} identifier
 *   scene_count — number of scenes in the script
 *   script_data — compact JSON string (same format as daily pipeline)
 */

import { validateConfig } from '../../shared/config';

async function generateLiveScript(idea: string, durationMinutes: number): Promise<{ videoId: string; script: any }> {
    validateConfig(['website']);

    const websiteDomain = process.env.WEBSITE_DOMAIN || 'http://localhost:3000';
    const sceneRenderMethod = 'ai'; // Live stream always uses AI render

    console.error(`💡 Generating live stream script for: "${idea}" (${durationMinutes} min)`);

    const response = await fetch(`${websiteDomain}/api/generate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoIdea: idea, sceneRenderMethod, durationMinutes }),
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Script generation API failed (${response.status}): ${body || response.statusText}`);
    }

    const data = await response.json() as { script?: any; error?: string };
    if (!data.script) {
        throw new Error(data.error || 'API returned no script');
    }

    const videoId = `live-${Date.now()}`;
    console.error(`✅ Script generated: "${data.script.title}" with ${data.script.scenes.length} scenes`);
    console.error(`📋 Video ID: ${videoId}`);

    return { videoId, script: data.script };
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
    try {
        const idea = process.argv[2];
        const duration = parseInt(process.argv[3] || '3', 10);

        if (!idea) {
            throw new Error('Missing required argument: video idea');
        }

        const result = await generateLiveScript(idea, duration);
        const compact = JSON.stringify(result);

        // Write to $GITHUB_OUTPUT — same pattern as daily pipeline
        const output = process.env.GITHUB_OUTPUT;
        const write = (line: string) => {
            if (output) {
                require('fs').appendFileSync(output, line + '\n');
            } else {
                // Local testing — just print
                console.log(line);
            }
        };

        write(`video_id=${result.videoId}`);
        write(`scene_count=${result.script.scenes.length}`);

        // Multiline output using heredoc delimiter (same as daily pipeline)
        write(`script_data<<SCRIPT_DATA_EOF`);
        write(compact);
        write(`SCRIPT_DATA_EOF`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Live script generation failed:', error);
        process.exit(1);
    }
})();
