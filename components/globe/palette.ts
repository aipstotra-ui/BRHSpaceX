export const PALETTE = {
  accent: 0x4ec1f5,
  caution: 0xf5b700,
  critical: 0xff6a45,
  ink: 0xffffff,
  line: 0x2c2f33,
  muted: 0x8d9298,
  shell43: 0x7eb6d4,
  shell70: 0xb7c3ce,
  shell97: 0xd5e8f5,
  shell30: 0x6a7076,
  bus: 0x1c1f22,
  radiator: 0xc5ccd2,
} as const;

export function shellColorHex(shell: number | string, raising: boolean): number {
  if (raising) {
    return PALETTE.caution;
  }
  const value = typeof shell === "number" ? shell : Number(shell);
  if (value === 53) {
    return PALETTE.accent;
  }
  if (value === 43) {
    return PALETTE.shell43;
  }
  if (value === 70) {
    return PALETTE.shell70;
  }
  if (value === 97.5) {
    return PALETTE.shell97;
  }
  if (value === 30) {
    return PALETTE.shell30;
  }
  return PALETTE.muted;
}

export function exposureColorHex(exposure: string): number {
  if (exposure === "SAA") {
    return PALETTE.critical;
  }
  if (exposure === "auroral") {
    return PALETTE.accent;
  }
  if (exposure === "outer") {
    return PALETTE.caution;
  }
  return PALETTE.ink;
}

export function hexToRgb(hex: number): [number, number, number] {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}
