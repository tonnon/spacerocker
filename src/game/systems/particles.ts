import { MAX_PARTICLES } from '../core/constants'
import { SoaPool } from '../core/pool'
import type { Rng } from '../core/rng'

/** Additive spark/smoke pool. One InstancedMesh, one draw call. */
export class Particles {
  readonly pool = new SoaPool(MAX_PARTICLES)
  readonly x = new Float32Array(MAX_PARTICLES)
  readonly y = new Float32Array(MAX_PARTICLES)
  readonly z = new Float32Array(MAX_PARTICLES)
  readonly vx = new Float32Array(MAX_PARTICLES)
  readonly vy = new Float32Array(MAX_PARTICLES)
  readonly vz = new Float32Array(MAX_PARTICLES)
  readonly life = new Float32Array(MAX_PARTICLES)
  readonly maxLife = new Float32Array(MAX_PARTICLES)
  readonly size = new Float32Array(MAX_PARTICLES)
  readonly r = new Float32Array(MAX_PARTICLES)
  readonly g = new Float32Array(MAX_PARTICLES)
  readonly b = new Float32Array(MAX_PARTICLES)

  /** Scaled by reduced-motion and by the low-spec fallback. */
  density = 1

  get count(): number {
    return this.pool.count
  }

  private move = (from: number, to: number): void => {
    this.x[to] = this.x[from]
    this.y[to] = this.y[from]
    this.z[to] = this.z[from]
    this.vx[to] = this.vx[from]
    this.vy[to] = this.vy[from]
    this.vz[to] = this.vz[from]
    this.life[to] = this.life[from]
    this.maxLife[to] = this.maxLife[from]
    this.size[to] = this.size[from]
    this.r[to] = this.r[from]
    this.g[to] = this.g[from]
    this.b[to] = this.b[from]
  }

  spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size: number,
    r: number,
    g: number,
    b: number,
  ): void {
    const i = this.pool.alloc()
    if (i < 0) return
    this.x[i] = x
    this.y[i] = y
    this.z[i] = z
    this.vx[i] = vx
    this.vy[i] = vy
    this.vz[i] = vz
    this.life[i] = life
    this.maxLife[i] = life
    this.size[i] = size
    this.r[i] = r
    this.g[i] = g
    this.b[i] = b
  }

  burst(
    rng: Rng,
    x: number,
    z: number,
    n: number,
    speed: number,
    life: number,
    size: number,
    r: number,
    g: number,
    b: number,
  ): void {
    const count = Math.max(1, Math.round(n * this.density))
    for (let i = 0; i < count; i++) {
      const a = rng.next() * Math.PI * 2
      const s = speed * (0.35 + rng.next() * 0.9)
      this.spawn(
        x,
        0.3 + rng.next() * 0.7,
        z,
        Math.cos(a) * s,
        (rng.next() - 0.3) * speed * 0.6,
        Math.sin(a) * s,
        life * (0.6 + rng.next() * 0.7),
        size * (0.7 + rng.next() * 0.8),
        r,
        g,
        b,
      )
    }
  }

  /** Engine trail: a couple of sparks dropped behind a ship each step. */
  trail(rng: Rng, x: number, z: number, r: number, g: number, b: number): void {
    if (rng.next() > 0.55 * this.density) return
    this.spawn(
      x + (rng.next() - 0.5) * 0.3,
      0.25,
      z + 0.4,
      (rng.next() - 0.5) * 1.2,
      0,
      6 + rng.next() * 4,
      0.24 + rng.next() * 0.2,
      0.3 + rng.next() * 0.25,
      r,
      g,
      b,
    )
  }

  update(dt: number, scroll: number): void {
    for (let i = this.pool.count - 1; i >= 0; i--) {
      this.life[i] -= dt
      if (this.life[i] <= 0) {
        this.pool.free(i, this.move)
        continue
      }
      this.x[i] += this.vx[i] * dt
      this.y[i] += this.vy[i] * dt
      this.z[i] += (this.vz[i] + scroll) * dt
      const drag = 1 - 1.7 * dt
      this.vx[i] *= drag
      this.vz[i] *= drag
      this.vy[i] -= 2.6 * dt
    }
  }

  reset(): void {
    this.pool.reset()
  }
}
