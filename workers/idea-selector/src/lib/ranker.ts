import { Idea, UploadRecord, SelectorOptions } from '../types';
import { extractSignals } from './signal-extractor';

function normalize(s: string): string {
    return s.trim().toLowerCase();
}

function defaultAngleEq(a: string, b: string): boolean {
    return normalize(a) === normalize(b);
}

/**
 * AI-assisted ranking (Not Generation)
 * Ranks ideas based on extracted historical signals
 * - No topic creation
 * - No angle rewriting
 * - No virality/trend/hype mentions
 * - Deterministic tie-breaking using lexical order
 */
export function rankIdeas(
    eligible: Idea[],
    history: UploadRecord[],
    options: SelectorOptions = {}
): Idea[] {
    const signals = extractSignals(history);

    // Compute scores based on historical signals
    const scores = eligible.map(i => {
        let score = 0;
        const t = normalize(i.topic);
        const st = `${t}||${normalize(i.subtopic)}`;

        // Positive signals
        if (signals.topicCtrAboveAvg.has(t)) score += 2;
        if (signals.subtopicHighRetention.has(st)) score += 2;
        if (signals.shortWorked.has(st)) score += 1;
        if (signals.longWorked.has(st)) score += 1;

        // Penalize similarity to recent uploads (last 3)
        const recent = history.slice(-3);
        for (const r of recent) {
            if (normalize(r.topic) === t) score -= 0.5;
            if (normalize(r.subtopic) === normalize(i.subtopic)) score -= 0.25;
            if (defaultAngleEq(r.angle, i.angle)) score -= 1.0;
        }

        return score;
    });

    // Produce ranking with deterministic tie-breaking
    const indexed = eligible.map((idea, idx) => ({ idea, score: scores[idx], idx }));
    indexed.sort((a, b) => {
        // Primary: by score descending
        if (b.score !== a.score) return b.score - a.score;

        // Tie-breaker: lexical order (topic, subtopic, angle)
        const ta = normalize(a.idea.topic), tb = normalize(b.idea.topic);
        if (ta !== tb) return ta < tb ? -1 : 1;

        const sa = normalize(a.idea.subtopic), sb = normalize(b.idea.subtopic);
        if (sa !== sb) return sa < sb ? -1 : 1;

        const aa = normalize(a.idea.angle), ab = normalize(b.idea.angle);
        if (aa !== ab) return aa < ab ? -1 : 1;

        return a.idx - b.idx;
    });

    return indexed.map(x => x.idea);
}

/**
 * Calculate similarity score between idea and last N uploads
 * Used for tie-breaking
 */
export function similarityToLastN(idea: Idea, lastN: UploadRecord[]): number {
    let sim = 0;
    for (const l of lastN) {
        if (normalize(l.topic) === normalize(idea.topic)) sim += 1;
        if (normalize(l.subtopic) === normalize(idea.subtopic)) sim += 1;
        if (defaultAngleEq(l.angle, idea.angle)) sim += 2; // angle match stronger
    }
    return sim;
}
