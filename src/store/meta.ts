import { useSyncExternalStore } from 'react'
import { createStore } from 'zustand/vanilla'
import { initialWeapons, type WeaponState } from '@/data/weapons'
import { type Bindings, DEFAULT_BINDINGS } from '@/game/systems/input'

/**
 * Meta state only: menus, options, progress, ranking.
 *
 * Note what is NOT here: nothing from a live run. The simulation owns that,
 * and localStorage is never the source of truth for game state (spec 1).
 */

export type Screen =
  | 'boot'
  | 'title'
  | 'levelSelect'
  | 'options'
  | 'ranking'
  | 'game'
  | 'result'
  | 'gameOver'
  | 'credits'

export interface Settings {
  musicVolume: number
  sfxVolume: number
  scanlines: boolean
  screenShake: boolean
  colorblind: boolean
  practice: boolean
  bindings: Bindings
}

export interface ScoreEntry {
  initials: string
  score: number
  level: number
  at: number
}

export interface RunSummary {
  level: number
  score: number
  energyBonus: number
  timeBonus: number
  noDamageBonus: number
  total: number
}

export interface MetaState {
  screen: Screen
  settings: Settings
  /** Highest level reached, 1..15. */
  unlocked: number
  /** Score carried between levels in the current run. */
  runScore: number
  /**
   * Armament carried between levels of a run.
   *
   * Without this every level restarts on the peashooter, which makes the
   * late bosses a war of attrition - their HP is balanced around a player
   * who arrived with SPREAD.
   */
  runWeapons: WeaponState
  currentLevel: number
  lastResult: RunSummary | null
  ranking: ScoreEntry[]
  reducedMotion: boolean

  setScreen(s: Screen): void
  setSettings(patch: Partial<Settings>): void
  setBinding(action: keyof Bindings, codes: string[]): void
  /** Fresh run: score and armament reset. */
  startRun(level: number): void
  /** Next level of the SAME run: score and armament carry over. */
  advanceLevel(level: number): void
  completeLevel(r: RunSummary, weapons: WeaponState): void
  endRun(): void
  submitScore(initials: string): void
  resetProgress(): void
}

const SETTINGS_KEY = 'spacerocker.settings.v1'
const PROGRESS_KEY = 'spacerocker.progress.v1'
const RANKING_KEY = 'spacerocker.ranking.v1'

const DEFAULT_SETTINGS: Settings = {
  musicVolume: 0.6,
  sfxVolume: 0.7,
  scanlines: true,
  screenShake: true,
  colorblind: false,
  practice: false,
  bindings: DEFAULT_BINDINGS,
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return { ...fallback, ...(JSON.parse(raw) as T) }
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // private mode: settings simply do not persist, the game still runs
  }
}

const prefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export const metaStore = createStore<MetaState>((set, get) => ({
  screen: 'boot',
  settings: read(SETTINGS_KEY, DEFAULT_SETTINGS),
  unlocked: read(PROGRESS_KEY, { unlocked: 1 }).unlocked,
  runScore: 0,
  runWeapons: initialWeapons(),
  currentLevel: 1,
  lastResult: null,
  ranking: read(RANKING_KEY, { list: [] as ScoreEntry[] }).list,
  reducedMotion: prefersReducedMotion(),

  setScreen: (screen) => set({ screen }),

  setSettings: (patch) => {
    const settings = { ...get().settings, ...patch }
    write(SETTINGS_KEY, settings)
    set({ settings })
  },

  setBinding: (action, codes) => {
    const bindings = { ...get().settings.bindings, [action]: codes }
    const settings = { ...get().settings, bindings }
    write(SETTINGS_KEY, settings)
    set({ settings })
  },

  startRun: (level) =>
    set({
      currentLevel: level,
      runScore: 0,
      runWeapons: initialWeapons(),
      screen: 'game',
      lastResult: null,
    }),

  advanceLevel: (level) => set({ currentLevel: level, screen: 'game', lastResult: null }),

  completeLevel: (r, weapons) => {
    const unlocked = Math.max(get().unlocked, Math.min(15, r.level + 1))
    write(PROGRESS_KEY, { unlocked })
    set({ lastResult: r, runScore: r.total, runWeapons: weapons, unlocked, screen: 'result' })
  },

  endRun: () => set({ screen: 'gameOver' }),

  submitScore: (initials) => {
    const entry: ScoreEntry = {
      initials: initials.slice(0, 3).toUpperCase() || 'AAA',
      score: get().runScore,
      level: get().currentLevel,
      at: Date.now(),
    }
    const list = [...get().ranking, entry].sort((a, b) => b.score - a.score).slice(0, 10)
    write(RANKING_KEY, { list })
    set({ ranking: list, screen: 'ranking' })
  },

  resetProgress: () => {
    write(PROGRESS_KEY, { unlocked: 1 })
    set({ unlocked: 1 })
  },
}))

/**
 * Selector hook. Selectors must return primitives or stable references -
 * returning a fresh object every call would loop.
 */
export const useMeta = <T>(selector: (s: MetaState) => T): T =>
  useSyncExternalStore(
    metaStore.subscribe,
    () => selector(metaStore.getState()),
    () => selector(metaStore.getState()),
  )
