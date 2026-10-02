import { type Query, type With, World } from 'miniplex'
import { ENEMIES, type EnemyId } from '@/data/enemies'
import { type LevelDefinition, levelById, type Wave } from '@/data/levels'
import type { BossId } from '@/data/levels/types'
import {
  applyPickup,
  degradeOnDeath,
  initialWeapons,
  LANCE_DPS,
  LANCE_RANGE,
  PLAYER_FIRE_RATE,
  PLAYER_SHOT_DAMAGE,
  PLAYER_SHOT_SPEED,
  SEEKER_DAMAGE,
  SEEKER_RATE,
  spreadAngles,
  type WeaponState,
} from '@/data/weapons'
import { actOf } from '@/theme/palette'
import { BEHAVIOURS, BULWARK_SHIELD_ARC, SPLITS_INTO } from './ai'
import type { AiContext } from './ai/types'
import { BOSSES } from './bosses'
import {
  anchorPart,
  type BossCtx,
  type BossRuntime,
  PHASE_SHIFT_TIME,
  updatePhase,
} from './bosses/fsm'
import type { LoadedAtlas } from './core/atlas'
import {
  BOMB_DAMAGE,
  BOMB_RADIUS,
  BOSS_WORLD_SCALE,
  DESPAWN_Z,
  DESPAWN_Z_FAR,
  ENERGY_BONUS_PER_PCT,
  ENERGY_CRITICAL,
  ENERGY_DRAIN_PER_S,
  ENERGY_MAX,
  ENERGY_PICKUP,
  FIXED_DT,
  MAX_COMBO,
  MAX_ENEMIES,
  NO_DAMAGE_BONUS,
  PICKUP_GRAB,
  PICKUP_RADIUS,
  PLAY_HALF_W,
  PLAYER_FOCUS_SPEED,
  PLAYER_HIT_RADIUS,
  PLAYER_INVULN_ON_SPAWN,
  PLAYER_RESPAWN_DELAY,
  PLAYER_SPEED,
  PLAYER_START_LIVES,
  PLAYER_Z_MAX,
  PLAYER_Z_MIN,
  PRACTICE_LIVES,
  SPAWN_Z,
  scrollSpeedFor,
  TIME_BONUS_PER_S,
} from './core/constants'
import { EventBus } from './core/events'
import { ObjectPool } from './core/pool'
import { mulberry32, type Rng } from './core/rng'
import { aabbHit, circleHit, SpatialHash } from './core/spatialHash'
import { type Entity, makeEntity, type PickupKind, resetEntity } from './entities/components'
import {
  BULLET_ENEMY,
  BULLET_LASER,
  BULLET_MINE,
  Bullets,
  TEAM_ENEMY,
  TEAM_PLAYER,
} from './systems/bullets'
import { Particles } from './systems/particles'
import { Canyon } from './world/canyon'

export type RunState =
  | 'loading'
  | 'intro'
  | 'playing'
  | 'bossIntro'
  | 'dying'
  | 'cleared'
  | 'gameOver'

export interface InputState {
  moveX: number
  moveZ: number
  fire: boolean
  focus: boolean
  bomb: boolean
  /** Mouse steering overrides the axes when active. */
  pointer: boolean
  pointerX: number
  pointerZ: number
}

export interface SimOptions {
  practice: boolean
  reducedMotion: boolean
  colorblind: boolean
  startLevel: number
  seed: number
}

export interface PlayerRuntime {
  x: number
  z: number
  px: number
  pz: number
  alive: boolean
  lives: number
  energy: number
  invuln: number
  respawnIn: number
  fireTimer: number
  seekerTimer: number
  weapons: WeaponState
  focus: boolean
  /** Visual bank, -1..1. */
  bank: number
  hitFlash: number
}

/** Seconds between refuel drops while a boss is alive. */
const BOSS_ENERGY_INTERVAL = 13

const EMPTY_INPUT: InputState = {
  moveX: 0,
  moveZ: 0,
  fire: false,
  focus: false,
  bomb: false,
  pointer: false,
  pointerX: 0,
  pointerZ: 0,
}

/**
 * The whole game, as plain TypeScript. No React, no three.js.
 *
 * Everything the renderer needs is readable state on this object; everything
 * the simulation needs arrives through `input`. That split is what keeps React
 * from ever re-rendering mid-frame (spec 4).
 */
export class Simulation {
  readonly world = new World<Entity>()
  /** Archetypes. Only enemies carry `ai`, only pickups carry `pickup`. */
  readonly qAi: Query<With<Entity, 'ai'>>
  readonly qPickups: Query<With<Entity, 'pickup'>>
  readonly qBossParts: Query<With<Entity, 'bossPart'>>
  readonly qSprites: Query<With<Entity, 'sprite'>>

  readonly bullets = new Bullets()
  readonly particles = new Particles()
  readonly bus = new EventBus()
  readonly grid = new SpatialHash()

  rng: Rng
  canyon: Canyon
  level: LevelDefinition
  opts: SimOptions

  player: PlayerRuntime = {
    x: 0,
    z: -4,
    px: 0,
    pz: -4,
    alive: true,
    lives: PLAYER_START_LIVES,
    energy: ENERGY_MAX,
    invuln: PLAYER_INVULN_ON_SPAWN,
    respawnIn: 0,
    fireTimer: 0,
    seekerTimer: 0,
    weapons: initialWeapons(),
    focus: false,
    bank: 0,
    hitFlash: 0,
  }

  state: RunState = 'intro'
  stateT = 0
  /** Seconds elapsed inside the level. */
  time = 0
  /** Distance travelled, drives the terrain. */
  scroll = 0
  scrollSpeed = 18
  score = 0
  combo = 1
  comboKills = 0
  tookDamageThisLevel = false
  boss: BossRuntime | null = null
  bossSpawned = false
  /** Countdown to the next refuel drop during a boss fight. */
  private bossEnergyTimer = 0
  /** Screen shake amplitude, decays every step. */
  shake = 0
  /** Chromatic aberration boost, 0..1. */
  aberration = 0
  /** Set when the level is finished; read by the result screen. */
  result: {
    level: number
    score: number
    energyBonus: number
    timeBonus: number
    noDamageBonus: number
    total: number
  } | null = null

  input: InputState = { ...EMPTY_INPUT }

  private readonly pool: ObjectPool<Entity>
  private waveIndex = 0
  private pickupIndex = 0
  private atlases = new Map<string, LoadedAtlas>()
  private readonly queryBuf = new Int32Array(256)
  private readonly angleBuf = new Float32Array(8)
  private readonly aiCtx: AiContext
  private readonly bossCtx: BossCtx
  private sfxSink: (name: string) => void = () => {}

  constructor(opts: Partial<SimOptions> = {}) {
    this.opts = {
      practice: false,
      reducedMotion: false,
      colorblind: false,
      startLevel: 1,
      seed: 0x5eed,
      ...opts,
    }
    this.level = levelById(this.opts.startLevel)
    this.rng = mulberry32(this.opts.seed ^ (this.level.seed >>> 0))
    this.canyon = new Canyon(this.level.seed, this.level.terrain)
    this.pool = new ObjectPool<Entity>(makeEntity, MAX_ENEMIES + 32)

    this.qAi = this.world.with('ai')
    this.qPickups = this.world.with('pickup')
    this.qBossParts = this.world.with('bossPart')
    this.qSprites = this.world.with('sprite')

    this.aiCtx = this.makeAiContext()
    this.bossCtx = this.makeBossContext()
    this.player.lives = this.opts.practice ? PRACTICE_LIVES : PLAYER_START_LIVES
  }

  // ------------------------------------------------------------- lifecycle

  setAtlases(list: LoadedAtlas[]): void {
    this.atlases.clear()
    for (const a of list) this.atlases.set(a.name, a)
  }

  setSfxSink(fn: (name: string) => void): void {
    this.sfxSink = fn
  }

  /** Resolve an entity id to the atlas that actually holds it. */
  resolveSprite(entityId: string): { atlas: string; entity: string } {
    const act = actOf(this.level.id)
    const actAtlas = `act${act}`
    if (this.atlases.get(actAtlas)?.entities[entityId]) {
      return { atlas: actAtlas, entity: entityId }
    }
    for (const name of ['act1', 'act2', 'act3', 'common']) {
      if (this.atlases.get(name)?.entities[entityId]) {
        return { atlas: name, entity: entityId }
      }
    }
    return { atlas: 'act1', entity: 'scrap' }
  }

  startLevel(id: number): void {
    this.level = levelById(id)
    this.rng = mulberry32(this.opts.seed ^ (this.level.seed >>> 0))
    this.canyon = new Canyon(this.level.seed, this.level.terrain)
    this.scrollSpeed = scrollSpeedFor(id)
    this.time = 0
    this.scroll = 0
    this.waveIndex = 0
    this.pickupIndex = 0
    this.bossSpawned = false
    this.bossEnergyTimer = BOSS_ENERGY_INTERVAL
    this.boss = null
    this.result = null
    this.tookDamageThisLevel = false
    this.state = 'playing'
    this.stateT = 0
    this.clearEntities()
    this.bullets.reset()
    this.particles.reset()
    this.particles.density = this.opts.reducedMotion ? 0.3 : 1
    this.player.x = 0
    this.player.z = -4
    this.player.px = 0
    this.player.pz = -4
    this.player.alive = true
    this.player.energy = ENERGY_MAX
    this.player.invuln = PLAYER_INVULN_ON_SPAWN
    this.player.respawnIn = 0
  }

  private clearEntities(): void {
    for (const e of [...this.world.entities]) {
      this.world.remove(e)
      resetEntity(e)
      this.pool.put(e)
    }
  }

  // ------------------------------------------------------------------ step

  step(): void {
    const dt = FIXED_DT
    this.stateT += dt

    if (this.state === 'cleared' || this.state === 'gameOver') {
      this.particles.update(dt, this.scrollSpeed)
      return
    }

    // 1. world scroll
    this.scroll += this.scrollSpeed * dt
    this.time += dt
    if (this.level.collapsing) {
      this.canyon.pinch = Math.min(1, this.time / this.level.duration)
    }

    // 2. player
    this.stepPlayer(dt)

    // 3. spawning
    if (this.state === 'playing') {
      this.stepWaves()
      this.stepPickups()
      this.maybeSpawnBoss()
    }

    // 4. AI
    this.aiCtx.dt = dt
    this.aiCtx.time = this.time
    this.aiCtx.playerX = this.player.x
    this.aiCtx.playerZ = this.player.z
    this.aiCtx.playerAlive = this.player.alive
    this.aiCtx.scroll = this.scroll
    this.aiCtx.scrollSpeed = this.scrollSpeed
    for (const e of this.qAi.entities) {
      if (e.dead) continue
      e.ai!.t += dt
      BEHAVIOURS[e.ai!.kind](e, this.aiCtx)
    }

    // 5. boss
    if (this.boss) this.stepBoss(dt)

    // 6. movement
    this.stepMovement(dt)

    // 7. projectiles and fx
    this.bullets.update(dt, this.scrollSpeed)
    this.particles.update(dt, this.scrollSpeed)

    // 8. collision
    this.stepCollision()

    // 9. cleanup and progression
    this.sweep()
    this.stepProgress(dt)

    this.shake = Math.max(0, this.shake - dt * 2.2)
    this.aberration = Math.max(0, this.aberration - dt * 1.8)
    this.player.hitFlash = Math.max(0, this.player.hitFlash - dt * 4)
  }

  // ---------------------------------------------------------------- player

  private stepPlayer(dt: number): void {
    const p = this.player
    const inp = this.state === 'playing' || this.state === 'bossIntro' ? this.input : EMPTY_INPUT

    if (!p.alive) {
      p.respawnIn -= dt
      if (p.respawnIn <= 0) {
        if (p.lives > 0) {
          p.alive = true
          p.x = 0
          p.z = -4
          p.px = 0
          p.pz = -4
          p.energy = Math.max(p.energy, 45)
          p.invuln = PLAYER_INVULN_ON_SPAWN
          this.state = this.boss ? 'playing' : 'playing'
        } else {
          this.state = 'gameOver'
        }
      }
      return
    }

    p.invuln = Math.max(0, p.invuln - dt)
    p.focus = inp.focus
    const speed = inp.focus ? PLAYER_FOCUS_SPEED : PLAYER_SPEED

    p.px = p.x
    p.pz = p.z

    if (inp.pointer) {
      // direct mouse steering, lerped so it never feels twitchy
      // 0.55: the spec suggests 0.3, but with the cursor now projected to
      // a true world position a tighter follow just feels responsive
      // rather than twitchy.
      p.x += (inp.pointerX - p.x) * Math.min(1, 0.55 * 60 * dt)
      p.z += (inp.pointerZ - p.z) * Math.min(1, 0.55 * 60 * dt)
      p.bank += ((inp.pointerX - p.x) * 0.5 - p.bank) * 6 * dt
    } else {
      p.x += inp.moveX * speed * dt
      p.z += inp.moveZ * speed * dt
      p.bank += (inp.moveX - p.bank) * 9 * dt
    }

    p.x = Math.max(-PLAY_HALF_W, Math.min(PLAY_HALF_W, p.x))
    p.z = Math.max(PLAYER_Z_MIN, Math.min(PLAYER_Z_MAX, p.z))

    // Energy is the clock that forces you forward.
    if (!this.opts.practice && this.state === 'playing') {
      p.energy -= ENERGY_DRAIN_PER_S * dt
      if (p.energy <= ENERGY_CRITICAL && p.energy + ENERGY_DRAIN_PER_S * dt > ENERGY_CRITICAL) {
        this.bus.emit('energyLow', {})
      }
      if (p.energy <= 0) {
        p.energy = 0
        this.killPlayer(true)
        return
      }
    }

    // Canyon walls kill. This is the River Raid rule.
    if (p.invuln <= 0 && this.canyon.hits(p.x, this.scroll - p.z, PLAYER_HIT_RADIUS)) {
      this.killPlayer(false)
      return
    }

    this.stepWeapons(dt, inp)
  }

  private stepWeapons(dt: number, inp: InputState): void {
    const p = this.player
    const w = p.weapons

    if (w.lance > 0) w.lance -= dt
    if (w.seeker > 0) w.seeker -= dt
    p.fireTimer -= dt
    p.seekerTimer -= dt

    if (inp.bomb && w.bombs > 0) {
      this.detonateBomb()
      this.input.bomb = false
    }

    if (inp.fire && p.fireTimer <= 0) {
      p.fireTimer = PLAYER_FIRE_RATE
      if (w.lance > 0) {
        this.fireLance(dt)
      } else {
        const n = spreadAngles(w.spread, this.angleBuf)
        for (let i = 0; i < n; i++) {
          const a = this.angleBuf[i] - Math.PI / 2
          this.bullets.spawn(
            p.x,
            p.z,
            Math.cos(a) * PLAYER_SHOT_SPEED,
            Math.sin(a) * PLAYER_SHOT_SPEED,
            TEAM_PLAYER,
            PLAYER_SHOT_DAMAGE,
            0.3,
          )
        }
        if (w.wingman) {
          const ox = Math.sin(this.time * 2.4) * 2.4
          this.bullets.spawn(
            p.x + ox,
            p.z + 0.6,
            0,
            -PLAYER_SHOT_SPEED,
            TEAM_PLAYER,
            PLAYER_SHOT_DAMAGE,
            0.26,
          )
          this.bullets.spawn(
            p.x - ox,
            p.z + 0.6,
            0,
            -PLAYER_SHOT_SPEED,
            TEAM_PLAYER,
            PLAYER_SHOT_DAMAGE,
            0.26,
          )
        }
        this.sfxSink('player_shot')
      }
    }

    if (w.seeker > 0 && p.seekerTimer <= 0) {
      p.seekerTimer = SEEKER_RATE
      const target = this.nearestEnemy(p.x, p.z)
      if (target) {
        const dx = target.transform.x - p.x
        const dz = target.transform.z - p.z
        const len = Math.hypot(dx, dz) || 1
        for (const side of [-1, 1]) {
          this.bullets.spawn(
            p.x + side * 1.1,
            p.z,
            (dx / len) * 34 + side * 6,
            (dz / len) * 34,
            TEAM_PLAYER,
            SEEKER_DAMAGE,
            0.34,
          )
        }
        this.sfxSink('player_shot')
      }
    }
  }

  /** LANCE is a short continuous beam: damage over time, no projectile. */
  private fireLance(dt: number): void {
    const p = this.player
    let best: Entity | null = null
    let bestZ = -Infinity
    for (const e of this.qAi.entities) {
      if (e.dead || e.dying) continue
      if (Math.abs(e.transform.x - p.x) > 1.5) continue
      if (e.transform.z > p.z || e.transform.z < p.z - LANCE_RANGE) continue
      if (e.transform.z > bestZ) {
        bestZ = e.transform.z
        best = e
      }
    }
    for (const e of this.qBossParts.entities) {
      if (e.dead || !e.health || e.bossPart?.destroyed) continue
      if (Math.abs(e.transform.x - p.x) > 2.4) continue
      if (e.transform.z > p.z || e.transform.z < p.z - LANCE_RANGE) continue
      if (e.transform.z > bestZ) {
        bestZ = e.transform.z
        best = e
      }
    }
    if (best) this.damageEntity(best, LANCE_DPS * dt * 8, false)
    for (let i = 0; i < 3; i++) {
      this.particles.spawn(
        p.x + this.rng.range(-0.3, 0.3),
        0.4,
        p.z - this.rng.range(0, LANCE_RANGE),
        0,
        0,
        0,
        0.08,
        0.5,
        0.1,
        0.9,
        1.0,
      )
    }
  }

  private detonateBomb(): void {
    const p = this.player
    p.weapons.bombs--
    this.bullets.clearEnemyShots()
    this.shake = 1
    this.aberration = 1
    this.bus.emit('bombUsed', { x: p.x, z: p.z })
    this.sfxSink('explode_huge')
    this.particles.burst(this.rng, p.x, p.z, 120, 24, 0.9, 0.7, 0.2, 0.95, 1.0)
    for (const e of this.qAi.entities) {
      if (e.dead || e.dying) continue
      if (Math.hypot(e.transform.x - p.x, e.transform.z - p.z) <= BOMB_RADIUS) {
        this.damageEntity(e, BOMB_DAMAGE, true)
      }
    }
    for (const e of this.qBossParts.entities) {
      if (e.dead || !e.health || e.bossPart?.destroyed) continue
      this.damageEntity(e, BOMB_DAMAGE * 0.5, true)
    }
  }

  private nearestEnemy(x: number, z: number): Entity | null {
    let best: Entity | null = null
    let bestD = Infinity
    for (const e of this.qAi.entities) {
      if (e.dead || e.dying) continue
      const d = (e.transform.x - x) ** 2 + (e.transform.z - z) ** 2
      if (d < bestD) {
        bestD = d
        best = e
      }
    }
    for (const e of this.qBossParts.entities) {
      if (e.dead || !e.health || e.bossPart?.destroyed) continue
      const d = (e.transform.x - x) ** 2 + (e.transform.z - z) ** 2
      if (d < bestD) {
        bestD = d
        best = e
      }
    }
    return best
  }

  private killPlayer(outOfEnergy: boolean): void {
    const p = this.player
    if (!p.alive) return
    p.alive = false
    p.lives--
    p.respawnIn = PLAYER_RESPAWN_DELAY
    this.combo = 1
    this.comboKills = 0
    this.tookDamageThisLevel = true
    degradeOnDeath(p.weapons)
    if (!outOfEnergy) p.energy = Math.max(p.energy, 45)
    this.shake = 1
    this.aberration = 1
    this.particles.burst(this.rng, p.x, p.z, 90, 18, 1.1, 0.6, 1.0, 0.35, 0.8)
    this.bus.emit('playerDied', { lives: p.lives })
    this.sfxSink('explode_huge')
    if (p.lives <= 0) {
      this.state = 'dying'
      p.respawnIn = 1.4
    }
  }

  private damagePlayer(): void {
    const p = this.player
    if (!p.alive || p.invuln > 0) return
    if (p.weapons.shield > 0) {
      p.weapons.shield--
      p.invuln = 0.9
      p.hitFlash = 1
      this.shake = 0.5
      this.bus.emit('shieldBroke', {})
      this.sfxSink('shield_break')
      return
    }
    this.killPlayer(false)
  }

  // ------------------------------------------------------------- spawning

  private stepWaves(): void {
    while (this.waveIndex < this.level.waves.length) {
      const w = this.level.waves[this.waveIndex]
      if (w.at > this.time) break
      this.spawnWave(w)
      this.waveIndex++
    }
  }

  private stepPickups(): void {
    while (this.pickupIndex < this.level.pickups.length) {
      const d = this.level.pickups[this.pickupIndex]
      if (d.at > this.time) break
      const hw = this.canyon.halfWidth(this.scroll - SPAWN_Z) - 1.4
      this.spawnPickup(d.kind, this.canyon.centerX(this.scroll - SPAWN_Z) + d.x * hw, SPAWN_Z)
      this.pickupIndex++
    }
  }

  private spawnWave(w: Wave): void {
    const s = this.scroll - SPAWN_Z
    const hw = Math.max(2, this.canyon.halfWidth(s) - 1.6)
    const cx = this.canyon.centerX(s)
    const baseX = cx + w.x * hw

    for (let i = 0; i < w.count; i++) {
      let x = baseX
      let z = SPAWN_Z
      let dir = 0
      const k = i - (w.count - 1) / 2

      switch (w.formation) {
        case 'line':
          x = baseX + k * w.spacing
          break
        case 'v':
          x = baseX + k * w.spacing
          z = SPAWN_Z - Math.abs(k) * 1.6
          dir = baseX > cx ? -1 : 1
          break
        case 'column':
          z = SPAWN_Z - i * w.spacing
          break
        case 'arc':
          x = baseX + Math.sin((i / Math.max(1, w.count - 1)) * Math.PI) * w.spacing * 2 - w.spacing
          z = SPAWN_Z - i * 1.2
          break
        case 'swarm':
          x = baseX + this.rng.range(-w.spacing * 2, w.spacing * 2)
          z = SPAWN_Z - this.rng.range(0, 7)
          break
        case 'sides': {
          // hugs the canyon wall, like an emplacement
          const side = i % 2 === 0 ? -1 : 1
          x = cx + side * (hw - 0.6)
          z = SPAWN_Z - Math.floor(i / 2) * 5
          break
        }
        case 'wall':
          x = baseX + k * (w.spacing + 1.4)
          break
      }
      x = this.canyon.clampInside(x, this.scroll - z, 1.0)
      this.spawnEnemy(w.kind, x, z, dir)
    }
  }

  spawnEnemy(kind: EnemyId, x: number, z: number, dir = 0): Entity | null {
    if (this.qAi.entities.length >= MAX_ENEMIES) return null
    const stats = ENEMIES[kind]
    const e = this.pool.get()
    resetEntity(e)

    const spr = this.resolveSprite(stats.sprite)
    const atlas = this.atlases.get(spr.atlas)
    const def = atlas?.entities[spr.entity]

    e.transform.x = x
    e.transform.z = z
    e.transform.px = x
    e.transform.pz = z
    e.transform.scale = 1
    e.team = 'enemy'
    e.sprite.atlas = spr.atlas
    e.sprite.entity = spr.entity
    e.sprite.state = 'idle'
    e.sprite.time = this.rng.next() * 0.5
    e.collider.radius = def ? def.hitRadius * def.worldW : 1.2
    e.collider.box = false
    e.health = { hp: stats.hp, max: stats.hp, invuln: 0 }
    e.weapon = {
      timer: stats.fireRate * this.rng.range(0.5, 1.2),
      cooldown: stats.fireRate,
      telegraph: Math.max(0.4, stats.telegraph),
      charging: false,
      burstLeft: 0,
    }
    e.ai = {
      kind,
      t: 0,
      a: this.rng.range(0, Math.PI * 2),
      b: 0,
      c: kind === 'runner' ? 2.5 : 0,
      phase: 0,
      homeX: x,
      baseZ: z,
      dir: dir || (this.rng.chance(0.5) ? -1 : 1),
    }
    e.score = stats.score
    this.world.add(e)
    return e
  }

  spawnPickup(kind: PickupKind, x: number, z: number): void {
    const e = this.pool.get()
    resetEntity(e)
    e.transform.x = x
    e.transform.z = z
    e.transform.px = x
    e.transform.pz = z
    e.team = 'neutral'
    e.sprite.atlas = 'common'
    e.sprite.entity = `pu_${kind}`
    e.sprite.state = 'idle'
    e.collider.radius = PICKUP_RADIUS
    e.pickup = { kind, bob: this.rng.range(0, 6.28) }
    e.velocity.z = 0
    this.world.add(e)
  }

  private spawnMine(x: number, z: number): void {
    const i = this.bullets.spawn(x, z, 0, 0, TEAM_ENEMY, 1, 0.55, BULLET_MINE, 9)
    if (i >= 0) this.bullets.fuse[i] = 0.4
  }

  // ------------------------------------------------------------------ boss

  private maybeSpawnBoss(): void {
    if (this.bossSpawned || !this.level.boss) return
    if (this.time < this.level.duration * 0.42) return
    this.spawnBoss(this.level.boss)
  }

  private spawnBoss(id: BossId): void {
    const spec = BOSSES[id]
    const atlas = this.atlases.get(spec.atlas)
    if (!atlas?.boss) {
      // No atlas for this boss yet. Close the level out instead of looping
      // forever on the spawn check, so the run stays completable.
      this.bossSpawned = true
      this.finishLevel()
      return
    }
    this.bossSpawned = true

    const meta = atlas.boss
    const hullDef = atlas.entities.hull ?? Object.values(atlas.entities)[0]
    const hullWidth = hullDef.worldW * spec.scaleMul * BOSS_WORLD_SCALE

    const parts: Record<string, Entity> = {}
    let maxHp = 0
    for (const [partId, def] of Object.entries(meta.parts)) {
      const e = this.pool.get()
      resetEntity(e)
      const ent = atlas.entities[partId]
      e.team = 'enemy'
      e.transform.scale = spec.scaleMul * BOSS_WORLD_SCALE
      e.sprite.atlas = spec.atlas
      e.sprite.entity = partId
      e.sprite.state = 'idle'
      e.collider.box = true
      e.collider.hw = (ent?.worldW ?? 2) * 0.34 * e.transform.scale
      e.collider.hh = (ent?.worldH ?? 2) * 0.34 * e.transform.scale
      e.collider.radius = Math.max(e.collider.hw, e.collider.hh)
      if (def.hp > 0) {
        e.health = { hp: def.hp, max: def.hp, invuln: 0 }
        maxHp += def.hp
      }
      e.bossPart = {
        bossId: id,
        partId,
        anchorX: def.anchor[0],
        anchorZ: def.anchor[1],
        destroyed: false,
        deadFor: 0,
        fireTimer: 0,
        // the core is sealed until its guards fall; other parts may be
        // gated on a phase instead
        invulnerable: partId === spec.corePart || (spec.exposeAt?.[partId] ?? 0) > 0,
      }
      e.score = def.hp * 2
      parts[partId] = e
      this.world.add(e)
    }

    const thresholds = meta.phases.slice(1).map((p) => p.from)
    this.boss = {
      id,
      name: spec.displayName,
      atlas: spec.atlas,
      parts,
      hp: maxHp,
      maxHp,
      phase: 0,
      phaseCount: meta.phases.length,
      thresholds,
      state: 'entering',
      stateT: 0,
      t: 0,
      x: 0,
      z: -34,
      px: 0,
      pz: -34,
      hullWidth,
      scale: spec.scaleMul,
      invuln: 0,
      a: 1.5,
      b: 3,
      c: 1,
      d: 0,
      deathT: 0,
      deathDuration: spec.deathTime,
    }
    this.state = 'bossIntro'
    this.stateT = 0
    this.aberration = 1
    this.bus.emit('bossPhaseShift', { phase: 0 })
  }

  private stepBoss(dt: number): void {
    const b = this.boss!
    const spec = BOSSES[b.id]
    b.t += dt
    b.stateT += dt
    b.px = b.x
    b.pz = b.z

    if (b.state === 'entering') {
      b.z += ((spec.entryZ ?? -17) - b.z) * Math.min(1, 1.1 * dt)
      if (b.stateT >= spec.entryTime) {
        b.state = 'fighting'
        b.stateT = 0
        this.state = 'playing'
      }
    } else if (b.state === 'shifting') {
      b.invuln = Math.max(0, b.invuln - dt)
      if (b.stateT >= PHASE_SHIFT_TIME) {
        b.state = 'fighting'
        b.stateT = 0
        spec.onPhaseShift?.(b, this.bossCtx)
      }
    } else if (b.state === 'fighting') {
      // The wave schedule stopped when the boss arrived, but energy keeps
      // draining. Without this the fuel clock, not the boss, kills you.
      this.bossEnergyTimer -= dt
      if (this.bossEnergyTimer <= 0) {
        this.bossEnergyTimer = BOSS_ENERGY_INTERVAL
        const s0 = this.scroll - SPAWN_Z
        const hw = Math.max(1, this.canyon.halfWidth(s0) - 1.4)
        this.spawnPickup('energy', this.canyon.centerX(s0) + this.rng.range(-hw, hw), SPAWN_Z)
      }
      this.bossCtx.dt = dt
      this.bossCtx.time = this.time
      this.bossCtx.playerX = this.player.x
      this.bossCtx.playerZ = this.player.z
      this.bossCtx.playerAlive = this.player.alive
      this.bossCtx.scrollSpeed = this.scrollSpeed
      spec.update(b, this.bossCtx)
      if (updatePhase(b)) {
        b.state = 'shifting'
        b.stateT = 0
        b.invuln = PHASE_SHIFT_TIME
        this.aberration = 1
        this.shake = 0.8
        this.bus.emit('bossPhaseShift', { phase: b.phase })
        this.sfxSink('boss_phase_shift')
        this.refreshPartExposure()
      }
      if (b.hp <= 0) {
        b.state = 'dying'
        b.stateT = 0
        b.deathT = 0
      }
    } else if (b.state === 'dying') {
      b.deathT += dt
      if (this.rng.chance(0.45)) {
        const p = Object.values(b.parts)[this.rng.int(0, Object.keys(b.parts).length - 1)]
        this.particles.burst(
          this.rng,
          p.transform.x + this.rng.range(-2, 2),
          p.transform.z + this.rng.range(-2, 2),
          28,
          14,
          0.8,
          0.7,
          1.0,
          0.6,
          0.2,
        )
        this.shake = Math.max(this.shake, 0.5)
        this.sfxSink('explode_medium')
      }
      if (b.deathT >= b.deathDuration) {
        b.state = 'dead'
        this.bus.emit('bossDefeated', { id: b.id })
        for (const key of Object.keys(b.parts)) {
          const p = b.parts[key]
          p.dead = true
        }
        this.finishLevel()
      }
    }

    // keep parts pinned to their anchors
    for (const key of Object.keys(b.parts)) {
      const part = b.parts[key]
      if (part.dead) continue
      anchorPart(b, part)
      const bp = part.bossPart!
      if (bp.destroyed) bp.deadFor += dt
    }
  }

  // -------------------------------------------------------------- movement

  private stepMovement(dt: number): void {
    for (const e of this.world.entities) {
      if (e.dead || e.bossPart) continue
      e.transform.px = e.transform.x
      e.transform.pz = e.transform.z
      if (e.pickup) {
        // pickups ride the scroll and bob
        e.transform.z += this.scrollSpeed * dt
        e.pickup.bob += dt * 3
      } else {
        e.transform.x += e.velocity.x * dt
        e.transform.z += e.velocity.z * dt
      }
      e.sprite.time += dt
      if (e.sprite.flash > 0) e.sprite.flash = Math.max(0, e.sprite.flash - dt * 12)
      if (e.lifetime) {
        e.lifetime.t -= dt
        if (e.lifetime.t <= 0) e.dead = true
      }
      if (e.transform.z > DESPAWN_Z || e.transform.z < DESPAWN_Z_FAR) e.dead = true
    }
    for (const e of this.qBossParts.entities) {
      e.sprite.time += dt
      if (e.sprite.flash > 0) e.sprite.flash = Math.max(0, e.sprite.flash - dt * 12)
    }
  }

  // ------------------------------------------------------------- collision

  private stepCollision(): void {
    const p = this.player

    // index enemies for the player's shots
    this.grid.clear()
    const enemies = this.qAi.entities
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i]
      if (e.dead || e.dying) continue
      this.grid.insert(i, e.transform.x, e.transform.z)
    }

    // --- player shots vs enemies and boss parts
    for (let bi = this.bullets.count - 1; bi >= 0; bi--) {
      if (this.bullets.team[bi] !== TEAM_PLAYER) continue
      const bx = this.bullets.x[bi]
      const bz = this.bullets.z[bi]
      const br = this.bullets.radius[bi]
      let consumed = false

      const n = this.grid.query(bx, bz, br + 2, this.queryBuf)
      for (let q = 0; q < n && !consumed; q++) {
        const e = enemies[this.queryBuf[q]]
        if (!e || e.dead || e.dying) continue
        if (!circleHit(bx, bz, br, e.transform.x, e.transform.z, e.collider.radius)) continue
        // The bulwark eats anything arriving head-on.
        if (e.ai?.kind === 'bulwark') {
          const ang = Math.atan2(bz - e.transform.z, bx - e.transform.x)
          const front = Math.PI / 2
          let d = Math.abs(ang - front)
          if (d > Math.PI) d = Math.PI * 2 - d
          if (d < BULWARK_SHIELD_ARC) {
            this.particles.burst(this.rng, bx, bz, 4, 6, 0.25, 0.2, 0.7, 0.8, 1.0)
            this.sfxSink('hit_metal')
            this.bullets.free(bi)
            consumed = true
            break
          }
        }
        this.damageEntity(e, this.bullets.damage[bi], false)
        this.bullets.free(bi)
        consumed = true
      }
      if (consumed) continue

      for (const e of this.qBossParts.entities) {
        if (e.dead || !e.health || e.bossPart!.destroyed) continue
        if (e.bossPart!.invulnerable) continue
        if (!aabbHit(bx, bz, br, e.transform.x, e.transform.z, e.collider.hw, e.collider.hh)) {
          continue
        }
        this.damageEntity(e, this.bullets.damage[bi], false)
        this.bullets.free(bi)
        break
      }
    }

    if (!p.alive) return

    // --- enemy shots vs player (the hitbox is much smaller than the sprite)
    for (let bi = this.bullets.count - 1; bi >= 0; bi--) {
      if (this.bullets.team[bi] !== TEAM_ENEMY) continue
      if (this.bullets.kind[bi] === BULLET_MINE && this.bullets.fuse[bi] > 0) continue
      if (
        circleHit(
          this.bullets.x[bi],
          this.bullets.z[bi],
          this.bullets.radius[bi],
          p.x,
          p.z,
          PLAYER_HIT_RADIUS,
        )
      ) {
        const mine = this.bullets.kind[bi] === BULLET_MINE
        const mx = this.bullets.x[bi]
        const mz = this.bullets.z[bi]
        this.bullets.free(bi)
        if (mine) this.burstMine(mx, mz)
        this.damagePlayer()
        if (!p.alive) return
      }
    }

    // --- enemy bodies vs player
    for (const e of enemies) {
      if (e.dead || e.dying) continue
      if (
        circleHit(
          e.transform.x,
          e.transform.z,
          e.collider.radius * 0.8,
          p.x,
          p.z,
          PLAYER_HIT_RADIUS,
        )
      ) {
        this.damagePlayer()
        if (e.ai?.kind === 'lance') this.damageEntity(e, 9999, true)
        if (!p.alive) return
      }
    }

    // --- boss bodies vs player (arms sweep the screen and hurt on contact)
    for (const e of this.qBossParts.entities) {
      if (e.dead || e.bossPart!.destroyed) continue
      if (
        aabbHit(
          p.x,
          p.z,
          PLAYER_HIT_RADIUS,
          e.transform.x,
          e.transform.z,
          e.collider.hw,
          e.collider.hh,
        )
      ) {
        this.damagePlayer()
        if (!p.alive) return
      }
    }

    // --- pickups
    for (const e of this.qPickups.entities) {
      if (e.dead) continue
      if (circleHit(e.transform.x, e.transform.z, e.collider.radius, p.x, p.z, PICKUP_GRAB)) {
        this.takePickup(e)
      }
    }
  }

  private burstMine(x: number, z: number): void {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      this.bullets.spawn(
        x,
        z,
        Math.cos(a) * 14,
        Math.sin(a) * 14,
        TEAM_ENEMY,
        1,
        0.28,
        BULLET_ENEMY,
      )
    }
    this.particles.burst(this.rng, x, z, 20, 10, 0.5, 0.4, 1.0, 0.45, 0.1)
    this.sfxSink('explode_small')
  }

  private takePickup(e: Entity): void {
    const kind = e.pickup!.kind
    e.dead = true
    if (kind === 'energy') {
      this.player.energy = Math.min(ENERGY_MAX, this.player.energy + ENERGY_PICKUP)
    } else {
      applyPickup(this.player.weapons, kind)
    }
    this.score += 150
    this.bus.emit('pickupTaken', { kind, x: e.transform.x, z: e.transform.z })
    this.sfxSink('pickup')
    this.particles.burst(this.rng, e.transform.x, e.transform.z, 18, 8, 0.5, 0.3, 1, 1, 1)
  }

  // ---------------------------------------------------------------- damage

  damageEntity(e: Entity, amount: number, silent: boolean): void {
    const h = e.health
    if (!h || e.dead || e.dying) return
    h.hp -= amount
    e.sprite.flash = 1
    if (e.bossPart && this.boss) {
      this.boss.hp = Math.max(0, this.boss.hp - Math.min(amount, h.hp + amount))
    }
    if (!silent) this.sfxSink('hit_metal')

    if (h.hp <= 0) {
      if (e.bossPart) this.destroyBossPart(e)
      else this.killEnemy(e)
    }
  }

  private killEnemy(e: Entity): void {
    e.dying = true
    e.sprite.state = 'death'
    e.sprite.time = 0
    this.world.removeComponent(e, 'ai')
    this.world.removeComponent(e, 'weapon')
    e.lifetime = { t: 0.7 }
    e.velocity.x *= 0.2
    e.velocity.z = this.scrollSpeed

    const kind = (e.sprite.entity as EnemyId) ?? 'scrap'
    const stats = ENEMIES[kind]
    const base = e.score ?? stats?.score ?? 100
    this.score += base * this.combo
    this.comboKills++
    if (this.comboKills % 4 === 0) this.combo = Math.min(MAX_COMBO, this.combo + 1)

    const big = (stats?.hp ?? 0) >= 90
    this.particles.burst(
      this.rng,
      e.transform.x,
      e.transform.z,
      big ? 46 : 24,
      big ? 14 : 9,
      0.7,
      big ? 0.6 : 0.4,
      1.0,
      0.6,
      0.2,
    )
    this.sfxSink(big ? 'explode_medium' : 'explode_small')
    this.bus.emit('enemyKilled', {
      x: e.transform.x,
      z: e.transform.z,
      kind,
      score: base * this.combo,
      big,
    })

    const split = SPLITS_INTO[kind]
    if (split) {
      for (let i = 0; i < split.count; i++) {
        const child = this.spawnEnemy(
          split.kind,
          e.transform.x + (i === 0 ? -1.6 : 1.6),
          e.transform.z,
          i === 0 ? -1 : 1,
        )
        if (child?.ai) child.ai.a = this.rng.range(0, 6.28)
      }
    }
  }

  private destroyBossPart(e: Entity): void {
    const bp = e.bossPart!
    bp.destroyed = true
    bp.deadFor = 0
    e.sprite.state = 'destroyed'
    e.sprite.time = 0
    this.score += (e.score ?? 200) * this.combo
    this.shake = Math.max(this.shake, 0.7)
    this.particles.burst(this.rng, e.transform.x, e.transform.z, 60, 16, 1.0, 0.8, 1.0, 0.6, 0.2)
    this.sfxSink('boss_part_destroyed')
    this.bus.emit('bossPartDestroyed', { part: bp.partId, x: e.transform.x, z: e.transform.z })

    this.refreshPartExposure()
  }

  /**
   * Re-evaluate which boss parts can currently be hit.
   *
   * Two gates: a part can wait for a phase, and the core waits for the parts
   * that guard it to be destroyed. Called after any part dies and after every
   * phase shift.
   */
  private refreshPartExposure(): void {
    const b = this.boss
    if (!b) return
    const spec = BOSSES[b.id]

    for (const e of this.qBossParts.entities) {
      const bp = e.bossPart!
      if (bp.partId === spec.corePart) continue
      const need = spec.exposeAt?.[bp.partId] ?? 0
      if (need > 0 && b.phase >= need) bp.invulnerable = false
    }

    const core = b.parts[spec.corePart]?.bossPart
    if (!core || core.destroyed) return
    const guards =
      spec.coreExposedBy ??
      Object.keys(b.parts).filter((k) => k !== spec.corePart && (b.parts[k].health?.max ?? 0) > 0)
    const breached = (k: string): boolean => !!b.parts[k]?.bossPart?.destroyed
    core.invulnerable =
      spec.coreExposeMode === 'any' ? !guards.some(breached) : !guards.every(breached)
  }

  // --------------------------------------------------------------- cleanup

  private sweep(): void {
    const all = this.world.entities
    for (let i = all.length - 1; i >= 0; i--) {
      const e = all[i]
      if (!e.dead) continue
      this.world.remove(e)
      resetEntity(e)
      this.pool.put(e)
    }
  }

  // ----------------------------------------------------------- progression

  private stepProgress(dt: number): void {
    if (this.state === 'dying') {
      if (this.player.respawnIn - dt <= 0) this.state = 'gameOver'
      return
    }
    if (this.state !== 'playing') return
    if (this.level.boss) return // boss levels end when the boss dies

    const done =
      this.time >= this.level.duration &&
      this.waveIndex >= this.level.waves.length &&
      this.qAi.entities.length === 0
    if (done) this.finishLevel()
  }

  private finishLevel(): void {
    const energyBonus = Math.round(this.player.energy) * ENERGY_BONUS_PER_PCT
    const timeBonus = Math.max(0, Math.round(this.level.duration - this.time)) * TIME_BONUS_PER_S
    const noDamageBonus = this.tookDamageThisLevel ? 0 : NO_DAMAGE_BONUS
    const total = this.score + energyBonus + timeBonus + noDamageBonus
    this.result = {
      level: this.level.id,
      score: this.score,
      energyBonus,
      timeBonus,
      noDamageBonus,
      total,
    }
    this.score = total
    this.state = 'cleared'
    this.stateT = 0
    this.bus.emit('levelCleared', { level: this.level.id })
  }

  // ---------------------------------------------------------------- context

  private makeAiContext(): AiContext {
    const sim = this
    return {
      // a getter, because startLevel() reseeds the RNG
      get rng() {
        return sim.rng
      },
      dt: FIXED_DT,
      time: 0,
      playerX: 0,
      playerZ: 0,
      playerAlive: true,
      scroll: 0,
      scrollSpeed: 18,
      particles: this.particles,
      fireEnemy(x, z, vx, vz, damage, radius = 0.32, kind = BULLET_ENEMY) {
        sim.bullets.spawn(
          x,
          z,
          vx,
          vz,
          TEAM_ENEMY,
          damage,
          radius,
          kind,
          kind === BULLET_LASER ? 2 : 5,
        )
      },
      spawnMine(x, z) {
        sim.spawnMine(x, z)
      },
      spawnEnemy(kind, x, z) {
        return sim.spawnEnemy(kind, x, z)
      },
      sfx(name) {
        sim.sfxSink(name)
      },
      halfWidthAt(z) {
        return sim.canyon.halfWidth(sim.scroll - z)
      },
      centerAt(z) {
        return sim.canyon.centerX(sim.scroll - z)
      },
    }
  }

  private makeBossContext(): BossCtx {
    const sim = this
    const base = this.makeAiContext()
    return {
      ...base,
      get rng() {
        return sim.rng
      },
      fireFrom(part, vx, vz, damage, radius = 0.34) {
        sim.bullets.spawn(
          part.transform.x,
          part.transform.z,
          vx,
          vz,
          TEAM_ENEMY,
          damage,
          radius,
          BULLET_ENEMY,
          6,
        )
      },
      summon(kind, x, z) {
        sim.spawnEnemy(kind, x, z)
      },
      shake(amount) {
        sim.shake = Math.max(sim.shake, amount)
      },
    }
  }
}
