/** Seeded RNG. Same seed + same inputs = same run (spec §4: determinism). */

export interface Rng {
  next(): number
  range(lo: number, hi: number): number
  int(lo: number, hi: number): number
  pick<T>(items: readonly T[]): T
  chance(p: number): boolean
  fork(salt: number): Rng
  readonly seed: number
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    seed,
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
    chance: (p) => next() < p,
    fork: (salt) => mulberry32((seed ^ (salt * 0x9e3779b1)) >>> 0),
  }
}

/** Deterministic 1D value noise, used by the canyon and by terrain detail. */
export function valueNoise1(seed: number) {
  const hash = (i: number): number => {
    let h = (i * 0x27d4eb2d) ^ seed
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
  }
  return (x: number): number => {
    const i = Math.floor(x)
    const f = x - i
    const s = f * f * (3 - 2 * f)
    return hash(i) * (1 - s) + hash(i + 1) * s
  }
}
