/**
 * Headless balance harness: plays every level with a bot and reports.
 *
 * This is the "test by playing" pass. It runs the real Simulation with no
 * renderer, so a full 15-level run takes seconds. The bot is deliberately
 * only competent, not perfect: it dodges the nearest threats, keeps off the
 * walls, collects what is close and holds the trigger. If a level is
 * unsurvivable or uncompletable for it, a human is going to struggle too.
 *
 *   npx tsx --tsconfig tsconfig.app.json scripts/playtest.ts [level]
 */
import { LEVELS } from '@/data/levels'
import { initialWeapons, type WeaponState } from '@/data/weapons'
import {
  ENGAGE_Z_MAX,
  FIXED_DT,
  PLAY_HALF_W,
  PLAYER_HIT_RADIUS,
  PLAYER_Z_MAX,
  PLAYER_Z_MIN,
} from '@/game/core/constants'
import type { InputState } from '@/game/Simulation'
import { Simulation } from '@/game/Simulation'
import { loadBossAtlasesFromDisk } from './atlas-stub'

const LOOKAHEAD = 0.55
const CANDIDATES = 21

/** Score a candidate position: lower is safer. */
function danger(sim: Simulation, x: number, z: number): number {
  let d = 0

  // incoming enemy fire, projected forward a little
  for (let i = 0; i < sim.bullets.count; i++) {
    if (sim.bullets.team[i] !== 1) continue
    const bx = sim.bullets.x[i] + sim.bullets.vx[i] * LOOKAHEAD
    const bz = sim.bullets.z[i] + sim.bullets.vz[i] * LOOKAHEAD
    const dist = Math.hypot(bx - x, bz - z)
    if (dist < 5) d += (5 - dist) ** 2
  }

  // enemy bodies
  for (const e of sim.qAi.entities) {
    if (e.dead || e.dying) continue
    const dist = Math.hypot(e.transform.x - x, e.transform.z - z)
    if (dist < 4) d += (4 - dist) ** 2 * 1.5
  }

  // boss slabs hurt on contact
  for (const e of sim.qBossParts.entities) {
    if (e.dead || e.bossPart?.destroyed) continue
    const dist = Math.hypot(e.transform.x - x, e.transform.z - z)
    if (dist < 5) d += (5 - dist) ** 2 * 1.2
  }

  // the canyon wall kills outright, so weight it hard
  const s = sim.scroll - z
  const c = sim.canyon.centerX(s)
  const hw = sim.canyon.halfWidth(s)
  const margin = hw - Math.abs(x - c) - PLAYER_HIT_RADIUS
  if (margin < 2.5) d += (2.5 - margin) ** 2 * 14
  if (margin < 0) d += 4000

  // drift towards anything worth picking up
  for (const e of sim.qPickups.entities) {
    if (e.dead) continue
    const dist = Math.hypot(e.transform.x - x, e.transform.z - z)
    d -= Math.max(0, 9 - dist) * (e.pickup?.kind === 'energy' ? 2.2 : 1.4)
  }

  // Reward lining up with something shootable. Without this the bot only ever
  // runs away, never kills the thing chasing it, and every boss reads as
  // unkillable when the real problem is that nobody was aiming.
  let aim = Infinity
  for (const e of sim.qAi.entities) {
    if (e.dead || e.dying) continue
    aim = Math.min(aim, Math.abs(e.transform.x - x))
  }
  for (const e of sim.qBossParts.entities) {
    if (e.dead || !e.health || e.bossPart?.destroyed || e.bossPart?.invulnerable) continue
    aim = Math.min(aim, Math.abs(e.transform.x - x))
  }
  if (aim < Infinity) d -= Math.max(0, 6 - aim) * 3.5

  return d
}

function botInput(sim: Simulation, out: InputState): InputState {
  const p = sim.player
  let bestX = p.x
  let bestZ = p.z
  let best = Number.POSITIVE_INFINITY

  for (let i = 0; i < CANDIDATES; i++) {
    const x = -PLAY_HALF_W + (i / (CANDIDATES - 1)) * PLAY_HALF_W * 2
    for (const z of [p.z - 2.5, p.z, p.z + 2.5]) {
      // read the real bounds: hardcoding these left the bot flying in the
      // pre-rescale lane and never using the depth it actually has
      const cz = Math.max(PLAYER_Z_MIN, Math.min(PLAYER_Z_MAX, z))
      const score = danger(sim, x, cz) + Math.abs(x - p.x) * 0.35
      if (score < best) {
        best = score
        bestX = x
        bestZ = cz
      }
    }
  }

  out.moveX = Math.max(-1, Math.min(1, (bestX - p.x) * 0.7))
  out.moveZ = Math.max(-1, Math.min(1, (bestZ - p.z) * 0.7))
  out.fire = true
  // focus when threading something tight
  out.focus = best > 60 && best < 900
  // bomb only when genuinely swamped
  out.bomb = best > 2200 && p.weapons.bombs > 0
  return out
}

interface Report {
  weapons: WeaponState
  level: number
  name: string
  seconds: number
  deaths: number
  wallDeaths: number
  fuelDeaths: number
  cleared: boolean
  score: number
  minEnergy: number
  peakEnemies: number
  peakBullets: number
  bossSeconds: number
}

function play(
  level: number,
  seed: number,
  budget = 420,
  carried: WeaponState = initialWeapons(),
): Report {
  const sim = new Simulation({ seed, startLevel: level })
  sim.setAtlases(loadBossAtlasesFromDisk())
  sim.startLevel(level)
  // the run's armament follows the player, as it does in game
  Object.assign(sim.player.weapons, carried)

  const input: InputState = {
    moveX: 0,
    moveZ: 0,
    fire: true,
    focus: false,
    bomb: false,
    pointer: false,
    pointerX: 0,
    pointerZ: 0,
  }

  let deaths = 0
  let wallDeaths = 0
  let fuelDeaths = 0
  let minEnergy = 100
  let peakEnemies = 0
  let peakBullets = 0
  let bossStart = -1
  let bossEnd = -1
  let wasAlive = true

  const steps = Math.round(budget / FIXED_DT)
  for (let i = 0; i < steps; i++) {
    // Top lives up BEFORE the step. Reacting after a death is too late: the
    // sim has already latched 'dying' and stops advancing the clock, which is
    // what made the first run of this harness report half the levels as
    // uncompletable.
    sim.player.lives = 3
    const nearWall = (() => {
      const s0 = sim.scroll - sim.player.z
      return (
        sim.canyon.halfWidth(s0) - Math.abs(sim.player.x - sim.canyon.centerX(s0)) < 0.9
      )
    })()
    const lowFuel = sim.player.energy < 1

    sim.input = botInput(sim, input)
    sim.step()

    if (wasAlive && !sim.player.alive) {
      deaths++
      if (lowFuel) fuelDeaths++
      else if (nearWall) wallDeaths++
    }
    wasAlive = sim.player.alive
    if (sim.player.alive) minEnergy = Math.min(minEnergy, sim.player.energy)
    peakEnemies = Math.max(peakEnemies, sim.qAi.entities.length)
    peakBullets = Math.max(peakBullets, sim.bullets.count)
    if (sim.boss && bossStart < 0) bossStart = sim.time
    if (sim.boss?.state === 'dead' && bossEnd < 0) bossEnd = sim.time
    if (sim.state === 'cleared') break
  }

  return {
    weapons: { ...sim.player.weapons },
    level,
    name: sim.level.name,
    seconds: sim.time,
    deaths,
    wallDeaths,
    fuelDeaths,
    cleared: sim.state === 'cleared',
    score: sim.score,
    minEnergy,
    peakEnemies,
    peakBullets,
    bossSeconds: bossStart >= 0 ? (bossEnd < 0 ? -1 : bossEnd - bossStart) : 0,
  }
}

const arg = process.argv[2]
const campaign = arg === '--run'
const only = arg && !campaign ? Number(arg) : null
const levels = only ? [only] : LEVELS.map((l) => l.id)
// In campaign mode the armament carries forward, which is what the late
// bosses' HP is balanced around.
let carried: WeaponState = initialWeapons()

console.log(
  'lvl  name                    time  cleared  deaths  wall  fuel  minNRG  peakE  peakB   boss  armas',
)
console.log('-'.repeat(96))
let failures = 0
for (const id of levels) {
  const r = play(id, 0x51e1 + id * 131, campaign ? 700 : 420, carried)
  if (campaign) carried = r.weapons
  if (!r.cleared) failures++
  console.log(
    `${String(r.level).padStart(3)}  ${r.name.padEnd(22).slice(0, 22)}` +
      `${r.seconds.toFixed(0).padStart(5)}s` +
      `${(r.cleared ? 'yes' : 'NO').padStart(9)}` +
      `${String(r.deaths).padStart(8)}` +
      `${String(r.wallDeaths).padStart(6)}` +
      `${String(r.fuelDeaths).padStart(6)}` +
      `${r.minEnergy.toFixed(0).padStart(8)}` +
      `${String(r.peakEnemies).padStart(7)}` +
      `${String(r.peakBullets).padStart(7)}` +
      `${(r.bossSeconds > 0 ? `${r.bossSeconds.toFixed(0)}s` : r.bossSeconds < 0 ? 'ALIVE' : '-').padStart(7)}` +
      `${`sp${r.weapons.spread}`.padStart(6)}`,
  )
}
console.log('-'.repeat(96))
console.log(failures === 0 ? 'all levels cleared' : `${failures} level(s) not cleared`)
// ENGAGE_Z_MAX is imported so the harness fails to compile if the band is renamed
void ENGAGE_Z_MAX
