/**
 * Rule-based pre-filter for obvious YouTube spam, scam bots, and malicious links.
 * Runs before sending to AI to conserve tokens and provide immediate safety.
 */

// Regex patterns for URLs and invitation links
const URL_REGEX = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(bit\.ly\/[^\s]+)|(tinyurl\.com\/[^\s]+)|(t\.me\/[^\s]+)|(wa\.me\/[^\s]+)|([a-zA-Z0-9-]+\.(xyz|top|ru|cc|tk|ml|ga|cf|gq)\b)/i;

// Phishing and spam triggers common in YouTube comment sections
const SCAM_PATTERNS = [
    /\b(?:whatsapp|telegram|tele\s*gram|signal)\b/i,
    /\b(?:crypto|forex|bitcoin|usdt|eth|btc)\s+(?:profit|investment|trading|returns?)\b/i,
    /\b(?:earn|invest)\s+\$?\d+.*?(?:daily|guaranteed|passive)\b/i,
    /\b(?:dm\s*me|text\s*him|message\s*her|contact\s*via)\b/i,
    /\b(?:binary\s+options?|money\s+doubler)\b/i,
    /\b(?:mr|dr|mrs|prof)\.?\s+[a-z\s]+(?:helped\s+me|recovered\s+my|recommended\s+by)\b/i,
    /\b(?:cash\s*app|free\s*gift\s*card|giveaway\s*winner)\b/i,
];

export interface SpamFilterResult {
    isSpam: boolean;
    reason?: string;
}

export function evaluateSpamRules(commentText: string): SpamFilterResult {
    const text = commentText.trim();

    // 1. Empty or virtually empty comments
    if (text.length === 0) {
        return { isSpam: true, reason: 'Empty comment' };
    }

    // 2. URL and external link detection
    if (URL_REGEX.test(text)) {
        return { isSpam: true, reason: 'Contains external link or invitation URL' };
    }

    // 3. Scam and investment bot phrases
    for (const pattern of SCAM_PATTERNS) {
        if (pattern.test(text)) {
            return { isSpam: true, reason: `Matches spam/scam pattern: ${pattern.source}` };
        }
    }

    // 4. Excessive repetitive character spam (e.g. "aaaaaaaahhhhhhh!!!!!!!!!")
    if (/(.)\1{12,}/.test(text)) {
        return { isSpam: true, reason: 'Excessive repeated characters' };
    }

    return { isSpam: false };
}
