import { PLAY_HALF_W } from '@/game/core/constants'
import { type BossCtx, type BossRuntime, type BossSpec, fan, partAlive } from './fsm'

/**
 * BOSS 2 - BASILISK (level 10), scale 1.8x.
 *
 * Serpentine dreadnought, ~78% of the screen. The body undulates, so the
 * segments are placed on a travelling sine rather than at fixed anchors.
 */

const scratch = new Float32Array(64)
const SEGMENTS = ['seg_a', 'seg_b', 'seg_c', 'seg_d']
const TURRETS = ['turret_a', 'turret_b', 'turret_c', 'turret_d']

/** Lay the body out along a sine; phase 2 coils it into a ring instead. */
function undulate(b: BossRuntime, coil: number): void {
  const parts = b.parts
  const all = ['head', ...SEGMENTS, 'thruster_l', 'thruster_r']
  for (let i = 0; i < all.length; i++) {
    const p = parts[all[i]]
    if (!p) continue
    const along = i / Math.max(1, all.length - 1)
    // snake: trails behind the head on a sine
    const snakeX = Math.sin(b.t * 1.6 - i * 0.7) * 6.7
    const snakeZ = -i * 2.9
    // coil: evenly spaced around a circle centred on the boss
    const a = (i / all.length) * Math.PI * 2 + b.t * 0.6
    const ringR = 9.0
    const coilX = Math.cos(a) * ringR
    const coilZ = Math.sin(a) * ringR * 0.6
    const bp = p.bossPart!
    bp.anchorX = (snakeX * (1 - coil) + coilX * coil) / b.hullWidth
    bp.anchorZ = (snakeZ * (1 - coil) + coilZ * coil) / b.hullWidth
    p.transform.rot = Math.cos(b.t * 1.6 - i * 0.7) * 0.4 * (1 - coil) + along * 0.01
  }
  // turrets ride their segments
  for (let i = 0; i < TURRETS.length; i++) {
    const t = b.parts[TURRETS[i]]
    const host = b.parts[SEGMENTS[i]]
    if (!t || !host) continue
    t.bossPart!.anchorX = host.bossPart!.anchorX
    t.bossPart!.anchorZ = host.bossPart!.anchorZ + 0.02
  }
}

function turretsFire(b: BossRuntime, ctx: BossCtx, count: number, speed: number): void {
  for (const id of TURRETS) {
    if (!partAlive(b, id)) continue
    const p = b.parts[id]
    const dx = ctx.playerX - p.transform.x
    const dz = ctx.playerZ - p.transform.z
    const len = Math.hypot(dx, dz) || 1
    const base = Math.atan2(dz / len, dx / len)
    const n = fan(count, base, 0.5, speed, scratch)
    for (let i = 0; i < n; i++) ctx.fireFrom(p, scratch[i * 2], scratch[i * 2 + 1], 1)
    p.sprite.state = 'fire'
    p.sprite.time = 0
  }
  ctx.sfx('enemy_shot')
}

function chargeTurrets(b: BossRuntime): void {
  for (const id of TURRETS) {
    if (!partAlive(b, id)) continue
    const p = b.parts[id]
    if (p.sprite.state !== 'charge') {
      p.sprite.state = 'charge'
      p.sprite.time = 0
    }
  }
}

export const basilisk: BossSpec = {
  id: 'basilisk',
  atlas: 'boss_basilisk',
  displayName: 'BASILISK',
  level: 10,
  scaleMul: 1.8,
  entryTime: 6,
  entryZ: -9,
  deathTime: 4,
  corePart: 'core',
  // the armoured head opens once the first phase ends; the core is sealed
  // until the body around it has been stripped
  exposeAt: { head: 1 },

  update(b, ctx) {
    b.a -= ctx.dt
    b.b -= ctx.dt

    const coil = b.phase === 1 ? Math.min(1, b.stateT / 2.5) : 0
    undulate(b, coil)

    // the core rides the fourth segment wherever the body has thrown it
    const corePart = b.parts.core?.bossPart
    const host = b.parts.seg_c?.bossPart
    if (corePart) {
      corePart.anchorX = host?.anchorX ?? 0
      corePart.anchorZ = host?.anchorZ ?? 0
    }

    if (b.phase === 0) {
      // 100-70%: enters from the side, turrets track the player
      b.x += (Math.sin(b.t * 0.5) * (PLAY_HALF_W - 5) - b.x) * 1.4 * ctx.dt
      b.z = -8 + Math.sin(b.t * 0.8) * 1.5
      if (b.a <= 0.6 && b.a > 0) chargeTurrets(b)
      if (b.a <= 0) {
        turretsFire(b, ctx, 3, 16)
        b.a = 2.4
      }
      return
    }

    if (b.phase === 1) {
      // 70-40%: coils into an arena and throws a wall with one rotating gap
      b.x += (0 - b.x) * 1.6 * ctx.dt
      b.z += (-11 - b.z) * 1.6 * ctx.dt
      b.d += ctx.dt
      if (b.d >= 0.18 && coil > 0.8) {
        b.d = 0
        b.c += 0.3
        const gap = b.c % (Math.PI * 2)
        for (let i = 0; i < 26; i++) {
          const a = (i / 26) * Math.PI * 2
          let diff = Math.abs(a - gap)
          if (diff > Math.PI) diff = Math.PI * 2 - diff
          if (diff < 0.55) continue // the gap you must read
          ctx.fireEnemy(
            b.x + Math.cos(a) * 3,
            b.z + Math.sin(a) * 3,
            Math.cos(a) * 11,
            Math.sin(a) * 11,
            1,
            0.3,
          )
        }
        ctx.sfx('enemy_shot')
      }
      return
    }

    if (b.phase === 2) {
      // 40-15%: thrusters burning, erratic diagonal charges
      if (b.a <= 0) {
        b.a = 2.0
        const tx = ctx.playerX
        b.c = Math.sign(tx - b.x) || 1
      }
      b.x += b.c * 13 * ctx.dt
      if (Math.abs(b.x) > PLAY_HALF_W - 4) b.c = -b.c
      b.z = -10 + Math.sin(b.t * 1.7) * 3.0
      if (b.b <= 0.5 && b.b > 0) chargeTurrets(b)
      if (b.b <= 0) {
        turretsFire(b, ctx, 5, 18)
        b.b = 1.6
      }
      return
    }

    // <15%: segments break formation, core charges a 2s beam
    b.x += (ctx.playerX - b.x) * 0.9 * ctx.dt
    b.z = -10
    for (let i = 0; i < SEGMENTS.length; i++) {
      const p = b.parts[SEGMENTS[i]]
      if (!p) continue
      const a = b.t * (1.1 + i * 0.3) + i * 1.9
      p.bossPart!.anchorX = (Math.cos(a) * (5 + i)) / b.hullWidth
      p.bossPart!.anchorZ = (Math.sin(a) * (3 + i * 0.6)) / b.hullWidth
    }
    if (b.b <= 2.0 && b.b > 0) {
      const core = b.parts.core
      if (core && core.sprite.state !== 'charge') {
        core.sprite.state = 'charge'
        core.sprite.time = 0
      }
    }
    if (b.b <= 0) {
      const core = b.parts.core
      if (core) {
        const n = fan(9, Math.PI / 2, 0.9, 26, scratch)
        for (let i = 0; i < n; i++) ctx.fireFrom(core, scratch[i * 2], scratch[i * 2 + 1], 1, 0.4)
        core.sprite.state = 'fire'
        core.sprite.time = 0
      }
      ctx.shake(0.6)
      ctx.sfx('boss_phase_shift')
      b.b = 4.2
    }
    if (b.a <= 0) {
      turretsFire(b, ctx, 3, 15)
      b.a = 2.2
    }
  },

  onPhaseShift(b, ctx) {
    b.a = 1.4
    b.b = 2.4
    b.d = 0
    ctx.shake(0.9)
  },
}
