export function rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function deg(radian: number): number {
  return (radian * 180) / Math.PI;
}

export function wrap360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function wrap180(deg: number): number {
  return wrap360(deg + 180) - 180;
}
