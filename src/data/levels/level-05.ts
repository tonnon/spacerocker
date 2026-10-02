import type { LevelDefinition } from './types'

/**
 * LEVEL 05 - Cargo Dock
 * Densidade em curva: sobe, pica em ~70%, respira antes do fim.
 */
export const level05: LevelDefinition = {
  id: 5,
  act: 1,
  name: 'Cargo Dock',
  biome: 'dock',
  duration: 120,
  seed: 699513,
  terrain: {
    baseHalf: 9.9,
    amp: 1.2,
    freq: 0.013,
    drift: 1.1,
    driftFreq: 0.007,
    detail: 0.3,
    pylons: 7,
  },
  boss: 'hexapod',
  waves: [
    { at: 4.0, kind: 'scrap', count: 3, formation: 'line', x: 0.41, spacing: 3.03 },
    { at: 14.3, kind: 'interceptor', count: 5, formation: 'v', x: 0.64, spacing: 2.89 },
    { at: 19.9, kind: 'swarmer', count: 11, formation: 'swarm', x: 0.49, spacing: 2.43 },
    { at: 24.9, kind: 'scrap', count: 4, formation: 'line', x: 0.24, spacing: 2.77 },
    { at: 28.9, kind: 'interceptor', count: 4, formation: 'v', x: -0.02, spacing: 3.02 },
    { at: 31.8, kind: 'swarmer', count: 12, formation: 'swarm', x: 0.18, spacing: 2.4 },
    { at: 35.6, kind: 'scrap', count: 3, formation: 'line', x: -0.67, spacing: 2.38 },
    { at: 38.3, kind: 'interceptor', count: 4, formation: 'v', x: -0.51, spacing: 2.05 },
    { at: 42.6, kind: 'swarmer', count: 8, formation: 'swarm', x: -0.14, spacing: 2.71 },
    { at: 47.9, kind: 'scrap', count: 2, formation: 'line', x: -0.1, spacing: 1.93 },
  ],
  pickups: [
    { at: 6.0, kind: 'energy', x: -0.34 },
    { at: 14.0, kind: 'energy', x: -0.09 },
    { at: 21.0, kind: 'energy', x: -0.54 },
    { at: 26.4, kind: 'pulse', x: -0.1 },
    { at: 30.0, kind: 'energy', x: -0.65 },
    { at: 37.5, kind: 'energy', x: 0.19 },
    { at: 46.7, kind: 'energy', x: -0.31 },
    { at: 66.0, kind: 'aegis', x: 0.08 },
  ],
}
