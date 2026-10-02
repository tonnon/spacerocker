import { PLAY_HALF_W } from '@/game/core/constants'
import { type BossRuntime, type BossSpec, fan, partAlive } from './fsm'

/**
 * BOSS 3 - OUROBOROS (level 15), scale 2.6x.
 *
 * Foundry leviathan, larger than the screen. Phase 5 is the climax: the arena
 * narrows to a 30% corridor while it charges an 8s beam.
 */

const scratch = new Float32Array(96)
const CANNONS = ['cannon_a', 'cannon_b', 'cannon_c', 'cannon_d', 'cannon_e', 'cannon_f']
const VENTS = ['vent_a', 'vent_b', 'vent_c', 'vent_d']
const ARMS = ['arm_l', 'arm_r']

/** The final beam's safe corridor, in world units from the centre. */
export const FINALE_CORRIDOR = PLAY_HALF_W * 0.3

function chargeAll(b: BossRuntime, ids: string[]): void {
  for (const id of ids) {
    if (!partAlive(b, id)) continue
    const p = b.parts[id]
    if (p.sprite.state !== 'charge') {
      p.sprite.state = 'charge'
      p.sprite.time = 0
    }
  }
}

export const ouroboros: BossSpec = {
  id: 'ouroboros',
  atlas: 'boss_ouroboros',
  displayName: 'OUROBOROS',
  level: 15,
  scaleMul: 2.6,
  // 12s of scroll just to reveal it (spec 8)
  entryTime: 12,
  entryZ: -29,
  cameraPull: 0.4,
  deathTime: 6,
  corePart: 'core',
  // spec 8 calls these "core vents": they are the way in,
  // not a four-lock gate. Breach one during its window and the core is
  // open. Requiring all four made the fight unfinishable.
  coreExposedBy: ['vent_a', 'vent_b', 'vent_c', 'vent_d'],
  coreExposeMode: 'any',

  update(b, ctx) {
    b.a -= ctx.dt
    b.b -= ctx.dt
    b.d -= ctx.dt

    b.x += (Math.sin(b.t * 0.3) * 3.4 - b.x) * 0.8 * ctx.dt
    b.z = -29 + Math.sin(b.t * 0.45) * 1.6

    // Vents only open in 6s windows, and only from phase 2.
    // ~6s open, ~6s shut (spec 8)
    const ventsOpen = b.phase >= 1 && Math.sin(b.t * 0.52) > 0
    for (const id of VENTS) {
      const p = b.parts[id]
      if (!p || p.bossPart!.destroyed) continue
      p.bossPart!.invulnerable = !ventsOpen
      if (p.sprite.state !== (ventsOpen ? 'charge' : 'idle')) {
        p.sprite.state = ventsOpen ? 'charge' : 'idle'
        p.sprite.time = 0
      }
    }

    if (b.phase === 0) {
      // 100-75%: slow dense grid. Precision navigation, not reflexes.
      if (b.a <= 0) {
        b.a = 1.25
        for (let i = 0; i < 11; i++) {
          const x = -PLAY_HALF_W + (i / 10) * PLAY_HALF_W * 2 + Math.sin(b.t) * 1.1
          ctx.fireEnemy(x, b.z + 3, 0, 9.5, 1, 0.32)
        }
        ctx.sfx('enemy_shot')
      }
      return
    }

    if (b.phase === 1) {
      // 75-50%: the arms physically sweep the playfield.
      for (let i = 0; i < ARMS.length; i++) {
        const p = b.parts[ARMS[i]]
        if (!p || p.bossPart!.destroyed) continue
        const dir = i === 0 ? -1 : 1
        p.bossPart!.anchorX = (dir * Math.cos(b.t * 0.85) * 12.3) / b.hullWidth
        p.bossPart!.anchorZ = (4.9 + Math.sin(b.t * 0.85) * 3.2) / b.hullWidth
        p.transform.rot = Math.sin(b.t * 0.85) * 0.5 * dir
      }
      if (b.a <= 0) {
        b.a = 2.2
        for (const id of CANNONS) {
          if (!partAlive(b, id)) continue
          const p = b.parts[id]
          const n = fan(3, Math.PI / 2, 0.6, 15, scratch)
          for (let k = 0; k < n; k++) ctx.fireFrom(p, scratch[k * 2], scratch[k * 2 + 1], 1)
        }
        ctx.sfx('enemy_shot')
      }
      return
    }

    if (b.phase === 2) {
      // 50-30%: summons runners and lances; the corridor starts closing.
      if (b.b <= 0) {
        b.b = 5.5
        for (let i = 0; i < 3; i++) {
          ctx.summon(i === 0 ? 'lance' : 'runner', ctx.rng.range(-8, 8), -22)
        }
      }
      if (b.a <= 0) {
        b.a = 1.8
        for (const id of CANNONS) {
          if (!partAlive(b, id)) continue
          ctx.fireFrom(b.parts[id], 0, 14, 1)
        }
      }
      return
    }

    if (b.phase === 3) {
      // 30-10%: every surviving cannon, counter-rotating double spiral.
      if (b.a <= 0) {
        b.a = 0.1
        b.c += 0.26
        for (let s = 0; s < 2; s++) {
          const dir = s === 0 ? 1 : -1
          for (let k = 0; k < 3; k++) {
            const a = b.c * dir + (k * Math.PI * 2) / 3 + s * 0.5
            ctx.fireEnemy(b.x, b.z + 2, Math.cos(a) * 13, Math.sin(a) * 13 + 3, 1, 0.3)
          }
        }
      }
      if (b.b <= 0) {
        b.b = 3.0
        chargeAll(b, CANNONS)
        for (const id of CANNONS) {
          if (!partAlive(b, id)) continue
          const p = b.parts[id]
          const n = fan(5, Math.PI / 2, 1.1, 16, scratch)
          for (let k = 0; k < n; k++) ctx.fireFrom(p, scratch[k * 2], scratch[k * 2 + 1], 1)
        }
        ctx.sfx('enemy_shot')
      }
      return
    }

    // <10%: the finale. An 8s beam fills 70% of the screen; survive the rest.
    if (b.d <= 0) {
      b.d = 8
      b.c = 0
      chargeAll(b, [...CANNONS, 'core'])
      ctx.sfx('boss_phase_shift')
      ctx.shake(1)
    }
    b.c += ctx.dt
    // the beam is a dense curtain everywhere except the centre corridor
    if (b.a <= 0 && b.c > 1.6) {
      b.a = 0.07
      for (let i = 0; i < 16; i++) {
        const x = -PLAY_HALF_W + (i / 15) * PLAY_HALF_W * 2
        if (Math.abs(x) < FINALE_CORRIDOR) continue
        ctx.fireEnemy(x, b.z + 3, 0, 22, 1, 0.42)
      }
      ctx.shake(0.25)
    }
  },

  onPhaseShift(b, ctx) {
    b.a = 1.0
    b.b = 2.0
    b.d = 0
    ctx.shake(1)
  },
}
