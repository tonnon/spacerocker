import type { BossId } from '@/data/levels/types'
import type { AiContext } from '@/game/ai/types'
import type { Entity } from '@/game/entities/components'

/**
 * Bosses are composites: a hull plus independently destructible parts, each
 * with its own HP, hitbox and sprite (spec 8).
 *
 * Phase changes are driven by HP thresholds and always cost 1.2s of
 * invulnerability plus an animation and a sound, so the player is told that
 * the rules just changed.
 */

export type BossState = 'entering' | 'fighting' | 'shifting' | 'dying' | 'dead'

export const PHASE_SHIFT_TIME = 1.2

export interface BossRuntime {
  id: BossId
  name: string
  atlas: string
  /** Part entities by partId; the hull is 'hull'. */
  parts: Record<string, Entity>
  hp: number
  maxHp: number
  phase: number
  phaseCount: number
  /** Normalised thresholds, descending, e.g. [0.6, 0.25]. */
  thresholds: number[]
  state: BossState
  /** Seconds in the current state. */
  stateT: number
  /** Total seconds alive. */
  t: number
  x: number
  z: number
  px: number
  pz: number
  /** World units per hull width, used to place anchors. */
  hullWidth: number
  scale: number
  invuln: number
  /** Per-boss scratch. */
  a: number
  b: number
  c: number
  d: number
  /** Death sequence timer. */
  deathT: number
  deathDuration: number
}

export interface BossCtx extends AiContext {
  /** Fire a shot from a part, in world space. */
  fireFrom(part: Entity, vx: number, vz: number, damage: number, radius?: number): void
  /** Spawn an escort. */
  summon(kind: Parameters<AiContext['spawnEnemy']>[0], x: number, z: number): void
  shake(amount: number): void
}

export interface BossSpec {
  id: BossId
  atlas: string
  /** Shown in display size on the HP bar. */
  displayName: string
  level: number
  /** Relative size, spec 8: 1.0x / 1.8x / 2.6x. */
  scaleMul: number
  /** Seconds of scripted entry before the fight starts. */
  entryTime: number
  /** Depth it settles at. Huge bosses hold further out so the player
   *  keeps a lane to dodge in. */
  entryZ?: number
  /** Pull the camera back by this fraction while it is alive (spec 8). */
  cameraPull?: number
  /** Seconds of explosions on death. */
  deathTime: number
  /** Which part is the core, revealed late. */
  corePart: string
  /** Parts that start shielded, keyed by the phase that exposes them. */
  exposeAt?: Record<string, number>
  /**
   * Parts whose destruction unseals the core. Omit and it takes every other
   * armed part.
   *
   * The core must NOT be gated on an HP threshold. Its own HP counts towards
   * the bar, so a threshold low enough to matter can only be reached by
   * damaging the core itself - which the gate forbids. That deadlock made all
   * three bosses unkillable until a playtest caught it.
   */
  coreExposedBy?: string[]
  /**
   * Whether every guard must fall ('all', the default) or just one
   * ('any'). 'any' is for bosses where the guards are a way IN rather
   * than a lock - breach one vent and the core is open.
   */
  coreExposeMode?: 'all' | 'any'
  update(b: BossRuntime, ctx: BossCtx): void
  onPhaseShift?(b: BossRuntime, ctx: BossCtx): void
}

/** Recompute the phase from HP; returns true when it just changed. */
export function updatePhase(b: BossRuntime): boolean {
  const frac = b.maxHp > 0 ? b.hp / b.maxHp : 0
  let phase = 0
  for (let i = 0; i < b.thresholds.length; i++) {
    if (frac <= b.thresholds[i]) phase = i + 1
  }
  if (phase !== b.phase) {
    b.phase = phase
    return true
  }
  return false
}

/** Place a part at its anchor offset, in world units. */
export function anchorPart(b: BossRuntime, part: Entity): void {
  const bp = part.bossPart
  if (!bp) return
  part.transform.px = part.transform.x
  part.transform.pz = part.transform.z
  part.transform.x = b.x + bp.anchorX * b.hullWidth
  part.transform.z = b.z + bp.anchorZ * b.hullWidth
}

/** Live (undestroyed, damageable) parts. */
export function livingParts(b: BossRuntime): Entity[] {
  const out: Entity[] = []
  for (const key of Object.keys(b.parts)) {
    const p = b.parts[key]
    if (p.bossPart && !p.bossPart.destroyed && (p.health?.max ?? 0) > 0) out.push(p)
  }
  return out
}

export const partAlive = (b: BossRuntime, id: string): boolean => {
  const p = b.parts[id]
  return !!p && !!p.bossPart && !p.bossPart.destroyed
}

/** Even fan of `n` shots spanning `spread` radians around `centre`. */
export function fan(
  n: number,
  centre: number,
  spread: number,
  speed: number,
  out: Float32Array,
): number {
  const start = centre - spread / 2
  const step = n > 1 ? spread / (n - 1) : 0
  for (let i = 0; i < n; i++) {
    const a = start + i * step
    out[i * 2] = Math.cos(a) * speed
    out[i * 2 + 1] = Math.sin(a) * speed
  }
  return n
}
