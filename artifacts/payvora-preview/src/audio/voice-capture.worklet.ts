class PayvoraVoiceCaptureProcessor extends AudioWorkletProcessor {
  // Simple VAD parameters
  static get parameterDescriptors() { return []; }
  private _vadState: 'silence' | 'speech';
  private _silenceStart: number;
  private _threshold: number;

  constructor() {
    super();
    this._vadState = 'silence';
    this._silenceStart = 0;
    this._threshold = 0.01; // configurable threshold
  }

  process(inputs: Float32Array[][]/*, outputs, parameters */) {
    try {
      const input = inputs[0];
      if (!input || input.length === 0) return true;
      const channel = input[0];
      if (!channel || channel.length === 0) return true;

      // Convert Float32 samples to Int16 little-endian ArrayBuffer
      const len = channel.length;
      const ab = new ArrayBuffer(len * 2);
      const view = new DataView(ab);
      let offset = 0;
      let sum = 0.0;
      for (let i = 0; i < len; i++) {
        let s = Math.max(-1, Math.min(1, channel[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
        sum += channel[i] * channel[i];
      }

      // Post the raw PCM16 buffer to the main thread (transfer the buffer)
      this.port.postMessage({ type: 'audio', data: ab }, [ab]);

      // Lightweight RMS VAD (do not block)
      const rms = Math.sqrt(sum / len);
      // currentTime is available in AudioWorkletProcessor as a global
      const now = currentTime * 1000; // convert to ms
      if (rms > this._threshold) {
        if (this._vadState === 'silence') {
          this._vadState = 'speech';
          this.port.postMessage({ type: 'speech.start' });
        }
        this._silenceStart = 0;
      } else {
        if (this._vadState === 'speech') {
          if (!this._silenceStart) this._silenceStart = now;
          else if (now - this._silenceStart > 600) {
            this._vadState = 'silence';
            this._silenceStart = 0;
            this.port.postMessage({ type: 'speech.end' });
          }
        }
      }
    } catch (err) {
      // ignore worklet errors
    }
    return true;
  }
}

registerProcessor('payvora-voice-capture', PayvoraVoiceCaptureProcessor);
