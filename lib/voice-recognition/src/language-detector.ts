// Language Detector for Multi-Language Support
// Detects Urdu, Hindi, and English from text or audio characteristics

export interface LanguageDetectionResult {
  language: 'ur' | 'hi' | 'en' | 'unknown';
  confidence: number;
  script: 'arabic' | 'latin' | 'unknown';
}

export class LanguageDetector {
  private urduHindiPatterns: RegExp[];
  private englishPatterns: RegExp[];
  private confidenceThreshold: number;

  constructor() {
    this.confidenceThreshold = 0.6;

    // Urdu/Hindi patterns (Arabic script)
    this.urduHindiPatterns = [
      /[\u0600-\u06FF]/, // Arabic-Indic script range
      /[\u0750-\u077F]/, // Arabic Supplement
      /[\uFB50-\uFDFF]/, // Arabic Presentation Forms-A
      /[\uFE70-\uFEFF]/, // Arabic Presentation Forms-B
      /حاضری/, /hazri/, /attendance/i,
      /مزدور/, /mazdoor/, /worker/i,
      /خرچہ/, /kharcha/, /expense/i,
      /پروجیکٹ/, /project/i,
      /تنخواہ/, /tankhwa/, /payment/i
    ];

    // English patterns (Latin script)
    this.englishPatterns = [
      /^[a-zA-Z\s.,!?'"()-]+$/,
      /\b(the|is|at|which|on)\b/i,
      /\b(mark|show|create|add|query)\b/i
    ];
  }

  /**
   * Detect language from text
   */
  detectFromText(text: string): LanguageDetectionResult {
    const trimmedText = text.trim();
    
    if (!trimmedText) {
      return { language: 'unknown', confidence: 0, script: 'unknown' };
    }

    // Check for Arabic script (Urdu/Hindi)
    const arabicScore = this.calculateArabicScore(trimmedText);
    
    if (arabicScore > this.confidenceThreshold) {
      // Distinguish between Urdu and Hindi
      const language = this.distinguishUrduHindi(trimmedText);
      return {
        language,
        confidence: arabicScore,
        script: 'arabic'
      };
    }

    // Check for Latin script (English)
    const englishScore = this.calculateEnglishScore(trimmedText);
    
    if (englishScore > this.confidenceThreshold) {
      return {
        language: 'en',
        confidence: englishScore,
        script: 'latin'
      };
    }

    // Check for Roman Urdu (Latin script with Urdu words)
    const romanUrduScore = this.calculateRomanUrduScore(trimmedText);
    
    if (romanUrduScore > this.confidenceThreshold) {
      return {
        language: 'ur', // Treat Roman Urdu as Urdu
        confidence: romanUrduScore,
        script: 'latin'
      };
    }

    // Default to unknown
    return {
      language: 'unknown',
      confidence: 0,
      script: 'unknown'
    };
  }

  /**
   * Detect language from audio characteristics
   */
  detectFromAudio(audioData: Float32Array): LanguageDetectionResult {
    // In real implementation, this would analyze audio features:
    // - Phoneme distribution
    // - Prosodic patterns
    // - Spectral characteristics
    
    // For now, return unknown and rely on text detection
    return {
      language: 'unknown',
      confidence: 0,
      script: 'unknown'
    };
  }

  /**
   * Calculate Arabic script score
   */
  private calculateArabicScore(text: string): number {
    let arabicChars = 0;
    let totalChars = text.length;

    for (const char of text) {
      if (this.urduHindiPatterns[0].test(char)) {
        arabicChars++;
      }
    }

    if (totalChars === 0) return 0;

    const charRatio = arabicChars / totalChars;
    
    // Boost score if common Urdu/Hindi words are present
    let wordScore = 0;
    for (let i = 2; i < this.urduHindiPatterns.length; i++) {
      if (this.urduHindiPatterns[i].test(text)) {
        wordScore += 0.2;
      }
    }

    return Math.min(charRatio + wordScore, 1.0);
  }

  /**
   * Calculate English score
   */
  private calculateEnglishScore(text: string): number {
    let score = 0;

    // Check character set
    if (this.englishPatterns[0].test(text)) {
      score += 0.3;
    }

    // Check for common English words
    const commonWords = ['the', 'is', 'at', 'which', 'on', 'and', 'or', 'but'];
    for (const word of commonWords) {
      if (text.toLowerCase().includes(word)) {
        score += 0.1;
      }
    }

    // Check for command words
    const commandWords = ['mark', 'show', 'create', 'add', 'query', 'get', 'set'];
    for (const word of commandWords) {
      if (text.toLowerCase().includes(word)) {
        score += 0.15;
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate Roman Urdu score
   */
  private calculateRomanUrduScore(text: string): number {
    let score = 0;

    // Roman Urdu specific words
    const romanUrduWords = [
      'kar', 'karo', 'karein', 'do', 'dijiye',
      'lagao', 'lagayein', 'dikhao', 'dikhaiye',
      'hai', 'hain', 'hai', 'tha', 'the',
      'ka', 'ki', 'ke', 'ko', 'se'
    ];

    const lowerText = text.toLowerCase();
    for (const word of romanUrduWords) {
      if (lowerText.includes(word)) {
        score += 0.15;
      }
    }

    // Check for mixed Urdu-English patterns
    if (/\b(hazri|attendance|project|worker|mazdoor)\b/i.test(lowerText)) {
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Distinguish between Urdu and Hindi
   */
  private distinguishUrduHindi(text: string): 'ur' | 'hi' {
    // Urdu-specific words
    const urduWords = [
      'حاضری', 'تنخواہ', 'پروجیکٹ', 'مزدور',
      'خرچہ', 'اخراجات', 'ادائیگی'
    ];

    // Hindi-specific words (use Devanagari in real implementation)
    const hindiWords = [
      'हाजिरी', 'वेतन', 'परियोजना', 'मजदूर',
      'खर्च', 'व्यय', 'भुगतान'
    ];

    let urduScore = 0;
    let hindiScore = 0;

    for (const word of urduWords) {
      if (text.includes(word)) {
        urduScore++;
      }
    }

    for (const word of hindiWords) {
      if (text.includes(word)) {
        hindiScore++;
      }
    }

    // Default to Urdu for Hisab Kitab (Pakistani context)
    return urduScore >= hindiScore ? 'ur' : 'hi';
  }

  /**
   * Get language name from code
   */
  getLanguageName(code: string): string {
    const names: Record<string, string> = {
      'ur': 'Urdu',
      'hi': 'Hindi',
      'en': 'English',
      'unknown': 'Unknown'
    };
    return names[code] || 'Unknown';
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return ['ur', 'hi', 'en'];
  }

  /**
   * Set confidence threshold
   */
  setConfidenceThreshold(threshold: number): void {
    this.confidenceThreshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Get confidence threshold
   */
  getConfidenceThreshold(): number {
    return this.confidenceThreshold;
  }
}

// Singleton instance
export const languageDetector = new LanguageDetector();
