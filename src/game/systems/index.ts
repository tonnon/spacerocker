/**
 * System order, run once per fixed step by Simulation.step().
 *
 * The order is load-bearing: AI reads the player position set by the player
 * system, collision reads positions written by movement, and cleanup runs last
 * so nothing is removed while another system still holds a reference.
 *
 *  1. scroll      advance world distance, apply the level's terrain pinch
 *  2. player      input, movement, wall test, energy drain, weapons
 *  3. spawn       waves and pickups due at this timestamp, boss trigger
 *  4. ai          one behaviour per live enemy (src/game/ai)
 *  5. boss        composite FSM, part anchoring, phase thresholds
 *  6. movement    integrate velocities, tick sprite clocks and lifetimes
 *  7. projectiles bullet and particle integration, culling
 *  8. collision   spatial hash broadphase, then circle/AABB narrowphase
 *  9. cleanup     swap-remove dead entities back into the pool
 * 10. progress    level completion, result bonuses
 */
export const SYSTEM_ORDER = [
  'scroll',
  'player',
  'spawn',
  'ai',
  'boss',
  'movement',
  'projectiles',
  'collision',
  'cleanup',
  'progress',
] as const

export type SystemName = (typeof SYSTEM_ORDER)[number]
