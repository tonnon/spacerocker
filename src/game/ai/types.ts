import type { EnemyId } from '@/data/enemies'
import type { Rng } from '@/game/core/rng'
import type { Entity } from '@/game/entities/components'
import type { Particles } from '@/game/systems/particles'

/**
 * What a behaviour is allowed to touch. Narrow on purpose: the AI never sees
 * the whole Simulation, so a behaviour cannot quietly reach into collision or
 * scoring.
 */
export interface AiContext {
  rng: Rng
  dt: number
  /** Seconds since the level started. */
  time: number
  playerX: number
  playerZ: number
  playerAlive: boolean
  scroll: number
  scrollSpeed: number
  particles: Particles
  fireEnemy(
    x: number,
    z: number,
    vx: number,
    vz: number,
    damage: number,
    radius?: number,
    kind?: number,
  ): void
  spawnMine(x: number, z: number): void
  spawnEnemy(kind: EnemyId, x: number, z: number): Entity | null
  sfx(name: string): void
  /** Corridor half width at this depth, for edge-aware movement. */
  halfWidthAt(z: number): number
  centerAt(z: number): number
}

export type Behaviour = (e: Entity, ctx: AiContext) => void
