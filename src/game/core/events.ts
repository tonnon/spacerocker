/** Tiny typed event bus. Handlers are called synchronously inside the step. */

export interface GameEvents {
  enemyKilled: { x: number; z: number; kind: string; score: number; big: boolean }
  playerHit: { x: number; z: number }
  playerDied: { lives: number }
  pickupTaken: { kind: string; x: number; z: number }
  bombUsed: { x: number; z: number }
  bossPartDestroyed: { part: string; x: number; z: number }
  bossPhaseShift: { phase: number }
  bossDefeated: { id: string }
  levelCleared: { level: number }
  shieldBroke: Record<string, never>
  energyLow: Record<string, never>
  shot: { team: 'player' | 'enemy'; x: number; z: number }
  explosion: { x: number; z: number; size: 'small' | 'medium' | 'huge' }
}

type Handler<K extends keyof GameEvents> = (payload: GameEvents[K]) => void

export class EventBus {
  private readonly map = new Map<string, Array<(p: unknown) => void>>()

  on<K extends keyof GameEvents>(key: K, fn: Handler<K>): () => void {
    const list = this.map.get(key) ?? []
    list.push(fn as (p: unknown) => void)
    this.map.set(key, list)
    return () => {
      const l = this.map.get(key)
      if (!l) return
      const i = l.indexOf(fn as (p: unknown) => void)
      if (i >= 0) l.splice(i, 1)
    }
  }

  emit<K extends keyof GameEvents>(key: K, payload: GameEvents[K]): void {
    const list = this.map.get(key)
    if (!list) return
    for (let i = 0; i < list.length; i++) list[i](payload)
  }

  clear(): void {
    this.map.clear()
  }
}
