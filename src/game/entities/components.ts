import type { EnemyId } from '@/data/enemies'

export type Team = 'player' | 'enemy' | 'neutral'

/** px/pz hold the previous step, so the renderer can interpolate. */
export interface Transform {
  x: number
  z: number
  px: number
  pz: number
  rot: number
  scale: number
}

export interface Velocity {
  x: number
  z: number
}

export interface Sprite {
  atlas: string
  entity: string
  state: string
  /** Seconds into the current clip. */
  time: number
  /** 0..1 white hit flash. */
  flash: number
  /** Extra per-entity alpha, used while dissolving. */
  alpha: number
}

export interface Health {
  hp: number
  max: number
  invuln: number
}

export interface Collider {
  radius: number
  /** Boss slabs test as AABB; everything else as a circle. */
  box: boolean
  hw: number
  hh: number
}

export interface Weapon {
  timer: number
  cooldown: number
  /** Seconds of visible wind-up before firing. Never below 0.4 (spec 7). */
  telegraph: number
  charging: boolean
  burstLeft: number
}

export interface AIBehavior {
  kind: EnemyId
  /** Age in seconds. */
  t: number
  /** Behaviour-local scratch; meaning depends on kind. */
  a: number
  b: number
  c: number
  phase: number
  homeX: number
  baseZ: number
  dir: number
}

export interface Lifetime {
  t: number
}

export type PickupKind = 'spread' | 'lance' | 'seeker' | 'aegis' | 'wingman' | 'pulse' | 'energy'

export interface PickupC {
  kind: PickupKind
  bob: number
}

export interface BossPartC {
  bossId: string
  partId: string
  anchorX: number
  anchorZ: number
  destroyed: boolean
  /** Seconds since destruction, drives the destroyed clip. */
  deadFor: number
  fireTimer: number
  /** Parts can be shielded while the boss is in an earlier phase. */
  invulnerable: boolean
}

export interface Entity {
  transform: Transform
  velocity: Velocity
  team: Team
  sprite: Sprite
  collider: Collider
  health?: Health
  weapon?: Weapon
  ai?: AIBehavior
  lifetime?: Lifetime
  pickup?: PickupC
  bossPart?: BossPartC
  /** Score awarded on kill. */
  score?: number
  /** Marked here, removed at the end of the step. */
  dead?: boolean
  /** Playing its death animation: still drawn, no longer collidable. */
  dying?: boolean
}

export const makeEntity = (): Entity => ({
  transform: { x: 0, z: 0, px: 0, pz: 0, rot: 0, scale: 1 },
  velocity: { x: 0, z: 0 },
  team: 'enemy',
  sprite: { atlas: 'act1', entity: 'scrap', state: 'idle', time: 0, flash: 0, alpha: 1 },
  collider: { radius: 1, box: false, hw: 1, hh: 1 },
})

/** Wipe optional components so a pooled entity is clean on reuse. */
export function resetEntity(e: Entity): void {
  e.transform.x = 0
  e.transform.z = 0
  e.transform.px = 0
  e.transform.pz = 0
  e.transform.rot = 0
  e.transform.scale = 1
  e.velocity.x = 0
  e.velocity.z = 0
  e.sprite.flash = 0
  e.sprite.time = 0
  e.sprite.alpha = 1
  e.collider.box = false
  e.health = undefined
  e.weapon = undefined
  e.ai = undefined
  e.lifetime = undefined
  e.pickup = undefined
  e.bossPart = undefined
  e.score = undefined
  e.dead = undefined
  e.dying = undefined
}
