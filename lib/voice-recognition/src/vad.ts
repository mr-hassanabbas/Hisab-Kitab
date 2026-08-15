// Voice Activity Detection (VAD)
// Detects when user is speaking vs. silence/background noise

export interface VADConfig {
  sensitivity: number; // 0-1, higher = more sensitive
  frameDuration: number; // milliseconds
  silenceThreshold: number; // 0-1, below this is silence
  minSpeechDuration: number; // milliseconds
  minSilenceDuration: number; // milliseconds
}

export interface VADResult {
  isSpeaking: boolean;
  confidence: number;
  energy: number;
  frameIndex: number;
}

export class VoiceActivityDetector {
  private config: VADConfig;
  private energyHistory: number[] = [];
  private speechStartFrame: number = -1;
  private silenceStartFrame: number = -1;
  private frameIndex: number = 0;
  private isSpeaking: boolean = false;

  constructor(config: Partial<VADConfig> = {}) {
    this.config = {
      sensitivity: config.sensitivity ?? 0.5,
      frameDuration: config.frameDuration ?? 20, // 20ms frames
      silenceThreshold: config.silenceThreshold ?? 0.3,
      minSpeechDuration: config.minSpeechDuration ?? 300, // 300ms
      minSilenceDuration: config.minSilenceDuration ?? 500 // 500ms
    };
  }

  /**
   * Process audio frame and detect voice activity
   */
  processFrame(audioData: Float32Array): VADResult {
    const energy = this.calculateEnergy(audioData);
    const smoothedEnergy = this.smoothEnergy(energy);
    
    // Determine if speech is present
    const isSpeechFrame = smoothedEnergy > this.config.silenceThreshold;
    
    // State machine for speech detection
    if (isSpeechFrame && !this.isSpeaking) {
      // Potential speech start
      if (this.speechStartFrame === -1) {
        this.speechStartFrame = this.frameIndex;
      }
      
      // Check if speech has lasted long enough
      const speechDuration = (this.frameIndex - this.speechStartFrame) * this.config.frameDuration;
      if (speechDuration >= this.config.minSpeechDuration) {
        this.isSpeaking = true;
        this.silenceStartFrame = -1;
      }
    } else if (!isSpeechFrame && this.isSpeaking) {
      // Potential speech end
      if (this.silenceStartFrame === -1) {
        this.silenceStartFrame = this.frameIndex;
      }
      
      // Check if silence has lasted long enough
      const silenceDuration = (this.frameIndex - this.silenceStartFrame) * this.config.frameDuration;
      if (silenceDuration >= this.config.minSilenceDuration) {
        this.isSpeaking = false;
        this.speechStartFrame = -1;
      }
    }

    const result: VADResult = {
      isSpeaking: this.isSpeaking,
      confidence: this.calculateConfidence(smoothedEnergy),
      energy: smoothedEnergy,
      frameIndex: this.frameIndex
    };

    this.frameIndex++;
    return result;
  }

  /**
   * Calculate energy of audio frame
   */
  private calculateEnergy(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  /**
   * Smooth energy using exponential moving average
   */
  private smoothEnergy(energy: number): number {
    this.energyHistory.push(energy);
    
    // Keep only last 10 frames
    if (this.energyHistory.length > 10) {
      this.energyHistory.shift();
    }

    // Calculate exponential moving average
    const alpha = 0.3;
    if (this.energyHistory.length === 1) {
      return energy;
    }

    let smoothed = this.energyHistory[0];
    for (let i = 1; i < this.energyHistory.length; i++) {
      smoothed = alpha * this.energyHistory[i] + (1 - alpha) * smoothed;
    }

    return smoothed;
  }

  /**
   * Calculate confidence score for speech detection
   */
  private calculateConfidence(energy: number): number {
    // Normalize energy to 0-1 range
    const normalizedEnergy = Math.min(energy * 2, 1);
    
    // Apply sensitivity
    const confidence = normalizedEnergy * this.config.sensitivity;
    
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Reset VAD state
   */
  reset(): void {
    this.energyHistory = [];
    this.speechStartFrame = -1;
    this.silenceStartFrame = -1;
    this.frameIndex = 0;
    this.isSpeaking = false;
  }

  /**
   * Get current state
   */
  getState(): {
    isSpeaking: boolean;
    frameIndex: number;
    energyHistory: number[];
  } {
    return {
      isSpeaking: this.isSpeaking,
      frameIndex: this.frameIndex,
      energyHistory: [...this.energyHistory]
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VADConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[VAD] Config updated:', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): VADConfig {
    return { ...this.config };
  }

  /**
   * Detect speech in entire audio buffer
   */
  detectSpeechSegments(audioData: Float32Array, sampleRate: number): Array<{
    start: number;
    end: number;
    confidence: number;
  }> {
    this.reset();
    
    const frameSize = Math.floor(sampleRate * (this.config.frameDuration / 1000));
    const segments: Array<{ start: number; end: number; confidence: number }> = [];
    let currentSegment: { start: number; end: number; confidence: number } | null = null;

    for (let i = 0; i < audioData.length; i += frameSize) {
      const frame = audioData.slice(i, Math.min(i + frameSize, audioData.length));
      const result = this.processFrame(frame);

      if (result.isSpeaking && !currentSegment) {
        currentSegment = {
          start: i / sampleRate,
          end: i / sampleRate,
          confidence: result.confidence
        };
      } else if (result.isSpeaking && currentSegment) {
        currentSegment.end = i / sampleRate;
        currentSegment.confidence = Math.max(currentSegment.confidence, result.confidence);
      } else if (!result.isSpeaking && currentSegment) {
        segments.push(currentSegment);
        currentSegment = null;
      }
    }

    // Add final segment if still speaking
    if (currentSegment) {
      segments.push(currentSegment);
    }

    return segments;
  }

  /**
   * Trim silence from audio buffer
   */
  trimSilence(audioData: Float32Array, sampleRate: number): Float32Array {
    const segments = this.detectSpeechSegments(audioData, sampleRate);
    
    if (segments.length === 0) {
      return audioData; // No speech detected, return original
    }

    // Find overall start and end
    const startSample = Math.floor(segments[0].start * sampleRate);
    const endSample = Math.floor(segments[segments.length - 1].end * sampleRate);

    return audioData.slice(startSample, endSample);
  }

  /**
   * Get statistics about detected speech
   */
  getStatistics(audioData: Float32Array, sampleRate: number): {
    totalDuration: number;
    speechDuration: number;
    silenceDuration: number;
    speechRatio: number;
    segmentCount: number;
  } {
    const segments = this.detectSpeechSegments(audioData, sampleRate);
    const totalDuration = audioData.length / sampleRate;
    
    let speechDuration = 0;
    for (const segment of segments) {
      speechDuration += segment.end - segment.start;
    }

    const silenceDuration = totalDuration - speechDuration;
    const speechRatio = totalDuration > 0 ? speechDuration / totalDuration : 0;

    return {
      totalDuration,
      speechDuration,
      silenceDuration,
      speechRatio,
      segmentCount: segments.length
    };
  }
}

// WebRTC-based VAD (more advanced, if available)
export class WebRTCVAD {
  private vad: any = null;
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    try {
      // In a real implementation, this would load WebRTC VAD
      // const VAD = await import('@ricky0123/vad');
      // this.vad = await VAD.create({
      //   base64: VAD.Base64,
      //   workletURL: '/vad.worklet',
      //   model: 'v4'
      // });
      
      // For now, simulate initialization
      await this.delay(100);
      this.isInitialized = true;
      console.log('[WebRTC VAD] Initialized');
    } catch (error) {
      console.error('[WebRTC VAD] Initialization failed:', error);
      throw new Error('Failed to initialize WebRTC VAD');
    }
  }

  async processFrame(audioData: Float32Array): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error('VAD not initialized');
    }

    // In real implementation:
    // return await this.vad.processFrame(audioData);

    // Simulate VAD
    const energy = audioData.reduce((sum, val) => sum + val * val, 0) / audioData.length;
    return energy > 0.01;
  }

  async cleanup(): Promise<void> {
    if (this.vad) {
      // await this.vad.terminate();
      this.vad = null;
    }
    this.isInitialized = false;
    console.log('[WebRTC VAD] Cleaned up');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static isAvailable(): boolean {
    // Check if WebRTC VAD is available
    return typeof AudioWorklet !== 'undefined';
  }
}

// Factory for creating appropriate VAD instance
export function createVAD(useWebRTC: boolean = false): VoiceActivityDetector | WebRTCVAD {
  if (useWebRTC && WebRTCVAD.isAvailable()) {
    return new WebRTCVAD();
  } else {
    return new VoiceActivityDetector();
  }
}
