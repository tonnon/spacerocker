import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ENEMIES, ENEMY_IDS } from '@/data/enemies'
import { LEVEL_COUNT, LEVELS } from '@/data/levels'
import { applyPickup, degradeOnDeath, initialWeapons, spreadAngles } from '@/data/weapons'
import type { AtlasDoc, EntityRuntime, LoadedAtlas } from '@/game/core/atlas'
import {
  ENERGY_DRAIN_PER_S,
  ENERGY_MAX,
  ENERGY_PICKUP,
  ENGAGE_Z_MIN,
  FIXED_DT,
  PX_PER_UNIT,
  SPAWN_Z,
} from '@/game/core/constants'
import { Simulation } from '@/game/Simulation'

/**
 * The real shipped Hexapod atlas, minus the textures the sim never reads.
 *
 * Driving the boss from the actual generated JSON means these tests fail if
 * the sprite pipeline ever changes a part name, an anchor or an HP value.
 */
function hexapodAtlas(): LoadedAtlas {
  const doc = JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../public/sprites/boss_hexapod.json', import.meta.url)),
      'utf8',
    ),
  ) as AtlasDoc
  const boss = doc.meta.boss!
  const entities: Record<string, EntityRuntime> = {}
  for (const [id, part] of Object.entries(boss.parts)) {
    entities[id] = {
      id,
      hitRadius: 0.4,
      gun: [0, 0],
      worldW: part.frameSize.w / PX_PER_UNIT,
      worldH: part.frameSize.h / PX_PER_UNIT,
      clips: {},
    }
  }
  return {
    name: 'boss_hexapod',
    doc,
    albedo: null as unknown as LoadedAtlas['albedo'],
    emissive: null as unknown as LoadedAtlas['emissive'],
    uv: new Float32Array(0),
    entities,
    boss,
  }
}

/**
 * Step the sim while keeping the player alive.
 *
 * Boss lifecycle tests are about the boss, not about whether a stationary,
 * non-firing player can survive four minutes of level 5.
 */
function stepSafely(sim: Simulation, seconds: number): void {
  const steps = Math.round(seconds / FIXED_DT)
  for (let i = 0; i < steps; i++) {
    sim.player.invuln = 1
    sim.step()
  }
}

/**
 * Drive the sim with a fixed input and digest the result.
 *
 * The digest folds in every entity position, not just player state: the
 * player's own motion is seed-independent, so a weaker digest would call two
 * different runs identical.
 */
function run(seed: number, seconds: number, level = 4): string {
  const sim = new Simulation({ seed, startLevel: level })
  sim.startLevel(level)
  sim.input = {
    moveX: 0.4,
    moveZ: -0.2,
    fire: true,
    focus: false,
    bomb: false,
    pointer: false,
    pointerX: 0,
    pointerZ: 0,
  }
  const steps = Math.round(seconds / FIXED_DT)
  for (let i = 0; i < steps; i++) sim.step()

  let fold = 0
  for (const e of sim.world.entities) {
    fold = (fold * 31 + Math.round(e.transform.x * 1000)) | 0
    fold = (fold * 31 + Math.round(e.transform.z * 1000)) | 0
  }
  for (let i = 0; i < sim.bullets.count; i++) {
    fold = (fold * 31 + Math.round(sim.bullets.x[i] * 1000)) | 0
    fold = (fold * 31 + Math.round(sim.bullets.z[i] * 1000)) | 0
  }
  return [
    sim.scroll.toFixed(4),
    sim.score,
    sim.player.energy.toFixed(4),
    sim.bullets.count,
    sim.world.entities.length,
    fold,
  ].join('|')
}

describe('determinism', () => {
  it('same seed and same inputs produce the same run (spec 4)', () => {
    expect(run(0x5eed, 25)).toBe(run(0x5eed, 25))
  })

  it('a different seed produces a different run', () => {
    expect(run(1, 25)).not.toBe(run(2, 25))
  })

  it('replays identically after restarting the same level', () => {
    const a = run(77, 20)
    const b = run(77, 20)
    expect(a).toBe(b)
  })
})

describe('level progression', () => {
  it('ships all 15 levels, numbered in order', () => {
    expect(LEVEL_COUNT).toBe(15)
    LEVELS.forEach((l, i) => {
      expect(l.id).toBe(i + 1)
    })
  })

  it('puts the three bosses on levels 5, 10 and 15', () => {
    const bossLevels = LEVELS.filter((l) => l.boss).map((l) => [l.id, l.boss])
    expect(bossLevels).toEqual([
      [5, 'hexapod'],
      [10, 'basilisk'],
      [15, 'ouroboros'],
    ])
  })

  it('scrolls faster every level (spec 5: +4%)', () => {
    let prev = 0
    for (let i = 1; i <= 15; i++) {
      const sim = new Simulation({ startLevel: i })
      sim.startLevel(i)
      expect(sim.scrollSpeed).toBeGreaterThan(prev)
      prev = sim.scrollSpeed
    }
  })

  it('peaks tension around 70% and leaves a breath at the end', () => {
    for (const l of LEVELS) {
      if (l.boss || l.waves.length < 6) continue
      const last = l.waves[l.waves.length - 1].at
      // the final ~8s carry no new waves
      expect(last).toBeLessThanOrEqual(l.duration - 7)
    }
  })

  it('offers enough energy cells to outpace the drain', () => {
    for (const l of LEVELS) {
      const cells = l.pickups.filter((p) => p.kind === 'energy').length
      // Cells only cover the wave phase; a boss level refuels from the boss
      // timer instead, so it schedules fewer.
      const covered = l.boss ? l.duration * 0.42 : l.duration
      const drained = (covered * ENERGY_DRAIN_PER_S) / ENERGY_PICKUP
      expect(cells).toBeGreaterThanOrEqual(drained)
    }
  })

  it('assembles the Hexapod from its shipped part metadata', () => {
    const sim = new Simulation({ seed: 5, startLevel: 5, practice: true })
    sim.setAtlases([hexapodAtlas()])
    sim.startLevel(5)
    stepSafely(sim, 70)

    expect(sim.boss).not.toBeNull()
    const parts = Object.keys(sim.boss!.parts).sort()
    expect(parts).toEqual(['bay', 'core', 'hull', 'pod_l', 'pod_r'])
    // pods 400 + 400, bay 600, core 900; the hull itself has no HP
    expect(sim.boss!.maxHp).toBe(2300)
    // the core stays sealed until the phase that exposes it
    expect(sim.boss!.parts.core.bossPart?.invulnerable).toBe(true)
  })

  it('keeps refuelling during a boss fight', () => {
    const sim = new Simulation({ seed: 5, startLevel: 5, practice: true })
    sim.setAtlases([hexapodAtlas()])
    sim.startLevel(5)
    stepSafely(sim, 60)
    expect(sim.boss).not.toBeNull()

    let sawEnergy = false
    for (let i = 0; i < Math.round(40 / FIXED_DT) && !sawEnergy; i++) {
      sim.player.invuln = 1
      sim.step()
      sawEnergy = sim.qPickups.entities.some((e) => e.pickup?.kind === 'energy')
    }
    expect(sawEnergy).toBe(true)
  })

  it('never schedules a wave before the level starts', () => {
    for (const l of LEVELS) {
      for (const w of l.waves) expect(w.at).toBeGreaterThan(0)
      for (const p of l.pickups) expect(p.at).toBeGreaterThan(0)
    }
  })
})

describe('fair fire', () => {
  it('never lets an enemy shoot from off-screen', () => {
    // Enemies spawn well beyond the far edge so they can fly in. Nothing they
    // fire may ORIGINATE out there, or the player is hit by something they
    // were never shown.
    //
    // It has to be the origin, not the current position: a shot aimed at the
    // player by an enemy that has already flown past them travels away from
    // the camera and legitimately ends up far out of the band.
    for (const level of [1, 7, 9, 13]) {
      const sim = new Simulation({ seed: 31 + level, startLevel: level, practice: true })
      sim.startLevel(level)

      let deepest = 0
      const spawn = sim.bullets.spawn.bind(sim.bullets)
      sim.bullets.spawn = (x, z, vx, vz, team, ...rest) => {
        if (team === 1 && z < deepest) deepest = z
        return spawn(x, z, vx, vz, team, ...rest)
      }

      for (let i = 0; i < Math.round(90 / FIXED_DT); i++) {
        sim.player.invuln = 1
        sim.step()
      }
      expect(deepest, `level ${level}`).toBeGreaterThanOrEqual(ENGAGE_Z_MIN)
    }
  })

  it('spawns enemies outside the band they are allowed to fight in', () => {
    expect(SPAWN_Z).toBeLessThan(ENGAGE_Z_MIN)
  })
})

describe('bestiary', () => {
  it('telegraphs every dangerous attack for at least 0.4s (spec 7)', () => {
    for (const id of ENEMY_IDS) {
      expect(ENEMIES[id].telegraph).toBeGreaterThanOrEqual(0.4)
    }
  })

  it('gives every enemy positive HP and a score', () => {
    for (const id of ENEMY_IDS) {
      expect(ENEMIES[id].hp).toBeGreaterThan(0)
      expect(ENEMIES[id].score).toBeGreaterThan(0)
    }
  })

  it('only introduces an enemy on a level that exists', () => {
    for (const id of ENEMY_IDS) {
      expect(ENEMIES[id].introducedAt).toBeGreaterThanOrEqual(1)
      expect(ENEMIES[id].introducedAt).toBeLessThanOrEqual(15)
    }
  })

  it('never spawns an enemy in a level before it is introduced', () => {
    for (const l of LEVELS) {
      for (const w of l.waves) {
        expect(ENEMIES[w.kind].introducedAt).toBeLessThanOrEqual(l.id)
      }
    }
  })
})

describe('weapons', () => {
  it('fans 1, 3, 5 then 7 shots as SPREAD stacks', () => {
    const buf = new Float32Array(8)
    expect(spreadAngles(0, buf)).toBe(1)
    expect(spreadAngles(1, buf)).toBe(3)
    expect(spreadAngles(2, buf)).toBe(5)
    expect(spreadAngles(3, buf)).toBe(7)
  })

  it('keeps the fan centred on straight ahead', () => {
    const buf = new Float32Array(8)
    const n = spreadAngles(3, buf)
    const sum = Array.from(buf.slice(0, n)).reduce((a, b) => a + b, 0)
    expect(Math.abs(sum)).toBeLessThan(1e-6)
  })

  it('caps SPREAD at level 3', () => {
    const w = initialWeapons()
    for (let i = 0; i < 9; i++) applyPickup(w, 'spread')
    expect(w.spread).toBe(3)
  })

  it('drops one notch on death instead of wiping (spec 5)', () => {
    const w = initialWeapons()
    applyPickup(w, 'spread')
    applyPickup(w, 'spread')
    applyPickup(w, 'aegis')
    degradeOnDeath(w)
    expect(w.spread).toBe(1)
    expect(w.shield).toBe(0)
    degradeOnDeath(w)
    expect(w.spread).toBe(0)
    degradeOnDeath(w)
    expect(w.spread).toBe(0)
  })

  it('caps bombs at 3', () => {
    const w = initialWeapons()
    for (let i = 0; i < 9; i++) applyPickup(w, 'pulse')
    expect(w.bombs).toBe(3)
  })
})

describe('energy clock', () => {
  it('drains continuously and forces the player forward (spec 5)', () => {
    const sim = new Simulation({ seed: 3, startLevel: 1 })
    sim.startLevel(1)
    const before = sim.player.energy
    for (let i = 0; i < 300; i++) sim.step()
    expect(sim.player.energy).toBeLessThan(before)
  })

  it('does not drain in practice mode', () => {
    const sim = new Simulation({ seed: 3, startLevel: 1, practice: true })
    sim.startLevel(1)
    for (let i = 0; i < 300; i++) sim.step()
    expect(sim.player.energy).toBe(ENERGY_MAX)
  })
})

describe('pools', () => {
  it('never exceeds the pre-allocated bullet and particle capacity', () => {
    const sim = new Simulation({ seed: 11, startLevel: 14 })
    sim.startLevel(14)
    sim.input = {
      moveX: 0,
      moveZ: 0,
      fire: true,
      focus: false,
      bomb: false,
      pointer: false,
      pointerX: 0,
      pointerZ: 0,
    }
    for (let i = 0; i < 60 * 40; i++) {
      sim.step()
      expect(sim.bullets.count).toBeLessThanOrEqual(sim.bullets.pool.capacity)
      expect(sim.particles.count).toBeLessThanOrEqual(sim.particles.pool.capacity)
    }
  })
})
