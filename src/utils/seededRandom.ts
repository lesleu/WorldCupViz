/** Deterministic PRNG — same seed always yields the same sequence. */
export function createRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function randBetween(rng: () => number, min: number, max: number) {
  return min + rng() * (max - min);
}

/** Stable hash for deterministic frame shake without Math.random(). */
export function seededNoise(seed: number, t: number): number {
  const x = Math.sin(seed * 12.9898 + t * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
