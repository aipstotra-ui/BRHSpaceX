/** Linear blend of scene-space Starlink positions between two worker ticks. */
export function lerpScene(from: Float32Array, to: Float32Array, t: number, out: Float32Array): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  const count = Math.floor(Math.min(from.length, to.length, out.length) / 3);
  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    out[offset] = from[offset] + (to[offset] - from[offset]) * clamped;
    out[offset + 1] = from[offset + 1] + (to[offset + 1] - from[offset + 1]) * clamped;
    out[offset + 2] = from[offset + 2] + (to[offset + 2] - from[offset + 2]) * clamped;
  }
  return count;
}
