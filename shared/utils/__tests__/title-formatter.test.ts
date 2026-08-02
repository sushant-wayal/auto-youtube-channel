import { formatYouTubeTitle, YOUTUBE_MAX_TITLE_LENGTH } from '../title-formatter';

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ Assertion failed: ${message}`);
        throw new Error(message);
    }
}

function runTests() {
    console.log('🧪 Running YouTube Title Formatter Tests...\n');

    // Test 1: Standard title under 100 chars
    const t1 = "Understanding Distributed Caching Systems";
    const res1 = formatYouTubeTitle(t1);
    assert(res1 === t1, `Test 1 failed: expected "${t1}", got "${res1}"`);
    assert(res1.length <= 100, 'Test 1 length failed');
    console.log('✅ Test 1: Short title preserved');

    // Test 2: Exactly 100 chars
    const t2 = "A".repeat(100);
    const res2 = formatYouTubeTitle(t2);
    assert(res2 === t2, 'Test 2 failed: 100 char string should not be truncated');
    assert(res2.length === 100, `Test 2 length failed: expected 100, got ${res2.length}`);
    console.log('✅ Test 2: Exactly 100 characters preserved');

    // Test 3: Title with 120 characters, clean word break
    const t3 = "Building Scalable Microservices with Node.js and TypeScript: A Complete Step-by-Step Architectural Guide for Beginners";
    const res3 = formatYouTubeTitle(t3);
    assert(res3.length <= 100, `Test 3 length failed: length is ${res3.length} > 100`);
    assert(res3.endsWith('...'), `Test 3 failed: expected ellipsis ending, got "${res3}"`);
    assert(!res3.includes('  '), 'Test 3 failed: should have no double spaces');
    console.log(`✅ Test 3: Long title cleanly truncated to ${res3.length} chars: "${res3}"`);

    // Test 4: Single long continuous word (150 chars)
    const t4 = "Super" + "califragilisticexpialidocious".repeat(6);
    const res4 = formatYouTubeTitle(t4);
    assert(res4.length <= 100, `Test 4 length failed: length is ${res4.length} > 100`);
    assert(res4.endsWith('...'), 'Test 4 failed: should end with ellipsis');
    console.log(`✅ Test 4: Continuous word truncated to ${res4.length} chars: "${res4}"`);

    // Test 5: Excessive whitespace and newlines
    const t5 = "  Understanding   \n\n\t  Distributed   Locking \n in Redis   ";
    const res5 = formatYouTubeTitle(t5);
    assert(res5 === "Understanding Distributed Locking in Redis", `Test 5 failed: got "${res5}"`);
    console.log(`✅ Test 5: Whitespace normalized: "${res5}"`);

    // Test 6: Null / Undefined / Empty
    assert(formatYouTubeTitle(null) === 'Untitled Video', 'Test 6a failed');
    assert(formatYouTubeTitle(undefined) === 'Untitled Video', 'Test 6b failed');
    assert(formatYouTubeTitle('') === 'Untitled Video', 'Test 6c failed');
    assert(formatYouTubeTitle('   \n\t  ') === 'Untitled Video', 'Test 6d failed');
    console.log('✅ Test 6: Empty/null/undefined handled safely');

    // Test 7: Custom length (e.g. 50 chars)
    const t7 = "Why Database Indexes Can Slow Down Your Write Queries Significantly";
    const res7 = formatYouTubeTitle(t7, 50);
    assert(res7.length <= 50, `Test 7 length failed: length is ${res7.length} > 50`);
    console.log(`✅ Test 7: Custom maxLength (50) enforced: "${res7}" (${res7.length} chars)`);

    console.log('\n🎉 ALL 7 TESTS PASSED SUCCESSFULLY!\n');
}

runTests();
