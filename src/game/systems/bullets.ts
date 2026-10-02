import { DESPAWN_Z, DESPAWN_Z_FAR, MAX_BULLETS, PLAY_HALF_W } from '../core/constants'
import { SoaPool } from '../core/pool'

/** Bullet kind drives the shader shape, not just the colour. */
export const BULLET_PLAYER = 0
export const BULLET_ENEMY = 1
export const BULLET_LASER = 2
export const BULLET_SEEKER = 3
export const BULLET_MINE = 4

export const TEAM_PLAYER = 0
export const TEAM_ENEMY = 1

/**
 * Every shot in flight, as parallel typed arrays. One InstancedMesh per team
 * draws the whole lot, so 1200 bullets cost two draw calls (spec 4).
 */
export class Bullets {
  readonly pool = new SoaPool(MAX_BULLETS)
  readonly x = new Float32Array(MAX_BULLETS)
  readonly z = new Float32Array(MAX_BULLETS)
  readonly px = new Float32Array(MAX_BULLETS)
  readonly pz = new Float32Array(MAX_BULLETS)
  readonly vx = new Float32Array(MAX_BULLETS)
  readonly vz = new Float32Array(MAX_BULLETS)
  readonly radius = new Float32Array(MAX_BULLETS)
  readonly damage = new Float32Array(MAX_BULLETS)
  readonly life = new Float32Array(MAX_BULLETS)
  readonly kind = new Uint8Array(MAX_BULLETS)
  readonly team = new Uint8Array(MAX_BULLETS)
  /** Seconds a mine waits before it can be triggered. */
  readonly fuse = new Float32Array(MAX_BULLETS)

  get count(): number {
    return this.pool.count
  }

  private move = (from: number, to: number): void => {
    this.x[to] = this.x[from]
    this.z[to] = this.z[from]
    this.px[to] = this.px[from]
    this.pz[to] = this.pz[from]
    this.vx[to] = this.vx[from]
    this.vz[to] = this.vz[from]
    this.radius[to] = this.radius[from]
    this.damage[to] = this.damage[from]
    this.life[to] = this.life[from]
    this.kind[to] = this.kind[from]
    this.team[to] = this.team[from]
    this.fuse[to] = this.fuse[from]
  }

  spawn(
    x: number,
    z: number,
    vx: number,
    vz: number,
    team: number,
    damage: number,
    radius = 0.3,
    kind = team === TEAM_PLAYER ? BULLET_PLAYER : BULLET_ENEMY,
    life = 4,
  ): number {
    const i = this.pool.alloc()
    if (i < 0) return -1
    this.x[i] = x
    this.z[i] = z
    this.px[i] = x
    this.pz[i] = z
    this.vx[i] = vx
    this.vz[i] = vz
    this.radius[i] = radius
    this.damage[i] = damage
    this.life[i] = life
    this.kind[i] = kind
    this.team[i] = team
    this.fuse[i] = 0
    return i
  }

  free(i: number): void {
    this.pool.free(i, this.move)
  }

  reset(): void {
    this.pool.reset()
  }

  /** Integrate and cull. Iterates backwards so swap-remove stays safe. */
  update(dt: number, scroll: number): void {
    for (let i = this.pool.count - 1; i >= 0; i--) {
      this.px[i] = this.x[i]
      this.pz[i] = this.z[i]
      // Mines are terrain-locked: they ride the scroll instead of flying.
      const drift = this.kind[i] === BULLET_MINE ? scroll : 0
      this.x[i] += this.vx[i] * dt
      this.z[i] += (this.vz[i] + drift) * dt
      this.life[i] -= dt
      if (this.fuse[i] > 0) this.fuse[i] -= dt
      if (
        this.life[i] <= 0 ||
        this.z[i] > DESPAWN_Z ||
        this.z[i] < DESPAWN_Z_FAR ||
        this.x[i] < -PLAY_HALF_W - 8 ||
        this.x[i] > PLAY_HALF_W + 8
      ) {
        this.free(i)
      }
    }
  }

  /** PULSE bomb: wipes every enemy shot on screen (spec 5). */
  clearEnemyShots(): number {
    let n = 0
    for (let i = this.pool.count - 1; i >= 0; i--) {
      if (this.team[i] === TEAM_ENEMY) {
        this.free(i)
        n++
      }
    }
    return n
  }
}
