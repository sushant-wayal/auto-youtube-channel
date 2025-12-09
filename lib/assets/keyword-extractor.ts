/**
 * Keyword Extraction Utility
 * Extracts visual keywords from narration text for stock footage search
 */

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'you', 'we', 'they',
  'when', 'what', 'how', 'why', 'who', 'which', 'where', 'there',
  'here', 'from', 'but', 'can', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'are', 'was', 'were', 'been', 'being',
  'have', 'has', 'had', 'does', 'did', 'doing', 'not', 'now',
  'then', 'than', 'also', 'just', 'only', 'very', 'too', 'more',
  'most', 'some', 'any', 'all', 'into', 'out', 'over', 'under',
  'about', 'after', 'before', 'between', 'through', 'during',
  'while', 'your', 'our', 'their', 'its', 'his', 'her', 'him',
  'them', 'these', 'those', 'such', 'each', 'own', 'same', 'few',
  'many', 'much', 'other', 'another', 'both', 'either', 'neither',
  'pause', 'like', 'well', 'way', 'make', 'get', 'see', 'know',
  'take', 'come', 'go', 'think', 'look', 'want', 'use', 'find',
  'give', 'tell', 'work', 'call', 'try', 'ask', 'need', 'feel',
  'become', 'leave', 'put', 'mean', 'keep', 'let', 'begin', 'seem',
]);

/**
 * Extract visual keywords from narration text
 * @param narration - The full narration text
 * @param topN - Number of top keywords to return (default: 10)
 * @returns Array of keyword strings
 */
export function extractKeywords(narration: string, topN: number = 10): string[] {
  // Lowercase and remove punctuation
  const cleaned = narration
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  // Split into words
  const words = cleaned.split(' ');

  // Count word frequencies
  const frequencies = new Map<string, number>();

  for (const word of words) {
    // Filter: ignore stopwords and words <= 3 characters
    if (word.length <= 3 || STOPWORDS.has(word)) {
      continue;
    }

    // Increment frequency
    frequencies.set(word, (frequencies.get(word) || 0) + 1);
  }

  // Sort by frequency (descending) and take top N
  const sortedKeywords = Array.from(frequencies.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word);

  return sortedKeywords;
}
