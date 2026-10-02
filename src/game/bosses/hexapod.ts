import { PLAY_HALF_W } from '@/game/core/constants'
import { type BossCtx, type BossRuntime, type BossSpec, fan, partAlive } from './fsm'

/**
 * BOSS 1 - HEXAPOD (level 5), scale 1.0x.
 *
 * Transport mothership, ~45% of the screen. Two cannon pods, a launch bay and
 * a core that only opens once the bay is down.
 */

const scratch = new Float32Array(32)

function podFire(b: BossRuntime, ctx: BossCtx, id: string, spread: number): void {
  if (!partAlive(b, id)) return
  const part = b.parts[id]
  const n = fan(5, Math.PI / 2, spread, 17, scratch)
  for (let i = 0; i < n; i++) {
    ctx.fireFrom(part, scratch[i * 2], scratch[i * 2 + 1], 1)
  }
  part.sprite.state = 'fire'
  part.sprite.time = 0
  ctx.sfx('enemy_shot')
}

function chargePart(b: BossRuntime, id: string): void {
  if (!partAlive(b, id)) return
  const p = b.parts[id]
  if (p.sprite.state !== 'charge') {
    p.sprite.state = 'charge'
    p.sprite.time = 0
  }
}

export const hexapod: BossSpec = {
  id: 'hexapod',
  atlas: 'boss_hexapod',
  displayName: 'HEXAPOD',
  level: 5,
  scaleMul: 1.0,
  entryTime: 4.5,
  deathTime: 2.4,
  corePart: 'core',
  // spec 8: "a destroyed bay exposes the core"
  coreExposedBy: ['bay'],

  update(b, ctx) {
    b.a -= ctx.dt // primary weapon clock
    b.b -= ctx.dt // secondary / launch clock

    // Drifts laterally across the top of the playfield.
    const sway = Math.sin(b.t * 0.42) * (PLAY_HALF_W - 6.5)
    b.x += (sway - b.x) * Math.min(1, 2.2 * ctx.dt)
    b.z = -17 + Math.sin(b.t * 0.7) * 1.2

    if (b.phase === 0) {
      // 100-60%: pods alternate 5-shot fans, bay launches swarmers.
      if (b.a <= 0.55 && b.a > 0) {
        chargePart(b, b.c > 0 ? 'pod_l' : 'pod_r')
      }
      if (b.a <= 0) {
        podFire(b, ctx, b.c > 0 ? 'pod_l' : 'pod_r', 1.15)
        b.c = -b.c
        b.a = 1.85
      }
      if (b.b <= 0.6 && b.b > 0) chargePart(b, 'bay')
      if (b.b <= 0) {
        if (partAlive(b, 'bay')) {
          const bay = b.parts.bay
          for (let i = 0; i < 4; i++) {
            ctx.summon('swarmer', bay.transform.x + (i - 1.5) * 1.8, bay.transform.z + 1)
          }
          bay.sprite.state = 'fire'
          bay.sprite.time = 0
          ctx.sfx('boss_part_destroyed')
        }
        b.b = 8
      }
      return
    }

    if (b.phase === 1) {
      // 60-25%: both pods at once, plus a slow horizontal sweeping beam.
      if (b.a <= 0.6 && b.a > 0) {
        chargePart(b, 'pod_l')
        chargePart(b, 'pod_r')
      }
      if (b.a <= 0) {
        podFire(b, ctx, 'pod_l', 1.5)
        podFire(b, ctx, 'pod_r', 1.5)
        b.a = 2.1
      }
      // sweep: a dense line of shots walking across the corridor
      b.d += ctx.dt
      if (b.d > 0.09) {
        b.d = 0
        const t = (Math.sin(b.t * 0.55) + 1) / 2
        const x = -PLAY_HALF_W + t * PLAY_HALF_W * 2
        ctx.fireEnemy(x, b.z + 2.9, 0, 20, 1, 0.3)
      }
      if (b.b <= 0) {
        if (partAlive(b, 'bay')) {
          const bay = b.parts.bay
          for (let i = 0; i < 3; i++) {
            ctx.summon('swarmer', bay.transform.x + (i - 1) * 2.0, bay.transform.z + 1)
          }
        }
        b.b = 10
      }
      return
    }

    // <25%: bay is gone, core exposed. Spiral plus a horizontal charge.
    if (b.a <= 0) {
      const core = b.parts[this.corePart]
      b.c += 0.42
      for (let k = 0; k < 3; k++) {
        const a = b.c + (k * Math.PI * 2) / 3
        ctx.fireFrom(core, Math.cos(a) * 14, Math.sin(a) * 14 + 4, 1)
      }
      b.a = 0.12
      if (core.sprite.state !== 'fire') {
        core.sprite.state = 'fire'
        core.sprite.time = 0
      }
    }
    if (b.b <= 0.7 && b.b > 0) {
      chargePart(b, 'pod_l')
      chargePart(b, 'pod_r')
    }
    if (b.b <= 0) {
      podFire(b, ctx, 'pod_l', 2.0)
      podFire(b, ctx, 'pod_r', 2.0)
      b.b = 3.4
    }
  },

  onPhaseShift(b, ctx) {
    b.a = 1.2
    b.b = 2.0
    ctx.shake(0.7)
  },
}
