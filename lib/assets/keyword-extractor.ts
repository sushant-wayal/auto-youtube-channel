/**
 * Keyword Extraction Utility
 * Extracts visual key phrases from narration text for stock footage search
 * Now extracts 3-4 word phrases with word coverage for dynamic clip timing
 * AI decides the optimal number of clips based on content
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
 * Represents a key phrase with its word coverage for timing
 */
export interface KeyPhrase {
  phrase: string;        // 3-4 word descriptive phrase for stock footage search
  wordsCovered: number;  // Number of words in narration this phrase covers
}

export interface KeywordExtractionResult {
  keywords: string[];           // Simple list of phrases (for backward compatibility)
  keyPhrases: KeyPhrase[];      // Phrases with word coverage for dynamic timing
  clipCount: number;            // Number of clips (determined by AI)
  audioDuration: number;
  totalWordsCovered: number;    // Total words in narration covered by phrases
}

/**
 * AI-powered keyword extractor for video content
 * Extracts 3-4 word phrases with word coverage for dynamic clip timing
 * AI determines optimal number of clips based on content
 */
export class KeywordExtractor {
  private geminiService: GeminiService;

  constructor() {
    this.geminiService = new GeminiService();
  }

  /**
   * Extract key phrases from narration text using AI
   * AI decides the optimal number of clips based on content and pacing
   * @param narration - Full narration text
   * @param audioDuration - Duration of audio in seconds
   * @returns Key phrases with word coverage (AI determines clip count)
   */
  async extractKeywords(narration: string, audioDuration: number): Promise<KeywordExtractionResult> {
    console.log('🤖 Extracting key phrases using AI...');
    console.log(`📊 Audio duration: ${audioDuration.toFixed(2)}s (${(audioDuration / 60).toFixed(1)} minutes)`);

    // Count total words in narration (excluding pause markers)
    const cleanNarration = narration.replace(/\[PAUSE\]/g, '');
    const totalWords = cleanNarration.trim().split(/\s+/).filter(w => w.length > 0).length;
    console.log(`📝 Total words in narration: ${totalWords}`);

    // Calculate recommended clip count based on duration
    // Target 6-10 seconds per clip to keep response size manageable
    const minClips = Math.max(5, Math.ceil(audioDuration / 15));  // At least 1 clip per 15 seconds
    const maxClips = Math.min(60, Math.ceil(audioDuration / 5));  // At most 1 clip per 5 seconds, max 60
    const recommendedClips = Math.ceil((minClips + maxClips) / 2);

    console.log(`🎯 Recommended clips: ${recommendedClips} (range: ${minClips}-${maxClips})`);

    // Create AI prompt for key phrase extraction with word coverage
    const prompt = `You are a video content analyzer. Extract relevant visual key phrases from the following narration that can be used to search for stock footage videos.

NARRATION:
${narration}

TOTAL WORDS IN NARRATION: ${totalWords}
AUDIO DURATION: ${audioDuration.toFixed(1)} seconds

REQUIREMENTS:
- Extract between ${minClips} and ${maxClips} key phrases (recommended: ${recommendedClips})
- Each clip should cover approximately ${Math.round(totalWords / recommendedClips)} words
- Each phrase should be 3-4 words describing a visual scene (e.g., "person working laptop", "city skyline night", "hands typing keyboard")
- For each phrase, specify how many words of the narration it should cover
- The sum of all wordsCovered values MUST equal exactly ${totalWords}
- Focus on concrete, visual elements that can be found as stock footage
- Ensure variety - don't repeat similar concepts
- Match the flow and pacing of the narration chronologically

OUTPUT FORMAT (JSON array only, no markdown):
[
  {"phrase": "business meeting office", "wordsCovered": 25},
  {"phrase": "person typing laptop", "wordsCovered": 18}
]

IMPORTANT: 
- Return ONLY valid JSON array, NO markdown code blocks, NO backticks
- Keep it concise - maximum ${maxClips} phrases
- wordsCovered must be positive integers that sum to ${totalWords}

JSON RESPONSE:`;

    try {
      const response = await this.geminiService.generateText(prompt, {
        temperature: 0.7,
        maxOutputTokens: 8000,
      });

      // Parse JSON response
      const keyPhrases = this.parseKeyPhrasesResponse(response, totalWords);

      if (keyPhrases.length === 0) {
        throw new Error('AI returned no valid key phrases');
      }

      // Calculate total words covered
      const totalWordsCovered = keyPhrases.reduce((sum, kp) => sum + kp.wordsCovered, 0);

      console.log(`✅ AI decided on ${keyPhrases.length} key phrases for ${(audioDuration / 60).toFixed(1)} min video`);
      console.log(`📊 Total words covered: ${totalWordsCovered}/${totalWords}`);

      // Extract simple keyword list for backward compatibility
      const keywords = keyPhrases.map(kp => kp.phrase);

      return {
        keywords,
        keyPhrases,
        clipCount: keyPhrases.length,
        audioDuration,
        totalWordsCovered,
      };
    } catch (error) {
      console.error('❌ AI key phrase extraction failed:', error);
      console.log('⚠️  Falling back to basic extraction');

      // Fallback: create evenly distributed phrases based on duration
      const fallbackClipCount = Math.max(10, Math.ceil(audioDuration / 2.5));
      return this.fallbackExtraction(narration, fallbackClipCount, totalWords, audioDuration);
    }
  }

  /**
   * Parse AI response to extract key phrases with word coverage
   */
  private parseKeyPhrasesResponse(response: string, totalWords: number): KeyPhrase[] {
    try {
      // Try to extract JSON from response
      let jsonStr = response.trim();

      console.log('📄 Raw AI response (first 500 chars):', jsonStr.substring(0, 500));

      // Handle markdown code blocks - multiple patterns
      // Pattern 1: ```json ... ```
      // Pattern 2: ``` ... ```
      // Pattern 3: ```\n ... \n```
      if (jsonStr.includes('```')) {
        // Remove the opening ```json or ``` and closing ```
        jsonStr = jsonStr
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();
      }

      // If still has backticks, try more aggressive extraction
      if (jsonStr.includes('```')) {
        const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (codeBlockMatch && codeBlockMatch[1]) {
          jsonStr = codeBlockMatch[1].trim();
        }
      }

      // Find JSON array in response (in case there's extra text)
      const arrayMatch = jsonStr.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        jsonStr = arrayMatch[0];
      }

      console.log('📄 Cleaned JSON string (first 300 chars):', jsonStr.substring(0, 300));

      const parsed = JSON.parse(jsonStr);

      if (!Array.isArray(parsed)) {
        throw new Error('Response is not an array');
      }

      const keyPhrases: KeyPhrase[] = parsed
        .filter((item: unknown) => {
          if (typeof item !== 'object' || item === null) return false;
          const obj = item as Record<string, unknown>;
          return typeof obj.phrase === 'string' &&
            typeof obj.wordsCovered === 'number' &&
            obj.phrase.length > 0 &&
            obj.wordsCovered > 0;
        })
        .map((item: unknown) => {
          const obj = item as { phrase: string; wordsCovered: number };
          return {
            phrase: obj.phrase.trim(),
            wordsCovered: Math.max(1, Math.round(obj.wordsCovered)),
          };
        });

      // Normalize word coverage to match total words exactly
      if (keyPhrases.length > 0) {
        const currentTotal = keyPhrases.reduce((sum, kp) => sum + kp.wordsCovered, 0);
        if (currentTotal !== totalWords && currentTotal > 0) {
          const ratio = totalWords / currentTotal;
          keyPhrases.forEach(kp => {
            kp.wordsCovered = Math.max(1, Math.round(kp.wordsCovered * ratio));
          });

          // Fine-tune to match exactly
          const newTotal = keyPhrases.reduce((sum, kp) => sum + kp.wordsCovered, 0);
          const diff = totalWords - newTotal;
          if (diff !== 0 && keyPhrases.length > 0) {
            // Add/subtract the difference from the last phrase
            keyPhrases[keyPhrases.length - 1].wordsCovered = Math.max(1,
              keyPhrases[keyPhrases.length - 1].wordsCovered + diff
            );
          }
        }
      }

      return keyPhrases;
    } catch (error) {
      console.error('Failed to parse key phrases JSON:', error);
      console.error('JSON string was:', response.substring(0, 500));
      return [];
    }
  }

  /**
   * Fallback key phrase extraction using simple text analysis
   */
  private fallbackExtraction(
    narration: string,
    targetCount: number,
    totalWords: number,
    audioDuration: number
  ): KeywordExtractionResult {
    // Limit target count to reasonable range (same as AI extraction)
    const minClips = Math.max(5, Math.ceil(audioDuration / 15));
    const maxClips = Math.min(60, Math.ceil(audioDuration / 5));
    const limitedTargetCount = Math.min(Math.max(targetCount, minClips), maxClips);

    console.log(`⚠️  Fallback: limiting clips from ${targetCount} to ${limitedTargetCount}`);

    // Remove special characters and split into words
    const words = narration
      .toLowerCase()
      .replace(/\[PAUSE\]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOPWORDS.has(w));

    // Get unique words by frequency
    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });

    // Get top words and create generic phrases
    const topWords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limitedTargetCount)
      .map(([word]) => word);

    // Create key phrases with even word distribution
    const wordsPerPhrase = Math.floor(totalWords / limitedTargetCount);
    const remainder = totalWords % limitedTargetCount;

    const keyPhrases: KeyPhrase[] = topWords.map((word, index) => ({
      phrase: `${word} scene footage`, // Create a searchable phrase
      wordsCovered: wordsPerPhrase + (index < remainder ? 1 : 0), // Distribute remainder
    }));

    // Ensure we have enough phrases
    while (keyPhrases.length < limitedTargetCount) {
      const wordsLeft = totalWords - keyPhrases.reduce((sum, kp) => sum + kp.wordsCovered, 0);
      keyPhrases.push({
        phrase: 'general background footage',
        wordsCovered: Math.max(1, Math.ceil(wordsLeft / (limitedTargetCount - keyPhrases.length))),
      });
    }

    const keywords = keyPhrases.map(kp => kp.phrase);
    const totalWordsCovered = keyPhrases.reduce((sum, kp) => sum + kp.wordsCovered, 0);

    console.log(`⚠️  Fallback extraction: ${keyPhrases.length} key phrases`);

    return {
      keywords,
      keyPhrases,
      clipCount: keyPhrases.length,
      audioDuration,
      totalWordsCovered,
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
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Split into words
  const words = cleaned.split(' ');

  // Count word frequencies
  const frequencies = new Map<string, number>();

  for (const word of words) {
    if (word.length <= 3 || STOPWORDS.has(word)) {
      continue;
    }
    frequencies.set(word, (frequencies.get(word) || 0) + 1);
  }

  // Sort by frequency and take top N
  const sortedKeywords = Array.from(frequencies.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word);

  return sortedKeywords;
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use KeywordExtractor.extractKeywords instead
 */
export function extractKeywords(narration: string, topN: number = 10): string[] {
  return extractKeywordsSimple(narration, topN);
}
