import { UploadRecord, HistoricalSignals } from '../types';

function normalize(s: string): string {
    return s.trim().toLowerCase();
}

/**
 * Extract descriptive signals from upload history
 * No prediction, no trend inference, no external data
 */
export function extractSignals(history: UploadRecord[]): HistoricalSignals {
    if (!history || history.length === 0) {
        return {
            topicCtrAboveAvg: new Set<string>(),
            subtopicHighRetention: new Set<string>(),
            shortWorked: new Set<string>(),
            longWorked: new Set<string>(),
        };
    }

    const byTopic: Record<string, { ctrs: number[]; impressions: number[] }> = {};
    const bySubtopic: Record<string, { retention: number[]; impressions: number[] }> = {};
    const shortSuccess = new Set<string>();
    const longSuccess = new Set<string>();

    // Collect metrics per topic and subtopic
    for (const h of history) {
        const t = normalize(h.topic);
        const st = `${t}||${normalize(h.subtopic)}`;

        if (!byTopic[t]) byTopic[t] = { ctrs: [], impressions: [] };
        if (typeof h.ctr === 'number') byTopic[t].ctrs.push(h.ctr);
        if (typeof h.impressions === 'number') byTopic[t].impressions.push(h.impressions);

        if (!bySubtopic[st]) bySubtopic[st] = { retention: [], impressions: [] };
        if (typeof h.retention === 'number') bySubtopic[st].retention.push(h.retention);
        if (typeof h.impressions === 'number') bySubtopic[st].impressions.push(h.impressions);

        // Track format-specific success (retention > 0.5)
        if (h.format === 'short') {
            if ((h.retention || 0) > 0.5) shortSuccess.add(st);
        } else {
            if ((h.retention || 0) > 0.5) longSuccess.add(st);
        }
    }

    // Compute overall average CTR
    const allCtrs = Object.values(byTopic).flatMap(t => t.ctrs);
    const avgCtr = allCtrs.length ? allCtrs.reduce((a, b) => a + b, 0) / allCtrs.length : 0;

    // Identify topics with above-average CTR
    const topicCtrAboveAvg = new Set<string>();
    for (const [t, v] of Object.entries(byTopic)) {
        const avg = v.ctrs.length ? v.ctrs.reduce((a, b) => a + b, 0) / v.ctrs.length : 0;
        if (avg > avgCtr) topicCtrAboveAvg.add(t);
    }

    // Identify subtopics with high retention (> 0.5)
    const subtopicHighRetention = new Set<string>();
    for (const [st, v] of Object.entries(bySubtopic)) {
        const avg = v.retention.length ? v.retention.reduce((a, b) => a + b, 0) / v.retention.length : 0;
        if (avg > 0.5) subtopicHighRetention.add(st);
    }

    return {
        topicCtrAboveAvg,
        subtopicHighRetention,
        shortWorked: shortSuccess,
        longWorked: longSuccess,
    };
}
