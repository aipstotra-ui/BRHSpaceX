import { base64ToPcm16, PCM_RATE } from "@/lib/grok/audio-worklet";

export function createPlaybackContext(): AudioContext {
  return new AudioContext({ sampleRate: PCM_RATE });
}

export class PcmPlaybackQueue {
  private nextTime = 0;
  private active = 0;
  private idleWaiters: Array<() => void> = [];

  constructor(private readonly context: AudioContext) {}

  enqueueBase64Pcm(encoded: string): void {
    const pcm = base64ToPcm16(encoded);
    if (pcm.length === 0) {
      return;
    }
    const floats = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i += 1) {
      floats[i] = (pcm[i] ?? 0) / 32768;
    }
    const buffer = this.context.createBuffer(1, floats.length, this.context.sampleRate);
    buffer.copyToChannel(floats, 0);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    const start = Math.max(this.context.currentTime, this.nextTime);
    source.start(start);
    this.nextTime = start + buffer.duration;
    this.active += 1;
    source.onended = () => {
      this.active -= 1;
      if (this.active === 0) {
        this.flushIdle();
      }
    };
  }

  get pendingCount(): number {
    return this.active;
  }

  whenIdle(): Promise<void> {
    if (this.active === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.idleWaiters.push(resolve);
    });
  }

  private flushIdle(): void {
    const waiters = this.idleWaiters;
    this.idleWaiters = [];
    for (const resolve of waiters) {
      resolve();
    }
  }
}
