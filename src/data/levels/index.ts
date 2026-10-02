import { level01 } from './level-01'
import { level02 } from './level-02'
import { level03 } from './level-03'
import { level04 } from './level-04'
import { level05 } from './level-05'
import { level06 } from './level-06'
import { level07 } from './level-07'
import { level08 } from './level-08'
import { level09 } from './level-09'
import { level10 } from './level-10'
import { level11 } from './level-11'
import { level12 } from './level-12'
import { level13 } from './level-13'
import { level14 } from './level-14'
import { level15 } from './level-15'
import type { LevelDefinition } from './types'

export * from './types'

/** All 15 levels, in order. Levels are data, not code (spec 4). */
export const LEVELS: LevelDefinition[] = [
  level01,
  level02,
  level03,
  level04,
  level05,
  level06,
  level07,
  level08,
  level09,
  level10,
  level11,
  level12,
  level13,
  level14,
  level15,
]

export const levelById = (id: number): LevelDefinition =>
  LEVELS[Math.max(0, Math.min(LEVELS.length - 1, id - 1))]

export const LEVEL_COUNT = LEVELS.length
