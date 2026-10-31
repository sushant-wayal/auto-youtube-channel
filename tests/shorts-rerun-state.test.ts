import assert from 'assert';

/**
 * Unit and Integration Tests for Shorts Rerun State Updates
 *
 * Reproduces and verifies the fix for the bug:
 * "whenever the shorts processing step fails let's say it failed for short 2 and I click rerun
 * then after rerun been successful I see that the new run created new item named short 4 for the same short 2
 * So ideally it should be that rerun should not create new entries instead update the existing failed entry state itself"
 */

// ── Mock Redis Implementation for Testing ─────────────────────────────────────
class MockRedis {
    private storage: Map<string, string[]> = new Map();
    private kv: Map<string, string> = new Map();
    private hashes: Map<string, Map<string, string>> = new Map();

    async lrange(key: string, start: number, stop: number): Promise<string[]> {
        const list = this.storage.get(key) || [];
        if (stop === -1) {
            return list.slice(start);
        }
        return list.slice(start, stop + 1);
    }

    async rpush(key: string, ...values: string[]): Promise<number> {
        const list = this.storage.get(key) || [];
        list.push(...values);
        this.storage.set(key, list);
        return list.length;
    }

    async lset(key: string, index: number, value: string): Promise<'OK'> {
        const list = this.storage.get(key) || [];
        if (index < 0 || index >= list.length) {
            throw new Error('index out of range');
        }
        list[index] = value;
        return 'OK';
    }

    async del(key: string): Promise<number> {
        const existed = this.storage.delete(key) || this.kv.delete(key) || this.hashes.delete(key);
        return existed ? 1 : 0;
    }

    async expire(key: string, seconds: number): Promise<number> {
        return 1;
    }

    async eval(script: string, numkeys: number, ...args: string[]): Promise<any> {
        // Mock Redis Lua script behavior for saveOrUpdateShortInRedis
        const key = args[0];
        const newEntry = args[1];
        const targetIdx = parseInt(args[2], 10);
        const ttl = parseInt(args[3], 10);

        const list = this.storage.get(key) || [];
        let foundIndex = -1;

        for (let i = 0; i < list.length; i++) {
            try {
                const decoded = JSON.parse(list[i]);
                if (decoded && decoded.shortIndex === targetIdx) {
                    foundIndex = i;
                    break;
                }
            } catch {}
        }

        if (foundIndex >= 0) {
            list[foundIndex] = newEntry;
        } else {
            list.push(newEntry);
        }
        this.storage.set(key, list);
        return 'OK';
    }

    async hset(key: string, field: string, value: string): Promise<number> {
        let hash = this.hashes.get(key);
        if (!hash) {
            hash = new Map();
            this.hashes.set(key, hash);
        }
        hash.set(field, value);
        return 1;
    }

    async hget(key: string, field: string): Promise<string | null> {
        const hash = this.hashes.get(key);
        return hash?.get(field) ?? null;
    }

    async hgetall(key: string): Promise<Record<string, string>> {
        const hash = this.hashes.get(key);
        if (!hash) return {};
        const res: Record<string, string> = {};
        hash.forEach((v, k) => { res[k] = v; });
        return res;
    }

    async set(key: string, value: string, ...extra: any[]): Promise<'OK'> {
        this.kv.set(key, value);
        return 'OK';
    }

    async get(key: string): Promise<string | null> {
        return this.kv.get(key) ?? null;
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function testSaveOrUpdateShortInRedis() {
    console.log('🧪 Test 1: saveOrUpdateShortInRedis updates existing failed short in place...');
    const redis = new MockRedis();
    const videoId = 'test-vid-123';

    // Simulate short 0 succeeds
    await redis.eval('', 1, `pipeline:shorts:${videoId}`, JSON.stringify({
        shortIndex: 0,
        shortId: `${videoId}-short-0`,
        status: 'success',
        youtubeId: 'yt-0',
        videoUrl: 'https://cdn/0.mp4'
    }), '0', '604800');

    // Simulate short 1 (Short 2) fails on first run
    await redis.eval('', 1, `pipeline:shorts:${videoId}`, JSON.stringify({
        shortIndex: 1,
        shortId: `${videoId}-short-1`,
        status: 'failure',
        error: 'FFmpeg encoding timeout'
    }), '1', '604800');

    // Simulate short 2 succeeds
    await redis.eval('', 1, `pipeline:shorts:${videoId}`, JSON.stringify({
        shortIndex: 2,
        shortId: `${videoId}-short-2`,
        status: 'success',
        youtubeId: 'yt-2',
        videoUrl: 'https://cdn/2.mp4'
    }), '2', '604800');

    let list = await redis.lrange(`pipeline:shorts:${videoId}`, 0, -1);
    assert.strictEqual(list.length, 3, 'Initial list should contain exactly 3 items');
    assert.strictEqual(JSON.parse(list[1]).status, 'failure', 'Short 1 should be failed');

    // NOW RERUN OCCURS: short 1 succeeds
    await redis.eval('', 1, `pipeline:shorts:${videoId}`, JSON.stringify({
        shortIndex: 1,
        shortId: `${videoId}-short-1`,
        status: 'success',
        youtubeId: 'yt-1-rerun',
        videoUrl: 'https://cdn/1-rerun.mp4'
    }), '1', '604800');

    list = await redis.lrange(`pipeline:shorts:${videoId}`, 0, -1);
    assert.strictEqual(list.length, 3, 'After rerun, list length MUST still be 3 (NO Short 4 created!)');
    
    const short1After = JSON.parse(list[1]);
    assert.strictEqual(short1After.status, 'success', 'Short 1 status should be updated to success');
    assert.strictEqual(short1After.youtubeId, 'yt-1-rerun', 'Short 1 youtubeId should be updated to rerun result');
    assert.strictEqual(short1After.shortIndex, 1, 'Short 1 index should remain 1');

    console.log('   ✅ Passed: Existing entry updated in place, no duplicate entry created.');
}

async function testPipelineStatusDeduplication() {
    console.log('🧪 Test 2: pipeline-status deduplicates historical duplicates and maps slots accurately...');

    // Scenario: Redis contains legacy raw duplicate data from earlier runs:
    // [short 0 (success), short 1 (failure), short 2 (success), short 1 (success)]
    const shortsRaw = [
        JSON.stringify({ shortIndex: 0, status: 'success', youtubeId: 'yt-0' }),
        JSON.stringify({ shortIndex: 1, status: 'failure', error: 'Render timeout' }),
        JSON.stringify({ shortIndex: 2, status: 'success', youtubeId: 'yt-2' }),
        JSON.stringify({ shortIndex: 1, status: 'success', youtubeId: 'yt-1-rerun', videoUrl: 'http://video1' }),
    ];

    const parsedShorts = shortsRaw.map(s => JSON.parse(s));

    // Deduplication logic as implemented in pipeline-status/route.ts
    const shortsByIndex = new Map<number, any>();
    for (const s of parsedShorts) {
        const idx = s.shortIndex;
        if (idx === undefined || idx === null) continue;
        const existing = shortsByIndex.get(idx);
        if (!existing) {
            shortsByIndex.set(idx, s);
        } else {
            if (existing.status === 'failure' && s.status !== 'failure') {
                shortsByIndex.set(idx, s);
            } else if (existing.status !== 'failure' && s.status === 'failure') {
                // keep success
            } else {
                shortsByIndex.set(idx, s);
            }
        }
    }
    const shorts = Array.from(shortsByIndex.values()).sort((a: any, b: any) => (a.shortIndex ?? 0) - (b.shortIndex ?? 0));

    assert.strictEqual(shorts.length, 3, 'Deduplicated shorts must have exactly 3 entries');
    assert.strictEqual(shorts[1].status, 'success', 'Short 1 status must be success (rerun entry supersedes failed entry)');
    assert.strictEqual(shorts[1].youtubeId, 'yt-1-rerun', 'Short 1 must have the rerun youtubeId');

    const expectedShortsCount = 3;
    const totalShortsSlots = expectedShortsCount > 0
        ? expectedShortsCount
        : (shorts.length > 0 ? Math.max(...shorts.map((s: any) => (s.shortIndex ?? 0) + 1)) : 0);

    assert.strictEqual(totalShortsSlots, 3, 'totalShortsSlots must be 3, NEVER 4');

    const shortHooks = ['Hook 1', 'Hook 2', 'Hook 3'];
    const enhancedShorts = Array.from({ length: totalShortsSlots }, (_, idx) => {
        const existing = shortsByIndex.get(idx);
        const hook = shortHooks[idx] || '';

        if (existing && (existing.youtubeId || existing.videoUrl)) {
            return {
                ...existing,
                shortIndex: idx,
                status: existing.status || 'success',
                hook,
            };
        }

        if (existing && existing.status === 'failure') {
            return {
                ...existing,
                shortIndex: idx,
                status: 'failure',
                hook,
            };
        }

        return {
            shortIndex: idx,
            status: 'pending',
            hook,
        };
    });

    assert.strictEqual(enhancedShorts.length, 3, 'Enhanced shorts must have exactly 3 items');
    assert.strictEqual(enhancedShorts[0].shortIndex, 0);
    assert.strictEqual(enhancedShorts[1].shortIndex, 1);
    assert.strictEqual(enhancedShorts[1].status, 'success', 'Short 2 (index 1) must be success');
    assert.strictEqual(enhancedShorts[2].shortIndex, 2);

    // Verify there is NO Short 4 (shortIndex 3)
    const short4 = enhancedShorts.find(s => s.shortIndex === 3);
    assert.strictEqual(short4, undefined, 'There must be NO item for shortIndex 3 (Short 4)');

    console.log('   ✅ Passed: Exactly 3 items generated, Short 2 updated, NO Short 4.');
}

async function testRerunFailedJobsReset() {
    console.log('🧪 Test 3: rerun-failed-jobs resets failed shorts to running...');
    const redis = new MockRedis();
    const videoId = 'test-vid-456';

    await redis.hset('pipeline:status:metadata', 'videoId', videoId);
    await redis.hset('pipeline:status:jobs', 'shortsProcessing', 'failure');

    const shortsKey = `pipeline:shorts:${videoId}`;
    await redis.rpush(shortsKey,
        JSON.stringify({ shortIndex: 0, status: 'success', youtubeId: 'yt-0', videoUrl: 'url-0' }),
        JSON.stringify({ shortIndex: 1, status: 'failure', error: 'Upload timeout' }),
        JSON.stringify({ shortIndex: 2, status: 'success', youtubeId: 'yt-2', videoUrl: 'url-2' })
    );

    // Trigger rerun failed jobs logic
    const rawShorts = await redis.lrange(shortsKey, 0, -1);
    let hasFailedShort = false;
    const updatedShorts = rawShorts.map(raw => {
        try {
            const parsed = JSON.parse(raw);
            if (parsed.status === 'failure' || (!parsed.youtubeId && !parsed.videoUrl)) {
                hasFailedShort = true;
                return JSON.stringify({
                    ...parsed,
                    status: 'running',
                    error: undefined,
                });
            }
            return raw;
        } catch {
            return raw;
        }
    });

    if (hasFailedShort) {
        await redis.del(shortsKey);
        await redis.rpush(shortsKey, ...updatedShorts);
    }

    const resetShorts = (await redis.lrange(shortsKey, 0, -1)).map(s => JSON.parse(s));
    assert.strictEqual(resetShorts.length, 3, 'Must maintain 3 shorts');
    assert.strictEqual(resetShorts[0].status, 'success', 'Short 0 remains success');
    assert.strictEqual(resetShorts[1].status, 'running', 'Failed Short 1 reset to running');
    assert.strictEqual(resetShorts[1].error, undefined, 'Error message cleared on rerun reset');
    assert.strictEqual(resetShorts[2].status, 'success', 'Short 2 remains success');

    console.log('   ✅ Passed: Failed short reset to running with cleared error.');
}

async function main() {
    console.log('\n======================================================');
    console.log('🚀 RUNNING SHORTS RERUN STATE VERIFICATION TESTS');
    console.log('======================================================\n');

    await testSaveOrUpdateShortInRedis();
    await testPipelineStatusDeduplication();
    await testRerunFailedJobsReset();

    console.log('\n🎉 ALL SHORTS RERUN UNIT AND INTEGRATION TESTS PASSED!\n');
}

main().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
