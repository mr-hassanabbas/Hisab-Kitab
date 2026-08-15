// Noise Cancellation for Background Noise Handling
// Uses Web Audio API for real-time noise reduction

export interface NoiseCancellationConfig {
  enableNoiseSuppression: boolean;
  enableEchoCancellation: boolean;
  enableAutoGainControl: boolean;
  noiseThreshold: number; // 0-1
  spectralSubtraction: boolean;
}

export class NoiseCancellation {
  private config: NoiseCancellationConfig;
  private audioContext: AudioContext | null = null;
  private noiseProfile: Float32Array | null = null;
  private noiseProfileSamples: number = 0;
  private fftSize: number = 2048;

  constructor(config: Partial<NoiseCancellationConfig> = {}) {
    this.config = {
      enableNoiseSuppression: config.enableNoiseSuppression ?? true,
      enableEchoCancellation: config.enableEchoCancellation ?? true,
      enableAutoGainControl: config.enableAutoGainControl ?? true,
      noiseThreshold: config.noiseThreshold ?? 0.3,
      spectralSubtraction: config.spectralSubtraction ?? true
    };
  }

  /**
   * Initialize audio context for noise cancellation
   */
  async initialize(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });
      console.log('[Noise Cancellation] Initialized');
    } catch (error) {
      console.error('[Noise Cancellation] Initialization failed:', error);
      throw new Error('Failed to initialize audio context');
    }
  }

  /**
   * Capture noise profile (calibration phase)
   */
  async captureNoiseProfile(durationMs: number = 1000): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    console.log('[Noise Cancellation] Capturing noise profile...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: false, // Disable to capture actual noise
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      const source = this.audioContext.createMediaStreamSource(stream);
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      const samples: Float32Array[] = [];
      const startTime = Date.now();

      processor.onaudioprocess = (event) => {
        if (Date.now() - startTime < durationMs) {
          samples.push(new Float32Array(event.inputBuffer.getChannelData(0)));
        } else {
          source.disconnect();
          processor.disconnect();
          stream.getTracks().forEach(track => track.stop());
        }
      };

      source.connect(processor);
      processor.connect(this.audioContext.destination);

      // Wait for capture to complete
      await this.delay(durationMs + 100);

      // Compute noise profile (average spectrum)
      this.noiseProfile = this.computeNoiseProfile(samples);
      this.noiseProfileSamples = samples.reduce((sum, s) => sum + s.length, 0);

      console.log('[Noise Cancellation] Noise profile captured:', this.noiseProfileSamples, 'samples');
    } catch (error) {
      console.error('[Noise Cancellation] Failed to capture noise profile:', error);
      throw new Error('Failed to capture noise profile');
    }
  }

  /**
   * Compute noise profile from samples
   */
  private computeNoiseProfile(samples: Float32Array[]): Float32Array {
    // Simple approach: compute average amplitude
    const totalSamples = samples.reduce((sum, s) => sum + s.length, 0);
    const profile = new Float32Array(this.fftSize);
    
    for (const sample of samples) {
      for (let i = 0; i < sample.length; i++) {
        const freqIndex = i % this.fftSize;
        profile[freqIndex] += Math.abs(sample[i]);
      }
    }

    // Normalize
    for (let i = 0; i < profile.length; i++) {
      profile[i] /= totalSamples;
    }

    return profile;
  }

  /**
   * Apply noise cancellation to audio data
   */
  applyNoiseCancellation(audioData: Float32Array): Float32Array {
    if (!this.config.enableNoiseSuppression) {
      return audioData;
    }

    const output = new Float32Array(audioData.length);

    if (this.config.spectralSubtraction && this.noiseProfile) {
      // Spectral subtraction (simplified)
      for (let i = 0; i < audioData.length; i++) {
        const freqIndex = i % this.fftSize;
        const noiseLevel = this.noiseProfile[freqIndex];
        const signal = audioData[i];
        
        // Subtract noise (with flooring to avoid negative values)
        const cleaned = Math.max(0, Math.abs(signal) - noiseLevel * this.config.noiseThreshold);
        output[i] = Math.sign(signal) * cleaned;
      }
    } else {
      // Simple threshold-based noise gate
      for (let i = 0; i < audioData.length; i++) {
        if (Math.abs(audioData[i]) < this.config.noiseThreshold) {
          output[i] = 0; // Gate out low-level noise
        } else {
          output[i] = audioData[i];
        }
      }
    }

    return output;
  }

  /**
   * Get microphone with noise cancellation enabled
   */
  async getNoiseCancelledStream(): Promise<MediaStream> {
    const constraints: MediaTrackConstraints = {
      channelCount: 1,
      sampleRate: 16000,
      echoCancellation: this.config.enableEchoCancellation,
      noiseSuppression: this.config.enableNoiseSuppression,
      autoGainControl: this.config.enableAutoGainControl
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
      console.log('[Noise Cancellation] Stream with noise cancellation obtained');
      return stream;
    } catch (error) {
      console.error('[Noise Cancellation] Failed to get stream:', error);
      throw new Error('Failed to get microphone stream');
    }
  }

  /**
   * Adaptive noise filtering (LMS filter simulation)
   */
  adaptiveFilter(audioData: Float32Array, desired: Float32Array): Float32Array {
    // Simplified LMS (Least Mean Squares) filter
    const output = new Float32Array(audioData.length);
    const filterLength = 32;
    const coefficients = new Float32Array(filterLength).fill(0);
    const stepSize = 0.01;

    for (let i = filterLength; i < audioData.length; i++) {
      let filterOutput = 0;
      
      // Convolve with filter coefficients
      for (let j = 0; j < filterLength; j++) {
        filterOutput += coefficients[j] * audioData[i - j];
      }

      // Error signal
      const error = desired[i] - filterOutput;

      // Update coefficients
      for (let j = 0; j < filterLength; j++) {
        coefficients[j] += stepSize * error * audioData[i - j];
      }

      output[i] = filterOutput;
    }

    return output;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<NoiseCancellationConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[Noise Cancellation] Config updated:', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): NoiseCancellationConfig {
    return { ...this.config };
  }

  /**
   * Reset noise profile
   */
  resetNoiseProfile(): void {
    this.noiseProfile = null;
    this.noiseProfileSamples = 0;
    console.log('[Noise Cancellation] Noise profile reset');
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    this.resetNoiseProfile();
    console.log('[Noise Cancellation] Cleaned up');
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if noise cancellation is available
   */
  static isAvailable(): boolean {
    return typeof AudioContext !== 'undefined' || 
           typeof (window as any).webkitAudioContext !== 'undefined';
  }
}
