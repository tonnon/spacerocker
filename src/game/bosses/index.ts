import type { BossId } from '@/data/levels/types'
import { basilisk } from './basilisk'
import type { BossSpec } from './fsm'
import { hexapod } from './hexapod'
import { ouroboros } from './ouroboros'

export * from './fsm'

export const BOSSES: Record<BossId, BossSpec> = {
  hexapod,
  basilisk,
  ouroboros,
}
