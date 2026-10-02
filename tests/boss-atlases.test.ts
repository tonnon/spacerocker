import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { BossId } from '@/data/levels/types'
import { BOSSES } from '@/game/bosses'
import type { AtlasDoc, BossDef } from '@/game/core/atlas'
import { PLAY_HALF_W, PX_PER_UNIT } from '@/game/core/constants'

/**
 * The boss FSMs address parts by name (`pod_l`, `turret_a`, `cannon_f`...).
 * Those names live in two places: the Python generator and the TypeScript
 * behaviour. Nothing but this test stops them drifting apart, and when they
 * drift the boss silently stops shooting instead of crashing.
 */
function bossMeta(atlas: string): BossDef {
  const doc = JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../public/sprites/${atlas}.json`, import.meta.url)),
      'utf8',
    ),
  ) as AtlasDoc
  const boss = doc.meta.boss
  if (!boss) throw new Error(`${atlas} has no boss metadata`)
  return boss
}

/** Part names each FSM reaches for by hand. */
const REQUIRED: Record<BossId, string[]> = {
  hexapod: ['hull', 'pod_l', 'pod_r', 'bay', 'core'],
  basilisk: [
    'head',
    'seg_a',
    'seg_b',
    'seg_c',
    'seg_d',
    'turret_a',
    'turret_b',
    'turret_c',
    'turret_d',
    'thruster_l',
    'thruster_r',
    'core',
  ],
  ouroboros: [
    'hull',
    'cannon_a',
    'cannon_b',
    'cannon_c',
    'cannon_d',
    'cannon_e',
    'cannon_f',
    'arm_l',
    'arm_r',
    'vent_a',
    'vent_b',
    'vent_c',
    'vent_d',
    'core',
  ],
}

const IDS = Object.keys(REQUIRED) as BossId[]

describe.each(IDS)('%s atlas', (id) => {
  const spec = BOSSES[id]
  const meta = bossMeta(spec.atlas)

  it('publishes every part the FSM addresses by name', () => {
    for (const part of REQUIRED[id]) {
      expect(Object.keys(meta.parts)).toContain(part)
    }
  })

  it('agrees with the FSM on id, level and scale', () => {
    expect(meta.id).toBe(id)
    expect(meta.level).toBe(spec.level)
    expect(meta.scale).toBe(spec.scaleMul)
  })

  it('declares the core the FSM exposes late', () => {
    expect(meta.parts[spec.corePart]).toBeDefined()
    expect(meta.parts[spec.corePart].hp).toBeGreaterThan(0)
  })

  it('has one phase band more than the FSM has thresholds', () => {
    expect(meta.phases.length).toBeGreaterThanOrEqual(3)
    // bands must tile 1..0 without a gap
    expect(meta.phases[0].from).toBe(1)
    expect(meta.phases[meta.phases.length - 1].to).toBe(0)
    for (let i = 1; i < meta.phases.length; i++) {
      expect(meta.phases[i].from).toBe(meta.phases[i - 1].to)
    }
  })

  it('gives every armed part an animation set with a charge telegraph', () => {
    for (const [name, part] of Object.entries(meta.parts)) {
      expect(part.animations.idle).toBeDefined()
      if (part.hp > 0) {
        expect(part.animations.charge, `${name} needs a charge pose`).toBeDefined()
        expect(part.animations.destroyed).toBeDefined()
      }
    }
  })

  it('keeps every anchor inside a sane range', () => {
    for (const [name, part] of Object.entries(meta.parts)) {
      const [ax, az] = part.anchor
      expect(Math.abs(ax), `${name} anchor x`).toBeLessThanOrEqual(1.2)
      expect(Math.abs(az), `${name} anchor z`).toBeLessThanOrEqual(1.2)
    }
  })
})

describe('boss scale ladder', () => {
  it('grows 1.0x -> 1.8x -> 2.6x across the acts', () => {
    const scales = IDS.map((id) => bossMeta(BOSSES[id].atlas).scale)
    expect(scales).toEqual([1.0, 1.8, 2.6])
  })

  it('makes the Ouroboros wider than the screen', () => {
    expect(bossMeta('boss_ouroboros').screenWidthFraction).toBeGreaterThan(1)
    expect(bossMeta('boss_hexapod').screenWidthFraction).toBeCloseTo(0.45)
    expect(bossMeta('boss_basilisk').screenWidthFraction).toBeCloseTo(0.78)
  })
})

describe('core reachability', () => {
  it.each(IDS)('%s: stripping every other part drops the bar past phase 2', (id) => {
    // If the core alone still sits above the first threshold, the fight can
    // never advance and the core never opens.
    const meta = bossMeta(BOSSES[id].atlas)
    const total = Object.values(meta.parts).reduce((a, p) => a + p.hp, 0)
    const core = meta.parts[BOSSES[id].corePart].hp
    const firstThreshold = meta.phases[1].from

    expect(core).toBeGreaterThan(0)
    expect(core / total).toBeLessThanOrEqual(firstThreshold)
  })

  it.each(IDS)('%s: every damageable part sits inside the playfield', (id) => {
    // A part anchored beyond the lane is HP the player cannot reach, which is
    // the other way a boss becomes unkillable.
    const spec = BOSSES[id]
    const meta = bossMeta(spec.atlas)
    const hullKey = 'hull' in meta.parts ? 'hull' : Object.keys(meta.parts)[0]
    const hullWidth = (meta.parts[hullKey].frameSize.w / PX_PER_UNIT) * spec.scaleMul * 1.4

    for (const [name, part] of Object.entries(meta.parts)) {
      if (part.hp <= 0) continue
      // the Basilisk's body is repositioned every frame by its FSM, so its
      // published anchors are only a resting pose
      if (id === 'basilisk') continue
      const x = Math.abs(part.anchor[0] * hullWidth)
      expect(x, `${id}.${name} at x=${x.toFixed(1)}`).toBeLessThanOrEqual(PLAY_HALF_W + 0.5)
    }
  })
})
