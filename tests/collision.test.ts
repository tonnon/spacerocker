import { describe, expect, it } from 'vitest'
import { PLAY_HALF_W, PLAYER_HIT_RADIUS } from '@/game/core/constants'
import { aabbHit, circleHit, SpatialHash } from '@/game/core/spatialHash'
import { Canyon, DEFAULT_TERRAIN, MIN_HALF } from '@/game/world/canyon'

describe('circleHit', () => {
  it('detects overlap and separation', () => {
    expect(circleHit(0, 0, 1, 1.5, 0, 1)).toBe(true)
    expect(circleHit(0, 0, 1, 2.5, 0, 1)).toBe(false)
  })

  it('treats exact touching as a hit', () => {
    expect(circleHit(0, 0, 1, 2, 0, 1)).toBe(true)
  })

  it('is symmetric', () => {
    expect(circleHit(3, -2, 0.7, 3.9, -1.4, 0.5)).toBe(circleHit(3.9, -1.4, 0.5, 3, -2, 0.7))
  })
})

describe('aabbHit', () => {
  it('hits a disc overlapping the box face', () => {
    expect(aabbHit(0, 3.4, 0.5, 0, 0, 2, 3)).toBe(true)
    expect(aabbHit(0, 4.2, 0.5, 0, 0, 2, 3)).toBe(false)
  })

  it('hits on the corner only within the radius', () => {
    // corner at (2, 3); a disc centred 0.2 diagonally out still touches
    expect(aabbHit(2.1, 3.1, 0.2, 0, 0, 2, 3)).toBe(true)
    expect(aabbHit(3, 4, 0.2, 0, 0, 2, 3)).toBe(false)
  })

  it('hits when fully inside', () => {
    expect(aabbHit(0, 0, 0.1, 0, 0, 2, 3)).toBe(true)
  })
})

describe('SpatialHash', () => {
  it('returns candidates in the neighbourhood and nothing far away', () => {
    const grid = new SpatialHash()
    grid.clear()
    grid.insert(1, 0, 0)
    grid.insert(2, 1, 1)
    grid.insert(3, 30, -50)

    const out = new Int32Array(64)
    const n = grid.query(0, 0, 1, out)
    const found = Array.from(out.slice(0, n))
    expect(found).toContain(1)
    expect(found).toContain(2)
    expect(found).not.toContain(3)
  })

  it('never misses a pair that actually overlaps', () => {
    const grid = new SpatialHash()
    const out = new Int32Array(256)
    const pts: [number, number][] = []
    let seed = 7
    const rnd = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 0x100000000
    }
    for (let i = 0; i < 400; i++) {
      pts.push([rnd() * 60 - 30, rnd() * 60 - 45])
    }
    grid.clear()
    pts.forEach(([x, z], i) => {
      grid.insert(i, x, z)
    })

    const R = 1.5
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i]
      const n = grid.query(x, z, R * 2, out)
      const candidates = new Set(Array.from(out.slice(0, n)))
      for (let j = 0; j < pts.length; j++) {
        if (i === j) continue
        if (circleHit(x, z, R, pts[j][0], pts[j][1], R)) {
          expect(candidates.has(j)).toBe(true)
        }
      }
    }
  })

  it('clear() empties every bucket', () => {
    const grid = new SpatialHash()
    grid.insert(5, 0, 0)
    grid.clear()
    const out = new Int32Array(8)
    expect(grid.query(0, 0, 1, out)).toBe(0)
  })
})

describe('Canyon', () => {
  it('is deterministic for a seed', () => {
    const a = new Canyon(1234, DEFAULT_TERRAIN)
    const b = new Canyon(1234, DEFAULT_TERRAIN)
    for (let s = 0; s < 3000; s += 7.3) {
      expect(a.halfWidth(s)).toBe(b.halfWidth(s))
      expect(a.centerX(s)).toBe(b.centerX(s))
    }
  })

  it('keeps the corridor inside playable bounds', () => {
    const c = new Canyon(99, DEFAULT_TERRAIN)
    for (let s = 0; s < 6000; s += 3.1) {
      const hw = c.halfWidth(s)
      expect(hw).toBeGreaterThanOrEqual(MIN_HALF)
      expect(hw).toBeLessThanOrEqual(PLAY_HALF_W)
    }
  })

  it('agrees with what it draws: hits() matches leftAt/rightAt', () => {
    const c = new Canyon(2025, DEFAULT_TERRAIN)
    for (let s = 0; s < 1500; s += 11.7) {
      const left = c.leftAt(s)
      const right = c.rightAt(s)
      const r = PLAYER_HIT_RADIUS
      // just inside both walls is safe
      expect(c.hits((left + right) / 2, s, r)).toBe(false)
      // past either wall is death
      expect(c.hits(left - 0.01, s, r)).toBe(true)
      expect(c.hits(right + 0.01, s, r)).toBe(true)
    }
  })

  it('pinch narrows the corridor without inverting it', () => {
    const c = new Canyon(5, DEFAULT_TERRAIN)
    const open = c.halfWidth(100)
    c.pinch = 1
    const closed = c.halfWidth(100)
    expect(closed).toBeLessThanOrEqual(open)
    expect(closed).toBeGreaterThanOrEqual(MIN_HALF)
  })

  it('clampInside returns a point that does not hit', () => {
    const c = new Canyon(77, DEFAULT_TERRAIN)
    for (let s = 0; s < 800; s += 9) {
      const x = c.clampInside(999, s, 1.0)
      expect(c.hits(x, s, 0.4)).toBe(false)
    }
  })
})
