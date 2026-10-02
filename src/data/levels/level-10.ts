import type { LevelDefinition } from './types'

/**
 * LEVEL 10 - Sunken City
 * Densidade em curva: sobe, pica em ~70%, respira antes do fim.
 */
export const level10: LevelDefinition = {
  id: 10,
  act: 2,
  name: 'Sunken City',
  biome: 'sunken',
  duration: 150,
  seed: 739108,
  terrain: {
    baseHalf: 9.7,
    amp: 1.5,
    freq: 0.015,
    drift: 1.4,
    driftFreq: 0.008,
    detail: 0.4,
    pylons: 10,
  },
  boss: 'basilisk',
  waves: [
    { at: 4.0, kind: 'interceptor', count: 4, formation: 'v', x: 0.35, spacing: 2.4 },
    { at: 13.1, kind: 'bulwark', count: 3, formation: 'wall', x: 0.07, spacing: 3.08 },
    { at: 19.9, kind: 'miner', count: 2, formation: 'line', x: -0.55, spacing: 2.36 },
    { at: 25.8, kind: 'swarmer', count: 9, formation: 'swarm', x: -0.34, spacing: 2.57 },
    { at: 30.1, kind: 'interceptor', count: 4, formation: 'v', x: -0.15, spacing: 2.39 },
    { at: 34.1, kind: 'bulwark', count: 2, formation: 'wall', x: -0.51, spacing: 1.95 },
    { at: 38.4, kind: 'miner', count: 3, formation: 'line', x: -0.3, spacing: 2.65 },
    { at: 42.4, kind: 'swarmer', count: 11, formation: 'swarm', x: 0.24, spacing: 3.01 },
    { at: 46.8, kind: 'interceptor', count: 4, formation: 'v', x: -0.55, spacing: 2.62 },
    { at: 50.5, kind: 'bulwark', count: 2, formation: 'wall', x: 0.3, spacing: 2.87 },
    { at: 53.9, kind: 'miner', count: 3, formation: 'line', x: 0.41, spacing: 2.81 },
    { at: 57.2, kind: 'swarmer', count: 12, formation: 'swarm', x: 0.08, spacing: 2.18 },
    { at: 62.7, kind: 'interceptor', count: 5, formation: 'v', x: -0.29, spacing: 2.08 },
  ],
  pickups: [
    { at: 6.0, kind: 'energy', x: -0.62 },
    { at: 13.7, kind: 'energy', x: 0.46 },
    { at: 20.5, kind: 'energy', x: -0.59 },
    { at: 29.4, kind: 'energy', x: -0.09 },
    { at: 30.0, kind: 'aegis', x: -0.26 },
    { at: 37.6, kind: 'energy', x: 0.57 },
    { at: 45.8, kind: 'energy', x: 0.33 },
    { at: 54.0, kind: 'energy', x: 0.13 },
    { at: 72.0, kind: 'spread', x: -0.03 },
    { at: 99.0, kind: 'pulse', x: 0.55 },
  ],
}
