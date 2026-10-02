import type { LevelDefinition } from './types'

/**
 * LEVEL 01 - Orbital Canyon
 * Densidade em curva: sobe, pica em ~70%, respira antes do fim.
 */
export const level01: LevelDefinition = {
  id: 1,
  act: 1,
  name: 'Orbital Canyon',
  biome: 'canyon',
  duration: 90,
  seed: 667837,
  terrain: {
    baseHalf: 9.6,
    amp: 1.7,
    freq: 0.016,
    drift: 1.6,
    driftFreq: 0.009,
    detail: 0.35,
    pylons: 5,
  },
  waves: [
    { at: 4.0, kind: 'scrap', count: 4, formation: 'line', x: -0.7, spacing: 2.57 },
    { at: 14.2, kind: 'interceptor', count: 4, formation: 'v', x: -0.07, spacing: 2.26 },
    { at: 22.0, kind: 'scrap', count: 3, formation: 'line', x: 0.16, spacing: 2.5 },
    { at: 30.1, kind: 'interceptor', count: 5, formation: 'v', x: -0.45, spacing: 2.45 },
    { at: 34.1, kind: 'scrap', count: 2, formation: 'line', x: 0.65, spacing: 2.33 },
    { at: 39.0, kind: 'interceptor', count: 4, formation: 'v', x: -0.12, spacing: 2.04 },
    { at: 42.6, kind: 'scrap', count: 4, formation: 'line', x: -0.39, spacing: 2.4 },
    { at: 46.8, kind: 'interceptor', count: 4, formation: 'v', x: 0.62, spacing: 2.73 },
    { at: 50.6, kind: 'scrap', count: 3, formation: 'line', x: 0.19, spacing: 2.3 },
    { at: 53.6, kind: 'interceptor', count: 5, formation: 'v', x: 0.15, spacing: 2.39 },
    { at: 57.6, kind: 'scrap', count: 2, formation: 'line', x: -0.62, spacing: 2.59 },
    { at: 61.2, kind: 'interceptor', count: 4, formation: 'v', x: -0.01, spacing: 2.0 },
    { at: 64.0, kind: 'scrap', count: 4, formation: 'line', x: -0.41, spacing: 3.08 },
    { at: 67.3, kind: 'interceptor', count: 4, formation: 'v', x: -0.28, spacing: 3.04 },
    { at: 71.5, kind: 'scrap', count: 3, formation: 'line', x: 0.51, spacing: 2.32 },
    { at: 74.9, kind: 'interceptor', count: 5, formation: 'v', x: -0.48, spacing: 2.5 },
    { at: 78.0, kind: 'scrap', count: 2, formation: 'line', x: 0.08, spacing: 2.02 },
  ],
  pickups: [
    { at: 6.0, kind: 'energy', x: 0.19 },
    { at: 14.5, kind: 'energy', x: -0.05 },
    { at: 22.0, kind: 'energy', x: -0.19 },
    { at: 30.5, kind: 'energy', x: 0.66 },
    { at: 39.9, kind: 'energy', x: 0.37 },
    { at: 47.4, kind: 'energy', x: 0.39 },
    { at: 56.3, kind: 'energy', x: -0.29 },
    { at: 64.3, kind: 'energy', x: 0.48 },
    { at: 72.0, kind: 'energy', x: -0.36 },
    { at: 78.8, kind: 'energy', x: 0.25 },
  ],
}
