/**
 * AudioWorklet processor for capturing microphone input as PCM16 at 24kHz.
 * Batches ~2400 samples (100ms) and posts Int16 PCM buffers to the main thread.
 */
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(0);
    this._batchSize = 2400; // 100ms at 24kHz
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel || channel.length === 0) return true;

    // Append incoming samples to internal buffer
    const newBuffer = new Float32Array(this._buffer.length + channel.length);
    newBuffer.set(this._buffer);
    newBuffer.set(channel, this._buffer.length);
    this._buffer = newBuffer;

    // When enough samples accumulated, send a batch
    while (this._buffer.length >= this._batchSize) {
      const batch = this._buffer.slice(0, this._batchSize);
      this._buffer = this._buffer.slice(this._batchSize);

      // Convert Float32 [-1,1] to Int16 PCM
      const pcm16 = new Int16Array(batch.length);
      for (let i = 0; i < batch.length; i++) {
        const s = Math.max(-1, Math.min(1, batch[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      this.port.postMessage(
        { type: "pcm16", buffer: pcm16.buffer },
        [pcm16.buffer]
      );
    }

    return true;
  }
}

registerProcessor("audio-capture-processor", AudioCaptureProcessor);
