/** World, camera and budget constants. One place, so tuning is one edit. */

export const DEG = Math.PI / 180

/** Simulation runs at a fixed 60 Hz; rendering interpolates between steps. */
export const FIXED_DT = 1 / 60
export const MAX_CATCHUP_STEPS = 5

/** Playfield: x is lateral, z is depth (negative = ahead of the player). */
export const PLAY_HALF_W = 16.5
export const PLAYER_Z_MIN = -18
// The view reaches z ~ +6.9 at the bottom of the frame; stopping the
// player at -3 left the lower quarter of the screen unreachable, which
// reads as the ship refusing to follow the cursor.
export const PLAYER_Z_MAX = 3
export const SPAWN_Z = -34
export const DESPAWN_Z = 11
export const DESPAWN_Z_FAR = -56

/**
 * The band an enemy will actually fight in.
 *
 * Enemies spawn well beyond the far edge so they can fly in, but they
 * must not shoot from off-screen: getting hit by something you cannot
 * see is the least fair thing a shmup can do. Weapon clocks freeze
 * outside this band, so a ship still telegraphs normally once it enters.
 */
export const ENGAGE_Z_MIN = -25
export const ENGAGE_Z_MAX = 6

/** Camera: not top-down. The tilt is what sells the 3D (spec §2). */
export const CAM_FOV = 42
export const CAM_PITCH = 68 * DEG
/**
 * How far back the camera sits.
 *
 * A uniformly bigger world looks identical to a further camera, so only two
 * numbers actually change the feel: this, and how big a sprite is next to the
 * lane (PX_PER_UNIT vs the canyon width). 36 shows ~49 units across and ~30
 * deep, which puts a ship at ~4% of the screen - the scale a classic vertical
 * shooter reads at, with the cosmos doing the rest.
 */
export const CAM_DIST = 36
export const CAM_LOOK_Z = -6

/** Billboards lean back to meet the camera instead of lying flat. */
export const SPRITE_TILT = -64 * DEG

/** Atlas pixels per world unit. 128px frame -> ~2.06 units. */
export const PX_PER_UNIT = 62

/** Canyon width multiplier, so the lane fills the wider view. */
export const TERRAIN_SCALE = 1.45

/** Boss frames are small on purpose; this is what makes them loom. */
export const BOSS_WORLD_SCALE = 3.05

/** Layer 1 is the only thing SelectiveBloom reads. */
export const LAYER_DEFAULT = 0
export const LAYER_EMISSIVE = 1

/** Pre-allocated pools (spec §4). */
export const MAX_BULLETS = 1200
export const MAX_ENEMIES = 120
export const MAX_PARTICLES = 2000
export const MAX_TEXTS = 48

/** Spatial hash cell size. */
export const GRID_CELL = 4

/** Scroll: 18 u/s base, +4% per level. */
export const BASE_SCROLL = 23
export const SCROLL_GROWTH = 1.04
export const scrollSpeedFor = (level: number): number => BASE_SCROLL * SCROLL_GROWTH ** (level - 1)

/** Energy is River Raid's fuel: it forces you forward (spec §5). */
export const ENERGY_DRAIN_PER_S = 1.4
export const ENERGY_PICKUP = 26
/** How close you must get to collect. Scales with the lane, or the fuel
 *  clock quietly tightens every time the world grows. */
export const PICKUP_RADIUS = 1.5
export const PICKUP_GRAB = 1.9
export const ENERGY_MAX = 100
export const ENERGY_WARN = 30
export const ENERGY_CRITICAL = 20

export const PLAYER_SPEED = 31
export const PLAYER_FOCUS_SPEED = 14
export const PLAYER_START_LIVES = 3
export const PRACTICE_LIVES = 5
export const PLAYER_INVULN_ON_SPAWN = 2.0
export const PLAYER_RESPAWN_DELAY = 1.1

/** Hitbox is far smaller than the sprite - that is what makes it fair. */
export const PLAYER_HIT_RADIUS = 0.33
export const MAX_COMBO = 8
export const MAX_BOMBS = 3
export const BOMB_DAMAGE = 400
export const BOMB_RADIUS = 20

export const NO_DAMAGE_BONUS = 5000
export const ENERGY_BONUS_PER_PCT = 50
export const TIME_BONUS_PER_S = 10
