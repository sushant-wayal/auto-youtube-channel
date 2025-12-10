/**
 * Keyword Extraction Utility
 * Extracts visual keywords from narration text for stock footage search
 */

import { GeminiService } from "@/lib/ai";

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
 * Calculate the number of keywords needed based on audio duration
 * Clips should be 2-3 seconds each to avoid excessive looping
 */
export function calculateKeywordCount(narrationDurationSeconds: number): number {
  const SECONDS_PER_CLIP = 2.5; // Average 2.5 seconds per clip for dynamic pacing
  const keywordCount = Math.ceil(narrationDurationSeconds / SECONDS_PER_CLIP);

  // Ensure minimum 10 keywords, no maximum limit
  // For 5 min video (300s): 300/2.5 = 120 clips
  return Math.max(10, keywordCount);
}

export interface KeywordExtractionResult {
  keywords: string[];
  estimatedClipsNeeded: number;
  audioDuration: number;
}

/**
 * AI-powered keyword extractor for video content
 * Dynamically determines optimal number of clips based on content and duration
 */
export class KeywordExtractor {
  private geminiService: GeminiService;

  constructor() {
    this.geminiService = new GeminiService();
  }

  /**
   * Extract keywords from narration text using AI
   * @param narration - Full narration text
   * @param audioDuration - Duration of audio in seconds
   * @returns Keywords and estimated clip count
   */
  async extractKeywords(narration: string, audioDuration: number): Promise<KeywordExtractionResult> {
    console.log('🤖 Extracting keywords using AI...');
    console.log(`📊 Audio duration: ${audioDuration.toFixed(2)}s (${(audioDuration / 60).toFixed(1)} minutes)`);

    // Calculate ideal number of clips based on duration
    // Target 2-3 seconds per clip to avoid excessive looping
    const avgClipDuration = 2.5;
    const estimatedClipsNeeded = Math.ceil(audioDuration / avgClipDuration);

    console.log(`🎯 Target clips: ${estimatedClipsNeeded} (~${avgClipDuration}s average each)`);
    console.log(`💡 This ensures minimal looping and dynamic visual changes`);

    // Create AI prompt for keyword extraction
    const prompt = `You are a video content analyzer. Extract relevant visual keywords from the following narration that can be used to search for stock footage videos.

NARRATION:
${narration}

REQUIREMENTS:
- Extract ${estimatedClipsNeeded} keywords or phrases (each should be 3-6 words for better search results)
- Keywords should represent distinct visual concepts that can be found as stock footage
- Focus on concrete, visual elements (objects, actions, scenes, locations)
- Avoid abstract concepts that are hard to visualize
- Ensure variety - don't repeat similar concepts
- Keywords should match the flow and pacing of the narration
- Consider the context and topic of the narration
- Use descriptive phrases like "person walking in city" instead of just "walking"

OUTPUT FORMAT:
Provide ONLY a comma-separated list of keywords, nothing else.
Example: business people in meeting, hands typing on laptop, aerial view of city, coffee being poured, modern office workspace, person using smartphone

YOUR KEYWORDS:`;

    try {
      const response = await this.geminiService.generateText(prompt, {
        temperature: 0.7,
        maxOutputTokens: 2000, // Increased for more keywords
      });

      // Parse keywords from response
      const keywords = response
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0 && k.length < 100) // Allow longer phrases
        .slice(0, estimatedClipsNeeded + 10); // Get extra in case some fail

      if (keywords.length === 0) {
        throw new Error('AI returned no valid keywords');
      }

      console.log(`✅ Extracted ${keywords.length} keywords for ${(audioDuration / 60).toFixed(1)} min video`);

      return {
        keywords,
        estimatedClipsNeeded,
        audioDuration,
      };
    } catch (error) {
      console.error('❌ AI keyword extraction failed:', error);
      console.log('⚠️  Falling back to basic keyword extraction');

      // Fallback: extract nouns and key phrases from narration
      return this.fallbackExtraction(narration, estimatedClipsNeeded);
    }
  }

  /**
   * Fallback keyword extraction using simple text analysis
   */
  private fallbackExtraction(narration: string, targetCount: number): KeywordExtractionResult {
    // Remove special characters and split into words
    const words = narration
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3); // Only words longer than 3 characters

    // Common words to filter out
    const stopWords = new Set([
      'this', 'that', 'these', 'those', 'with', 'from', 'have', 'been',
      'will', 'would', 'could', 'should', 'about', 'into', 'through',
      'during', 'before', 'after', 'above', 'below', 'between', 'under',
      'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where',
      'why', 'how', 'all', 'both', 'each', 'more', 'most', 'other', 'some',
      'such', 'only', 'own', 'same', 'than', 'very', 'can', 'just', 'also'
    ]);

    // Filter and count word frequency
    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      if (!stopWords.has(word)) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    });

    // Get top words by frequency
    const keywords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, targetCount)
      .map(([word]) => word);

    console.log(`⚠️  Fallback extraction: ${keywords.length} keywords`);

    return {
      keywords,
      estimatedClipsNeeded: targetCount,
      audioDuration: 0,
    };
  }
}

/**
 * Simple fallback keyword extraction (frequency-based)
 * @param narration - The full narration text
 * @param topN - Number of top keywords to return
 * @returns Array of keyword strings
 */
export function extractKeywordsSimple(narration: string, topN: number = 10): string[] {
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

/**
 * Legacy function for backward compatibility
 * @deprecated Use extractKeywordsWithAI instead
 */
export function extractKeywords(narration: string, topN: number = 10): string[] {
  return extractKeywordsSimple(narration, topN);
}
