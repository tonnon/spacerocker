import type { EnemyId } from '@/data/enemies'
import type { PickupKind } from '@/game/entities/components'
import type { TerrainParams } from '@/game/world/canyon'
import type { ActId } from '@/theme/palette'

export type BossId = 'hexapod' | 'basilisk' | 'ouroboros'

/** How a wave arranges its members when it enters. */
export type Formation = 'line' | 'v' | 'column' | 'arc' | 'swarm' | 'sides' | 'wall'

export interface Wave {
  /** Seconds from level start. */
  at: number
  kind: EnemyId
  count: number
  formation: Formation
  /** Entry x, normalised -1..1 across the corridor. */
  x: number
  /** Spacing between members, in world units. */
  spacing: number
}

export interface PickupDrop {
  at: number
  kind: PickupKind
  /** Normalised -1..1 across the corridor. */
  x: number
}

export interface LevelDefinition {
  id: number
  act: ActId
  name: string
  biome: string
  /** Target length in seconds, excluding the boss fight. */
  duration: number
  terrain: TerrainParams
  waves: Wave[]
  pickups: PickupDrop[]
  boss?: BossId
  /** Fenda abissal: reduced visibility. */
  dark?: boolean
  /** Melting Core: the corridor closes as you go. */
  collapsing?: boolean
  /** Deterministic seed for this level's spawn jitter and terrain. */
  seed: number
}
