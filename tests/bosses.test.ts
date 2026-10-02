import { describe, expect, it } from 'vitest'
import type { BossId } from '@/data/levels/types'
import { BOSSES } from '@/game/bosses'
import { type BossRuntime, PHASE_SHIFT_TIME, updatePhase } from '@/game/bosses/fsm'

function runtime(id: BossId, thresholds: number[], maxHp = 1000): BossRuntime {
  return {
    id,
    name: BOSSES[id].displayName,
    atlas: BOSSES[id].atlas,
    parts: {},
    hp: maxHp,
    maxHp,
    phase: 0,
    phaseCount: thresholds.length + 1,
    thresholds,
    state: 'fighting',
    stateT: 0,
    t: 0,
    x: 0,
    z: -15,
    px: 0,
    pz: -15,
    hullWidth: 10,
    scale: 1,
    invuln: 0,
    a: 0,
    b: 0,
    c: 1,
    d: 0,
    deathT: 0,
    deathDuration: BOSSES[id].deathTime,
  }
}

describe('boss registry', () => {
  it('scales visibly across the three fights (spec 8)', () => {
    expect(BOSSES.hexapod.scaleMul).toBe(1.0)
    expect(BOSSES.basilisk.scaleMul).toBe(1.8)
    expect(BOSSES.ouroboros.scaleMul).toBe(2.6)
    expect(BOSSES.hexapod.scaleMul).toBeLessThan(BOSSES.basilisk.scaleMul)
    expect(BOSSES.basilisk.scaleMul).toBeLessThan(BOSSES.ouroboros.scaleMul)
  })

  it('places each boss on its scripted level', () => {
    expect(BOSSES.hexapod.level).toBe(5)
    expect(BOSSES.basilisk.level).toBe(10)
    expect(BOSSES.ouroboros.level).toBe(15)
  })

  it('gives the Ouroboros a 12s reveal and a 6s death', () => {
    expect(BOSSES.ouroboros.entryTime).toBe(12)
    expect(BOSSES.ouroboros.deathTime).toBe(6)
  })
})

describe('updatePhase', () => {
  it('advances the Hexapod at 60% and 25%', () => {
    const b = runtime('hexapod', [0.6, 0.25])
    expect(b.phase).toBe(0)

    b.hp = 700
    expect(updatePhase(b)).toBe(false)
    expect(b.phase).toBe(0)

    b.hp = 600
    expect(updatePhase(b)).toBe(true)
    expect(b.phase).toBe(1)

    b.hp = 300
    expect(updatePhase(b)).toBe(false)
    expect(b.phase).toBe(1)

    b.hp = 250
    expect(updatePhase(b)).toBe(true)
    expect(b.phase).toBe(2)
  })

  it('walks the Basilisk through all four phases', () => {
    const b = runtime('basilisk', [0.7, 0.4, 0.15])
    const seen: number[] = []
    for (const hp of [1000, 700, 400, 150, 0]) {
      b.hp = hp
      updatePhase(b)
      seen.push(b.phase)
    }
    expect(seen).toEqual([0, 1, 2, 3, 3])
  })

  it('walks the Ouroboros through all five phases', () => {
    const b = runtime('ouroboros', [0.75, 0.5, 0.3, 0.1])
    const seen: number[] = []
    for (const hp of [1000, 750, 500, 300, 100, 1]) {
      b.hp = hp
      updatePhase(b)
      seen.push(b.phase)
    }
    expect(seen).toEqual([0, 1, 2, 3, 4, 4])
  })

  it('never skips backwards while HP only falls', () => {
    const b = runtime('ouroboros', [0.75, 0.5, 0.3, 0.1])
    let last = 0
    for (let hp = 1000; hp >= 0; hp -= 7) {
      b.hp = hp
      updatePhase(b)
      expect(b.phase).toBeGreaterThanOrEqual(last)
      last = b.phase
    }
    expect(last).toBe(4)
  })

  it('reports a change exactly once per crossed threshold', () => {
    const b = runtime('hexapod', [0.6, 0.25])
    let changes = 0
    for (let hp = 1000; hp >= 0; hp -= 1) {
      b.hp = hp
      if (updatePhase(b)) changes++
    }
    expect(changes).toBe(2)
  })

  it('survives a zero-max-HP boss without dividing by zero', () => {
    const b = runtime('hexapod', [0.6, 0.25], 0)
    b.hp = 0
    expect(() => updatePhase(b)).not.toThrow()
    expect(b.phase).toBe(2)
  })
})

describe('phase shift contract', () => {
  it('buys the player 1.2s of invulnerability to read the change', () => {
    expect(PHASE_SHIFT_TIME).toBe(1.2)
  })

  it('never gates the core behind an HP threshold', () => {
    // The core's own HP counts towards the bar, so a phase gate on it can only
    // be crossed by damaging the core - which the gate forbids. That deadlock
    // made all three bosses literally unkillable.
    for (const id of ['hexapod', 'basilisk', 'ouroboros'] as BossId[]) {
      const spec = BOSSES[id]
      expect(spec.corePart).toBe('core')
      expect(spec.exposeAt?.[spec.corePart]).toBeUndefined()
    }
  })
})
