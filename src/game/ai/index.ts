import { ENEMIES, type EnemyId } from '@/data/enemies'
import { ENGAGE_Z_MAX, ENGAGE_Z_MIN } from '@/game/core/constants'
import type { Entity } from '@/game/entities/components'
import { BULLET_LASER } from '@/game/systems/bullets'
import type { AiContext, Behaviour } from './types'

export type { AiContext, Behaviour } from './types'

/**
 * One behaviour per bestiary entry (spec 7).
 *
 * The rule that holds all of these together: every dangerous attack spends at
 * least 0.4s in `charge` first, where the sprite's emissive ramps up. Difficult
 * is fine; unreadable is not.
 */

const FIRE_HOLD = 0.13

/** Common weapon clock: idle -> charge -> fire -> idle. */
/** On screen, and therefore allowed to shoot at you. */
export function engaged(e: Entity): boolean {
  return e.transform.z > ENGAGE_Z_MIN && e.transform.z < ENGAGE_Z_MAX
}

function tickWeapon(e: Entity, ctx: AiContext, onFire: (e: Entity) => void): void {
  const w = e.weapon
  if (!w) return
  // Hold the clock while off-screen rather than letting it run down:
  // otherwise the ship enters already loaded and fires with no wind-up.
  if (!engaged(e)) return
  w.timer -= ctx.dt

  if (w.burstLeft > 0 && w.timer <= 0) {
    onFire(e)
    w.burstLeft--
    w.timer = 0.14
    if (w.burstLeft === 0) w.timer = w.cooldown
    setState(e, 'fire')
    return
  }

  if (w.timer <= 0) {
    onFire(e)
    w.charging = false
    w.timer = w.cooldown
    setState(e, 'fire')
    e.sprite.time = 0
  } else if (w.timer <= w.telegraph) {
    if (!w.charging) {
      w.charging = true
      setState(e, 'charge')
      e.sprite.time = 0
    }
  } else if (e.sprite.state === 'fire' && e.sprite.time > FIRE_HOLD) {
    setState(e, 'idle')
  }
}

function setState(e: Entity, s: string): void {
  if (e.sprite.state !== s) {
    e.sprite.state = s
    e.sprite.time = 0
  }
}

/** Point a shot at the player, at a fixed speed. */
function aimAt(e: Entity, ctx: AiContext, speed: number, damage: number, spreadRad = 0): void {
  const dx = ctx.playerX - e.transform.x
  const dz = ctx.playerZ - e.transform.z
  const len = Math.hypot(dx, dz) || 1
  let ax = dx / len
  let az = dz / len
  if (spreadRad !== 0) {
    const c = Math.cos(spreadRad)
    const s = Math.sin(spreadRad)
    const nx = ax * c - az * s
    const nz = ax * s + az * c
    ax = nx
    az = nz
  }
  ctx.fireEnemy(e.transform.x, e.transform.z, ax * speed, az * speed, damage)
  ctx.sfx('enemy_shot')
}

/** Lateral drift that keeps a ship off the canyon walls. */
function avoidWalls(e: Entity, ctx: AiContext): void {
  const hw = ctx.halfWidthAt(e.transform.z)
  const c = ctx.centerAt(e.transform.z)
  const limit = hw - 1.2
  if (e.transform.x < c - limit) e.velocity.x = Math.abs(e.velocity.x) + 1
  else if (e.transform.x > c + limit) e.velocity.x = -Math.abs(e.velocity.x) - 1
}

// --------------------------------------------------------------- 01 scrap
// Drops straight down the corridor and plinks one shot at a time.

const scrap: Behaviour = (e, ctx) => {
  const st = ENEMIES.scrap
  e.velocity.z = st.speed
  e.velocity.x = Math.sin(e.ai!.t * 0.8 + e.ai!.a) * 1.4
  avoidWalls(e, ctx)
  tickWeapon(e, ctx, () => aimAt(e, ctx, st.shotSpeed, st.damage))
}

// --------------------------------------------------- 02 interceptor
// Enters in a V and crosses the screen on the diagonal; it does not linger.

const interceptor: Behaviour = (e, ctx) => {
  const st = ENEMIES.interceptor
  e.velocity.z = st.speed * 0.55
  e.velocity.x = e.ai!.dir * 9.5
  e.transform.rot = e.ai!.dir * 0.26
  tickWeapon(e, ctx, () => aimAt(e, ctx, st.shotSpeed, st.damage))
}

// ------------------------------------------------------------- 03 turret
// Bolted to the terrain, so it only moves with the scroll. Burst of three.

const turret: Behaviour = (e, ctx) => {
  const st = ENEMIES.turret
  e.velocity.z = ctx.scrollSpeed
  e.velocity.x = 0
  tickWeapon(e, ctx, () => {
    const w = e.weapon!
    if (w.burstLeft === 0) w.burstLeft = 3
    aimAt(e, ctx, st.shotSpeed, st.damage)
  })
}

// ------------------------------------------------------------ 04 swarmer
// Sine weave. Dangerous as a cloud, trivial alone.

const swarmer: Behaviour = (e, ctx) => {
  const st = ENEMIES.swarmer
  const ai = e.ai!
  e.velocity.z = st.speed * 0.7
  e.velocity.x = Math.cos(ai.t * 3.1 + ai.a) * 7.5
  e.transform.rot = Math.cos(ai.t * 3.1 + ai.a) * 0.3
  tickWeapon(e, ctx, () => aimAt(e, ctx, st.shotSpeed, st.damage))
}

// ------------------------------------------------------------ 05 bulwark
// Concave plate on the nose eats anything arriving head-on. Flank it.

const bulwark: Behaviour = (e, ctx) => {
  const st = ENEMIES.bulwark
  e.velocity.z = st.speed * 0.8
  e.velocity.x = Math.sin(e.ai!.t * 0.5) * 3.0
  avoidWalls(e, ctx)
  tickWeapon(e, ctx, () => {
    aimAt(e, ctx, st.shotSpeed, st.damage, -0.14)
    aimAt(e, ctx, st.shotSpeed, st.damage, 0.14)
  })
}

// -------------------------------------------------------------- 06 miner
// Seeds mines behind it. Each mine bursts into six shards.

const miner: Behaviour = (e, ctx) => {
  const st = ENEMIES.miner
  const ai = e.ai!
  e.velocity.z = st.speed * 0.8
  e.velocity.x = Math.sin(ai.t * 0.9 + ai.a) * 4.2
  avoidWalls(e, ctx)
  tickWeapon(e, ctx, () => {
    ctx.spawnMine(e.transform.x, e.transform.z - 0.6)
    ctx.sfx('enemy_shot')
  })
}

// --------------------------------------------------------------- 07 lance
// Telegraphs for 0.6s, then dashes at where the player is going to be.

const lance: Behaviour = (e, ctx) => {
  const ai = e.ai!
  const w = e.weapon!

  if (ai.phase === 0) {
    // approach
    e.velocity.z = 6
    e.velocity.x = (ctx.playerX - e.transform.x) * 0.9
    if (!engaged(e)) return
    w.timer -= ctx.dt
    if (w.timer <= 0 && e.transform.z > -18) {
      ai.phase = 1
      ai.c = 0.6
      setState(e, 'charge')
      e.sprite.time = 0
    }
    return
  }

  if (ai.phase === 1) {
    // wind-up: hold still and glow, so the dash is readable
    ai.c -= ctx.dt
    e.velocity.x *= 0.82
    e.velocity.z = 1.5
    if (ai.c <= 0) {
      const lead = 0.42
      const tx = ctx.playerX
      const tz = ctx.playerZ + lead * 6
      const dx = tx - e.transform.x
      const dz = tz - e.transform.z
      const len = Math.hypot(dx, dz) || 1
      ai.a = (dx / len) * 46
      ai.b = (dz / len) * 46
      ai.phase = 2
      setState(e, 'fire')
      ctx.sfx('enemy_shot')
    }
    return
  }

  // committed dash: no steering, that is what makes dodging possible
  e.velocity.x = ai.a
  e.velocity.z = ai.b
  ctx.particles.trail(ctx.rng, e.transform.x, e.transform.z, 1.0, 0.42, 0.1)
}

// -------------------------------------------------------------- 08 wraith
// Paints a 1.2s aim line, then snaps a thin beam down it.

const wraith: Behaviour = (e, ctx) => {
  const st = ENEMIES.wraith
  const ai = e.ai!
  e.velocity.z = st.speed
  e.velocity.x = Math.sin(ai.t * 0.4) * 2.2
  avoidWalls(e, ctx)

  const w = e.weapon!
  if (!engaged(e)) return
  w.timer -= ctx.dt

  if (w.timer <= w.telegraph && w.timer > 0) {
    if (!w.charging) {
      w.charging = true
      setState(e, 'charge')
      e.sprite.time = 0
      // lock the angle at the START of the telegraph, so the line is honest
      const dx = ctx.playerX - e.transform.x
      const dz = ctx.playerZ - e.transform.z
      const len = Math.hypot(dx, dz) || 1
      ai.a = dx / len
      ai.b = dz / len
    }
    // draw the sight line as sparks along the locked ray
    for (let i = 1; i <= 7; i++) {
      if (ctx.rng.next() > 0.22) continue
      const d = i * 3.4
      ctx.particles.spawn(
        e.transform.x + ai.a * d,
        0.5,
        e.transform.z + ai.b * d,
        0,
        0,
        0,
        0.1,
        0.16,
        1.0,
        0.12,
        0.12,
      )
    }
  }

  if (w.timer <= 0) {
    ctx.fireEnemy(
      e.transform.x,
      e.transform.z,
      ai.a * st.shotSpeed,
      ai.b * st.shotSpeed,
      st.damage,
      0.22,
      BULLET_LASER,
    )
    ctx.sfx('enemy_shot')
    w.charging = false
    w.timer = w.cooldown
    setState(e, 'fire')
    e.sprite.time = 0
  }
}

// ------------------------------------------------------------ 09 splitter
// Two modules on a visible joint. The split on death is the whole point;
// it is handled by the damage system, which reads `splitsInto`.

const splitter: Behaviour = (e, ctx) => {
  const st = ENEMIES.splitter
  e.velocity.z = st.speed * 0.8
  e.velocity.x = Math.sin(e.ai!.t * 1.1 + e.ai!.a) * 3.4
  avoidWalls(e, ctx)
  tickWeapon(e, ctx, () => aimAt(e, ctx, st.shotSpeed, st.damage))
}

// -------------------------------------------------------------- 10 runner
// Blinks every 2.5s and shoots the instant it lands.

const runner: Behaviour = (e, ctx) => {
  const st = ENEMIES.runner
  const ai = e.ai!
  ai.c -= ctx.dt

  if (ai.c <= 0) {
    ai.c = 2.5
    // dissolve out
    ctx.particles.burst(ctx.rng, e.transform.x, e.transform.z, 14, 7, 0.4, 0.3, 0.7, 0.3, 1.0)
    const hw = ctx.halfWidthAt(e.transform.z) - 1.5
    e.transform.x = ctx.centerAt(e.transform.z) + ctx.rng.range(-hw, hw)
    e.transform.z = Math.max(-20, ctx.playerZ - ctx.rng.range(5, 13))
    e.transform.px = e.transform.x
    e.transform.pz = e.transform.z
    ctx.particles.burst(ctx.rng, e.transform.x, e.transform.z, 14, 7, 0.4, 0.3, 0.7, 0.3, 1.0)
    // arrive already winding up, never firing instantly
    e.weapon!.timer = e.weapon!.telegraph
    e.weapon!.charging = false
    ctx.sfx('hit_metal')
  }

  e.velocity.z = st.speed * 0.6
  e.velocity.x = Math.sin(ai.t * 2.2) * 2.0
  tickWeapon(e, ctx, () => aimAt(e, ctx, st.shotSpeed, st.damage))
}

// --------------------------------------------------------------- 11 barge
// Slow slab. Fires twelve shots in a wide arc, so you read the gaps.

const barge: Behaviour = (e, ctx) => {
  const st = ENEMIES.barge
  e.velocity.z = st.speed * 0.9
  e.velocity.x = Math.sin(e.ai!.t * 0.35) * 1.8
  avoidWalls(e, ctx)
  tickWeapon(e, ctx, () => {
    for (let i = 0; i < 12; i++) {
      const a = -0.85 + (i / 11) * 1.7
      aimAt(e, ctx, st.shotSpeed, st.damage, a)
    }
  })
}

export const BEHAVIOURS: Record<EnemyId, Behaviour> = {
  scrap,
  interceptor,
  turret,
  swarmer,
  bulwark,
  miner,
  lance,
  wraith,
  splitter,
  runner,
  barge,
}

/** Head-on arc that the bulwark's plate blocks, in radians. */
export const BULWARK_SHIELD_ARC = 0.95

/** Enemies that leave something behind when they die. */
export const SPLITS_INTO: Partial<Record<EnemyId, { kind: EnemyId; count: number }>> = {
  splitter: { kind: 'scrap', count: 2 },
}
