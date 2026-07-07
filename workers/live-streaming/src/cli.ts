#!/usr/bin/env npx tsx

import { LivePipeline } from "./live-pipeline";
import { validateConfig } from "../../../shared/config";

async function main() {
    const args = process.argv.slice(2);
    const params: Record<string, string> = {};

    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--')) {
            const key = args[i].substring(2);
            const next = args[i + 1];
            if (next && !next.startsWith('--')) {
                params[key] = next;
                i++;
            } else {
                params[key] = 'true';
            }
        }
    }

    const idea = params['idea'];
    const durationStr = params['duration'] || '3'; // default 3 mins

    if (!idea) {
        console.error('❌ Missing required parameter:');
        console.error('  --idea                  (The video idea)');
        console.error('  --duration              (optional; default: 3)');
        console.error('');
        console.error('Example:');
        console.error('  npx tsx workers/live-streaming/src/cli.ts --idea "Explain Redis" --duration 3');
        process.exit(1);
    }

    try {
        validateConfig(['cloudinary', 'youtube']);
        const durationMinutes = parseInt(durationStr, 10) || 3;

        const pipeline = new LivePipeline();
        await pipeline.execute(idea, durationMinutes);

        process.exit(0);
    } catch (error) {
        console.error('❌ Fatal Error:', error);
        process.exit(1);
    }
}

main();
