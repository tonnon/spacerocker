/** Design tokens (spec §3). Hex strings for CSS, numbers for three.js. */

export const PALETTE = {
  void: '#05060D',
  hull: '#2A2F3E',
  hullLight: '#4B5368',
  rust: '#7A4A3C',
  signal: '#FF2E88',
  coolant: '#00E5FF',
} as const

export const HEX = {
  void: 0x05060d,
  hull: 0x2a2f3e,
  hullLight: 0x4b5368,
  rust: 0x7a4a3c,
  signal: 0xff2e88,
  coolant: 0x00e5ff,
  /** Reading rule (spec §3): enemy fire is ALWAYS this orange. */
  enemyShot: 0xff6b1a,
  /** Reading rule: player fire is ALWAYS this cyan. */
  playerShot: 0x00e5ff,
  pickup: 0xffffff,
} as const

export type ActId = 1 | 2 | 3

export interface ActTheme {
  id: ActId
  name: string
  /** Terrain ambient / fog tint. */
  light: number
  fog: number
  floor: number
  wall: number
  wallEdge: number
  bpm: number
  /** Tonic used by the synthesised score. */
  tonic: string
}

export const ACTS: Record<ActId, ActTheme> = {
  1: {
    id: 1,
    name: 'Dead Orbit',
    light: 0x4a6da8,
    fog: 0x0a0f1e,
    floor: 0x16203a,
    wall: 0x2a3550,
    wallEdge: 0x00e5ff,
    bpm: 132,
    tonic: 'A',
  },
  2: {
    id: 2,
    name: 'Neon Reef',
    light: 0x2f8f7a,
    fog: 0x061713,
    floor: 0x102f28,
    wall: 0x24453f,
    wallEdge: 0x9d4edd,
    bpm: 144,
    tonic: 'C',
  },
  3: {
    id: 3,
    name: 'Core Collapse',
    light: 0xc0472a,
    fog: 0x1a0907,
    floor: 0x301511,
    wall: 0x4a221a,
    wallEdge: 0xff6b1a,
    bpm: 156,
    tonic: 'F',
  },
}

export const actOf = (level: number): ActId => (level <= 5 ? 1 : level <= 10 ? 2 : 3)
