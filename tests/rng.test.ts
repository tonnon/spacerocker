import { describe, expect, it } from 'vitest'
import { mulberry32, valueNoise1 } from '@/game/core/rng'

describe('mulberry32', () => {
  it('is deterministic: same seed, same stream', () => {
    const a = mulberry32(0x5eed)
    const b = mulberry32(0x5eed)
    const left = Array.from({ length: 64 }, () => a.next())
    const right = Array.from({ length: 64 }, () => b.next())
    expect(left).toEqual(right)
  })

  it('diverges for different seeds', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    expect(a.next()).not.toBe(b.next())
  })

  it('stays inside [0, 1)', () => {
    const r = mulberry32(12345)
    for (let i = 0; i < 20000; i++) {
      const v = r.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('range and int respect their bounds', () => {
    const r = mulberry32(99)
    for (let i = 0; i < 5000; i++) {
      const v = r.range(-3, 7)
      expect(v).toBeGreaterThanOrEqual(-3)
      expect(v).toBeLessThan(7)
      const n = r.int(2, 5)
      expect(n).toBeGreaterThanOrEqual(2)
      expect(n).toBeLessThanOrEqual(5)
      expect(Number.isInteger(n)).toBe(true)
    }
  })

  it('forks reproducibly and independently of the parent', () => {
    const parent = mulberry32(7)
    const one = parent.fork(3)
    const two = mulberry32(7).fork(3)
    expect(one.next()).toBe(two.next())
    expect(mulberry32(7).fork(4).next()).not.toBe(mulberry32(7).fork(3).next())
  })
})

describe('valueNoise1', () => {
  it('is deterministic and continuous', () => {
    const n = valueNoise1(4242)
    const m = valueNoise1(4242)
    for (let i = 0; i < 200; i++) {
      const x = i * 0.37
      expect(n(x)).toBe(m(x))
    }
    // smoothstep interpolation: neighbouring samples never jump far
    let prev = n(0)
    for (let i = 1; i < 500; i++) {
      const v = n(i * 0.01)
      expect(Math.abs(v - prev)).toBeLessThan(0.2)
      prev = v
    }
  })

  it('returns integers of the lattice exactly on repeat', () => {
    const n = valueNoise1(1)
    expect(n(5)).toBe(n(5))
    expect(n(5)).toBeGreaterThanOrEqual(0)
    expect(n(5)).toBeLessThanOrEqual(1)
  })
})
