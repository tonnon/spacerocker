import { PLAY_HALF_W, TERRAIN_SCALE } from '../core/constants'
import { valueNoise1 } from '../core/rng'

/**
 * The canyon is a 1D function of distance travelled, not a heightfield.
 *
 * That matters: the wall mesh and the collision test call the SAME function,
 * so what kills you is exactly what you can see. Touching a wall is death -
 * that is the River Raid DNA the spec asks us to keep (spec 5).
 */
export interface TerrainParams {
  /** Mean corridor half-width, in world units. */
  baseHalf: number
  /** How much the width breathes around the mean. */
  amp: number
  /** Spatial frequency of the width variation. */
  freq: number
  /** How far the corridor centre wanders. */
  drift: number
  driftFreq: number
  /** Jagged high-frequency detail on the wall face. */
  detail: number
  /** Structures per 100 units, purely decorative. */
  pylons: number
}

export const DEFAULT_TERRAIN: TerrainParams = {
  baseHalf: 9.4,
  amp: 1.7,
  freq: 0.016,
  drift: 1.6,
  driftFreq: 0.009,
  detail: 0.35,
  pylons: 5,
}

export const MIN_HALF = 3.4 * TERRAIN_SCALE

export class Canyon {
  private readonly nWidth: (x: number) => number
  private readonly nDrift: (x: number) => number
  private readonly nDetail: (x: number) => number
  params: TerrainParams
  /** 0..1 extra squeeze, driven by the level (collapsing core, corridors). */
  pinch = 0

  constructor(seed: number, params: TerrainParams = DEFAULT_TERRAIN) {
    // Level files carry the canyon at its authored scale; widening it here
    // keeps all 15 of them untouched while the lane grows to fill the view.
    this.params = {
      ...params,
      baseHalf: params.baseHalf * TERRAIN_SCALE,
      amp: params.amp * TERRAIN_SCALE,
      drift: params.drift * TERRAIN_SCALE,
      detail: params.detail * TERRAIN_SCALE,
    }
    this.nWidth = valueNoise1(seed)
    this.nDrift = valueNoise1(seed ^ 0x5bf03635)
    this.nDetail = valueNoise1(seed ^ 0x1f123bb5)
  }

  /** Corridor centre at travel distance s. */
  centerX(s: number): number {
    const p = this.params
    return (this.nDrift(s * p.driftFreq) - 0.5) * 2 * p.drift
  }

  /** Corridor half-width at travel distance s. */
  halfWidth(s: number): number {
    const p = this.params
    const base = p.baseHalf + (this.nWidth(s * p.freq) - 0.5) * 2 * p.amp
    const detail = (this.nDetail(s * p.freq * 6.3) - 0.5) * 2 * p.detail
    const squeezed = (base + detail) * (1 - 0.42 * this.pinch)
    return Math.max(MIN_HALF, Math.min(PLAY_HALF_W, squeezed))
  }

  /** Left and right wall x at s. */
  leftAt(s: number): number {
    return this.centerX(s) - this.halfWidth(s)
  }

  rightAt(s: number): number {
    return this.centerX(s) + this.halfWidth(s)
  }

  /** True when a disc of radius r at (x, s) is touching rock. */
  hits(x: number, s: number, r: number): boolean {
    const c = this.centerX(s)
    const hw = this.halfWidth(s)
    return Math.abs(x - c) + r > hw
  }

  /** Nearest in-bounds x, used to nudge spawns off the wall. */
  clampInside(x: number, s: number, margin: number): number {
    const c = this.centerX(s)
    const hw = Math.max(0.5, this.halfWidth(s) - margin)
    return Math.max(c - hw, Math.min(c + hw, x))
  }
}
