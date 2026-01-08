/**
 * Idea from the predefined universe
 */
export type Idea = {
    topic: string;
    subtopic: string;
    angle: string; // conceptual explanation, not a hook
};

/**
 * Historical upload record with performance metrics
 */
export type UploadRecord = {
    topic: string;
    subtopic: string;
    angle: string;
    format: 'short' | 'long';
    impressions?: number; // first 24h
    ctr?: number; // click-through rate (0..1)
    retention?: number; // retention rate (0..1)
    comments?: number;
    uploadTimestamp: number; // ms since epoch
};

/**
 * Options for the selector
 */
export type SelectorOptions = {
    recentDaysWindow?: number; // N days for same topic+subtopic elimination (default: 30)
    topicOveruseThreshold?: number; // multiplier for overuse elimination (default: 2.0)
    angleEquivalence?: (a: string, b: string) => boolean; // optional equivalence fn
    persistPath?: string; // where to persist chosen ideas
};

/**
 * Extracted signals from history
 */
export type HistoricalSignals = {
    topicCtrAboveAvg: Set<string>;
    subtopicHighRetention: Set<string>;
    shortWorked: Set<string>;
    longWorked: Set<string>;
};

/**
 * Selection result
 */
export type SelectionResult = {
    selected: Idea;
    chosenFormat: 'short' | 'long';
    reasoning: string;
    timestamp: number;
};
