/** Bestiary stats (spec 7). Behaviour lives in src/game/ai. */

export type EnemyId =
  | 'scrap'
  | 'interceptor'
  | 'turret'
  | 'swarmer'
  | 'bulwark'
  | 'miner'
  | 'lance'
  | 'wraith'
  | 'splitter'
  | 'runner'
  | 'barge'

export interface EnemyStats {
  id: EnemyId
  name: string
  hp: number
  score: number
  /** Forward speed in u/s, on top of the level scroll. */
  speed: number
  /** Seconds between shots. */
  fireRate: number
  /** Visible wind-up. Never below 0.4 (spec 7, telegraphy rule). */
  telegraph: number
  /** Shot speed in u/s. */
  shotSpeed: number
  damage: number
  /** Which atlas entity to draw. Act atlases share these ids. */
  sprite: string
  /** Elite frames are 192px, so they need a bigger billboard. */
  elite: boolean
  /** First level it can appear in. */
  introducedAt: number
}

const E = (
  id: EnemyId,
  name: string,
  hp: number,
  score: number,
  speed: number,
  fireRate: number,
  telegraph: number,
  shotSpeed: number,
  damage: number,
  introducedAt: number,
  elite = false,
): EnemyStats => ({
  id,
  name,
  hp,
  score,
  speed,
  fireRate,
  telegraph,
  shotSpeed,
  damage,
  sprite: id,
  elite,
  introducedAt,
})

// Speeds are in world units/s and were scaled with the lane when the
// camera pulled back; at the old values everything crawled.
export const ENEMIES: Record<EnemyId, EnemyStats> = {
  scrap: E('scrap', 'Scrap', 20, 100, 7.8, 1.8, 0.45, 20, 1, 1),
  interceptor: E('interceptor', 'Interceptor', 30, 150, 19.5, 2.4, 0.45, 23, 1, 1),
  turret: E('turret', 'Fulcrum Turret', 60, 250, 0.0, 2.6, 0.55, 22, 1, 2),
  swarmer: E('swarmer', 'Wasp Swarm', 12, 60, 14.3, 2.8, 0.4, 21, 1, 4),
  bulwark: E('bulwark', 'Bulwark', 90, 400, 6.5, 2.2, 0.5, 21, 1, 6, true),
  miner: E('miner', 'Seeder', 45, 300, 9.1, 2.6, 0.5, 16, 1, 7),
  lance: E('lance', 'Kamikaze Lance', 35, 220, 11.7, 3.2, 0.6, 0, 1, 8),
  wraith: E('wraith', 'Wraith', 50, 350, 6.5, 3.4, 1.2, 60, 1, 9),
  splitter: E('splitter', 'Splitter', 70, 450, 9.1, 2.4, 0.45, 21, 1, 11),
  runner: E('runner', 'Phase Runner', 40, 400, 10.4, 2.5, 0.45, 26, 1, 12),
  barge: E('barge', 'Barge', 140, 800, 3.9, 3.6, 0.7, 17, 1, 13, true),
}

export const ENEMY_IDS = Object.keys(ENEMIES) as EnemyId[]
