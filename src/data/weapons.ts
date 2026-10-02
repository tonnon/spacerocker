import type { PickupKind } from '@/game/entities/components'

/** Player armament (spec 5). Dying drops a level, it never zeroes. */

export interface WeaponState {
  /** 0 -> single shot, 1..3 -> 3 / 5 / 7 way spread. */
  spread: number
  /** Seconds left on LANCE. */
  lance: number
  /** Seconds left on SEEKER. */
  seeker: number
  /** Hits the AEGIS shield can still absorb. */
  shield: number
  wingman: boolean
  bombs: number
}

export const SPREAD_SHOTS = [1, 3, 5, 7] as const
export const MAX_SPREAD = 3
export const LANCE_TIME = 20
export const SEEKER_TIME = 25
export const AEGIS_HITS = 3
export const MAX_BOMBS = 3

export const PLAYER_SHOT_SPEED = 66
export const PLAYER_SHOT_DAMAGE = 10
export const PLAYER_FIRE_RATE = 0.115
export const LANCE_DPS = 190
export const LANCE_RANGE = 18
export const SEEKER_DAMAGE = 24
export const SEEKER_RATE = 0.85

export const initialWeapons = (): WeaponState => ({
  spread: 0,
  lance: 0,
  seeker: 0,
  shield: 0,
  wingman: false,
  bombs: 1,
})

export function applyPickup(w: WeaponState, kind: PickupKind): void {
  switch (kind) {
    case 'spread':
      w.spread = Math.min(MAX_SPREAD, w.spread + 1)
      break
    case 'lance':
      w.lance = LANCE_TIME
      break
    case 'seeker':
      w.seeker = SEEKER_TIME
      break
    case 'aegis':
      w.shield = AEGIS_HITS
      break
    case 'wingman':
      w.wingman = true
      break
    case 'pulse':
      w.bombs = Math.min(MAX_BOMBS, w.bombs + 1)
      break
    case 'energy':
      break
  }
}

/** On death: one notch down, not a wipe. A wipe ends the session. */
export function degradeOnDeath(w: WeaponState): void {
  w.spread = Math.max(0, w.spread - 1)
  w.lance = 0
  w.seeker = 0
  w.shield = 0
  w.wingman = false
}

/** Fan of angles, in radians, for the current spread level. */
export function spreadAngles(level: number, out: Float32Array): number {
  const n = SPREAD_SHOTS[Math.max(0, Math.min(MAX_SPREAD, level))]
  const step = 0.116
  const start = -((n - 1) / 2) * step
  for (let i = 0; i < n; i++) out[i] = start + i * step
  return n
}
