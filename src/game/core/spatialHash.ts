import { GRID_CELL } from './constants'

/**
 * Uniform grid broadphase (spec §4: no library broadphase).
 * Buckets are pre-allocated Int32Arrays; insert/query never allocate.
 */
export class SpatialHash {
  private readonly cell: number
  private readonly cols: number
  private readonly rows: number
  private readonly minX: number
  private readonly minZ: number
  private readonly counts: Int32Array
  private readonly items: Int32Array
  private readonly perCell: number

  constructor(minX = -40, maxX = 40, minZ = -60, maxZ = 20, cell = GRID_CELL, perCell = 32) {
    this.cell = cell
    this.minX = minX
    this.minZ = minZ
    this.cols = Math.ceil((maxX - minX) / cell) + 1
    this.rows = Math.ceil((maxZ - minZ) / cell) + 1
    this.perCell = perCell
    this.counts = new Int32Array(this.cols * this.rows)
    this.items = new Int32Array(this.cols * this.rows * perCell)
  }

  clear(): void {
    this.counts.fill(0)
  }

  private index(x: number, z: number): number {
    const cx = Math.min(this.cols - 1, Math.max(0, ((x - this.minX) / this.cell) | 0))
    const cz = Math.min(this.rows - 1, Math.max(0, ((z - this.minZ) / this.cell) | 0))
    return cz * this.cols + cx
  }

  insert(id: number, x: number, z: number): void {
    const c = this.index(x, z)
    const n = this.counts[c]
    if (n < this.perCell) {
      this.items[c * this.perCell + n] = id
      this.counts[c] = n + 1
    }
  }

  /**
   * Visit every id in the 3x3 neighbourhood around (x, z).
   * `out` is caller-owned and reused, so querying allocates nothing.
   */
  query(x: number, z: number, radius: number, out: Int32Array): number {
    let n = 0
    const r = Math.max(1, Math.ceil(radius / this.cell))
    const cx = Math.min(this.cols - 1, Math.max(0, ((x - this.minX) / this.cell) | 0))
    const cz = Math.min(this.rows - 1, Math.max(0, ((z - this.minZ) / this.cell) | 0))
    for (let dz = -r; dz <= r; dz++) {
      const zz = cz + dz
      if (zz < 0 || zz >= this.rows) continue
      for (let dx = -r; dx <= r; dx++) {
        const xx = cx + dx
        if (xx < 0 || xx >= this.cols) continue
        const c = zz * this.cols + xx
        const count = this.counts[c]
        for (let i = 0; i < count; i++) {
          if (n >= out.length) return n
          out[n++] = this.items[c * this.perCell + i]
        }
      }
    }
    return n
  }
}

/** circle-circle, the test used for every ship and shot. */
export const circleHit = (
  ax: number,
  az: number,
  ar: number,
  bx: number,
  bz: number,
  br: number,
): boolean => {
  const dx = ax - bx
  const dz = az - bz
  const r = ar + br
  return dx * dx + dz * dz <= r * r
}

/** AABB, used for boss parts which are rectangular slabs, not discs. */
export const aabbHit = (
  px: number,
  pz: number,
  pr: number,
  cx: number,
  cz: number,
  hw: number,
  hh: number,
): boolean => {
  const nx = Math.max(cx - hw, Math.min(px, cx + hw))
  const nz = Math.max(cz - hh, Math.min(pz, cz + hh))
  const dx = px - nx
  const dz = pz - nz
  return dx * dx + dz * dz <= pr * pr
}
