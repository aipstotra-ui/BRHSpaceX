/** PCM rate from the voice session spec. */
export const PCM_RATE = 24000;

/** estimate: mic chunks are sent about this often. */
export const CHUNK_INTERVAL_MS = 100;

const PCM_MIN = -32768;
const PCM_MAX = 32767;

export function chunkSampleCount(
  rate = PCM_RATE,
  intervalMs = CHUNK_INTERVAL_MS,
): number {
  return Math.round((rate * intervalMs) / 1000);
}

export function floatToPcm16(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, sample));
  const scaled = clamped < 0 ? clamped * 32768 : clamped * 32767;
  return Math.max(PCM_MIN, Math.min(PCM_MAX, Math.round(scaled)));
}

export function downsampleFloatToPcm16(
  input: Float32Array,
  inputRate: number,
  outputRate = PCM_RATE,
): Int16Array {
  if (input.length === 0) {
    return new Int16Array(0);
  }
  if (inputRate === outputRate) {
    const same = new Int16Array(input.length);
    for (let i = 0; i < input.length; i += 1) {
      same[i] = floatToPcm16(input[i] ?? 0);
    }
    return same;
  }
  const ratio = inputRate / outputRate;
  const length = Math.max(1, Math.floor(input.length / ratio));
  const out = new Int16Array(length);
  for (let i = 0; i < length; i += 1) {
    const pos = i * ratio;
    const index = Math.floor(pos);
    const frac = pos - index;
    const a = input[index] ?? 0;
    const b = input[Math.min(index + 1, input.length - 1)] ?? a;
    out[i] = floatToPcm16(a + (b - a) * frac);
  }
  return out;
}

export function pcm16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.length * 2);
  for (let i = 0; i < pcm.length; i += 1) {
    const value = pcm[i] ?? 0;
    bytes[i * 2] = value & 0xff;
    bytes[i * 2 + 1] = (value >> 8) & 0xff;
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

export function base64ToPcm16(encoded: string): Int16Array {
  const binary = atob(encoded);
  const length = Math.floor(binary.length / 2);
  const pcm = new Int16Array(length);
  for (let i = 0; i < length; i += 1) {
    const lo = binary.charCodeAt(i * 2);
    const hi = binary.charCodeAt(i * 2 + 1);
    const value = (hi << 8) | lo;
    pcm[i] = value > 32767 ? value - 65536 : value;
  }
  return pcm;
}

export function takeChunks(pending: Int16Array, chunkSize: number): {
  chunks: Int16Array[];
  rest: Int16Array;
} {
  const chunks: Int16Array[] = [];
  let offset = 0;
  while (pending.length - offset >= chunkSize) {
    chunks.push(pending.slice(offset, offset + chunkSize));
    offset += chunkSize;
  }
  return { chunks, rest: pending.slice(offset) };
}

export const WORKLET_SOURCE = `
const PCM_RATE = 24000;
const CHUNK_SAMPLES = 2400;

function floatToPcm16(sample) {
  const clamped = Math.max(-1, Math.min(1, sample));
  const scaled = clamped < 0 ? clamped * 32768 : clamped * 32767;
  return Math.max(-32768, Math.min(32767, Math.round(scaled)));
}

function downsample(input, inputRate) {
  if (inputRate === PCM_RATE) {
    const same = new Int16Array(input.length);
    for (let i = 0; i < input.length; i += 1) same[i] = floatToPcm16(input[i] || 0);
    return same;
  }
  const ratio = inputRate / PCM_RATE;
  const length = Math.max(1, Math.floor(input.length / ratio));
  const out = new Int16Array(length);
  for (let i = 0; i < length; i += 1) {
    const pos = i * ratio;
    const index = Math.floor(pos);
    const frac = pos - index;
    const a = input[index] || 0;
    const b = input[Math.min(index + 1, input.length - 1)] || a;
    out[i] = floatToPcm16(a + (b - a) * frac);
  }
  return out;
}

function toBase64(pcm) {
  const bytes = new Uint8Array(pcm.length * 2);
  for (let i = 0; i < pcm.length; i += 1) {
    const value = pcm[i];
    bytes[i * 2] = value & 255;
    bytes[i * 2 + 1] = (value >> 8) & 255;
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

class PcmDownsampleProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pending = new Int16Array(0);
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel || channel.length === 0) return true;
    const pcm = downsample(channel, sampleRate);
    const merged = new Int16Array(this.pending.length + pcm.length);
    merged.set(this.pending, 0);
    merged.set(pcm, this.pending.length);
    let offset = 0;
    while (merged.length - offset >= CHUNK_SAMPLES) {
      const chunk = merged.slice(offset, offset + CHUNK_SAMPLES);
      this.port.postMessage({ audio: toBase64(chunk) });
      offset += CHUNK_SAMPLES;
    }
    this.pending = merged.slice(offset);
    return true;
  }
}

registerProcessor("pcm-downsample", PcmDownsampleProcessor);
`;

export function workletModuleUrl(): string {
  const blob = new Blob([WORKLET_SOURCE], { type: "application/javascript" });
  return URL.createObjectURL(blob);
}
