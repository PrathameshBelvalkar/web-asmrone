/** Audio is handled as raw 16 kHz mono signed 16-bit PCM, which is what Whisper wants. */
export const SAMPLE_RATE = 16_000;
export const BYTES_PER_MS = (SAMPLE_RATE * 2) / 1000; // 32

export function msToBytes(ms: number): number {
  // Whole samples only.
  return Math.floor(ms * (SAMPLE_RATE / 1000)) * 2;
}

export function bytesToMs(bytes: number): number {
  return Math.floor(bytes / BYTES_PER_MS);
}

/** Wraps raw PCM in a WAV header. */
export function wavFromPcm(pcm: Buffer): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

const FRAME_MS = 20;
const QUIET_SPAN_MS = 300;

/**
 * The quietest moment in `pcm` (which starts at `offsetMs`): the centre of the 300 ms stretch with
 * the least energy. Used to cut audio into pieces between words rather than in the middle of one.
 */
export function quietestPoint(pcm: Buffer, offsetMs: number): number {
  const frameBytes = msToBytes(FRAME_MS);
  const frames = Math.floor(pcm.length / frameBytes);
  if (frames === 0) return offsetMs;
  const energy: number[] = [];
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let i = f * frameBytes; i < (f + 1) * frameBytes; i += 2) {
      const s = pcm.readInt16LE(i);
      sum += s * s;
    }
    energy.push(sum);
  }
  const span = Math.max(1, Math.min(frames, Math.round(QUIET_SPAN_MS / FRAME_MS)));
  let windowSum = 0;
  for (let f = 0; f < span; f++) windowSum += energy[f] ?? 0;
  let best = windowSum;
  let bestStart = 0;
  for (let f = span; f < frames; f++) {
    windowSum += (energy[f] ?? 0) - (energy[f - span] ?? 0);
    if (windowSum < best) {
      best = windowSum;
      bestStart = f - span + 1;
    }
  }
  return offsetMs + Math.round((bestStart + span / 2) * FRAME_MS);
}
