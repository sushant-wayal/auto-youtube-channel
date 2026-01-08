import { Idea, UploadRecord, SelectorOptions } from '../types';

function normalize(s: string): string {
    return s.trim().toLowerCase();
}

function defaultAngleEq(a: string, b: string): boolean {
    return normalize(a) === normalize(b);
}

function daysToMs(d: number): number {
    return d * 24 * 60 * 60 * 1000;
}

/**
 * Hard elimination phase (before AI ranking)
 * Eliminates ideas that:
 * 1. Match same topic + subtopic + angle already uploaded
 * 2. Same topic + subtopic uploaded within last N days
 * 3. Semantically equivalent angle to any previous upload
 * 4. Topic overused recently compared to others
 */
export function hardEliminate(
    ideas: Idea[],
    history: UploadRecord[],
    options: SelectorOptions = {}
): Idea[] {
    const angleEq = options.angleEquivalence || defaultAngleEq;
    const N = options.recentDaysWindow ?? 30;
    const now = Date.now();

    const eliminated = new Set<number>();

    // Rule 1 & 3: Eliminate exact triple matches or semantically equivalent angle
    for (let i = 0; i < ideas.length; i++) {
        const idea = ideas[i];
        for (const h of history) {
            if (
                normalize(h.topic) === normalize(idea.topic) &&
                normalize(h.subtopic) === normalize(idea.subtopic) &&
                angleEq(h.angle, idea.angle)
            ) {
                eliminated.add(i);
                break;
            }
        }
    }

    // Rule 2: Eliminate same topic+subtopic uploaded within last N days
    for (let i = 0; i < ideas.length; i++) {
        if (eliminated.has(i)) continue;
        const idea = ideas[i];
        for (const h of history) {
            if (
                normalize(h.topic) === normalize(idea.topic) &&
                normalize(h.subtopic) === normalize(idea.subtopic)
            ) {
                if (now - h.uploadTimestamp <= daysToMs(N)) {
                    eliminated.add(i);
                    break;
                }
            }
        }
    }

    // Rule 4: Topic overuse - topics used much more recently than others
    const topicCounts: Record<string, number> = {};
    const recentWindow = daysToMs(N);
    for (const h of history) {
        if (now - h.uploadTimestamp <= recentWindow) {
            const t = normalize(h.topic);
            topicCounts[t] = (topicCounts[t] || 0) + 1;
        }
    }
    const counts = Object.values(topicCounts);
    const avgCount = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
    const thresholdMul = options.topicOveruseThreshold ?? 2.0;

    for (let i = 0; i < ideas.length; i++) {
        if (eliminated.has(i)) continue;
        const t = normalize(ideas[i].topic);
        if ((topicCounts[t] || 0) > avgCount * thresholdMul && avgCount > 0) {
            eliminated.add(i);
        }
    }

    // Return eligible ideas
    return ideas.filter((_, idx) => !eliminated.has(idx));
}
