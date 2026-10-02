import { forwardRef, useImperativeHandle, useRef } from 'react'
import { ENERGY_CRITICAL, ENERGY_WARN, MAX_BOMBS } from '@/game/core/constants'
import type { Simulation } from '@/game/Simulation'

export interface HudHandle {
  update(sim: Simulation): void
}

/**
 * The HUD renders once and is then written imperatively, every frame, straight
 * to the DOM nodes. React does not re-render during gameplay (spec 4, 15) -
 * this component has no state at all.
 *
 * It lives entirely on the edges of the screen; the centre stays free.
 */
export const Hud = forwardRef<HudHandle, { practice: boolean }>(function Hud({ practice }, ref) {
  const score = useRef<HTMLSpanElement>(null)
  const combo = useRef<HTMLSpanElement>(null)
  const level = useRef<HTMLSpanElement>(null)
  const lives = useRef<HTMLDivElement>(null)
  const bombs = useRef<HTMLDivElement>(null)
  const energyFill = useRef<HTMLDivElement>(null)
  const energyBar = useRef<HTMLDivElement>(null)
  const bossWrap = useRef<HTMLDivElement>(null)
  const bossName = useRef<HTMLSpanElement>(null)
  const bossFill = useRef<HTMLDivElement>(null)
  const bossSegs = useRef<HTMLDivElement>(null)
  const weapons = useRef<HTMLDivElement>(null)

  // last written values, so we only touch the DOM on real change
  const prev = useRef({
    score: -1,
    combo: -1,
    lives: -1,
    bombs: -1,
    energy: -1,
    level: -1,
    bossHp: -1,
    bossShown: false,
    bossPhases: -1,
    weapons: '',
  })

  useImperativeHandle(ref, () => ({
    update(sim: Simulation) {
      const p = prev.current

      if (sim.score !== p.score) {
        p.score = sim.score
        if (score.current) score.current.textContent = sim.score.toLocaleString('en-US')
      }

      if (sim.combo !== p.combo) {
        p.combo = sim.combo
        if (combo.current) {
          combo.current.textContent = sim.combo > 1 ? `${sim.combo}x` : ''
          combo.current.style.opacity = sim.combo > 1 ? '1' : '0'
        }
      }

      if (sim.level.id !== p.level) {
        p.level = sim.level.id
        if (level.current) level.current.textContent = String(sim.level.id).padStart(2, '0')
      }

      if (sim.player.lives !== p.lives) {
        p.lives = sim.player.lives
        if (lives.current) {
          lives.current.replaceChildren()
          for (let i = 0; i < Math.max(0, sim.player.lives); i++) {
            const s = document.createElement('i')
            s.className = 'life'
            lives.current.appendChild(s)
          }
        }
      }

      if (sim.player.weapons.bombs !== p.bombs) {
        p.bombs = sim.player.weapons.bombs
        if (bombs.current) {
          bombs.current.replaceChildren()
          for (let i = 0; i < MAX_BOMBS; i++) {
            const s = document.createElement('i')
            s.className = i < sim.player.weapons.bombs ? 'pip on' : 'pip'
            bombs.current.appendChild(s)
          }
        }
      }

      const e = Math.round(sim.player.energy)
      if (e !== p.energy) {
        p.energy = e
        if (energyFill.current) energyFill.current.style.width = `${Math.max(0, e)}%`
        if (energyBar.current) {
          // cyan -> magenta below 30%, pulsing below 20%
          energyBar.current.dataset.level =
            e <= ENERGY_CRITICAL ? 'critical' : e <= ENERGY_WARN ? 'warn' : 'ok'
        }
      }

      const w = sim.player.weapons
      const tag = [
        w.spread > 0 ? `SPREAD ${w.spread}` : '',
        w.lance > 0 ? `LANCE ${Math.ceil(w.lance)}s` : '',
        w.seeker > 0 ? `SEEKER ${Math.ceil(w.seeker)}s` : '',
        w.shield > 0 ? `AEGIS ${w.shield}` : '',
        w.wingman ? 'WINGMAN' : '',
      ]
        .filter(Boolean)
        .join('  ')
      if (tag !== p.weapons) {
        p.weapons = tag
        if (weapons.current) weapons.current.textContent = tag
      }

      const boss = sim.boss
      const shown = !!boss && boss.state !== 'dead'
      if (shown !== p.bossShown) {
        p.bossShown = shown
        if (bossWrap.current) bossWrap.current.style.display = shown ? 'flex' : 'none'
        if (shown && boss && bossName.current) bossName.current.textContent = boss.name
      }
      if (boss && shown) {
        if (boss.phaseCount !== p.bossPhases) {
          p.bossPhases = boss.phaseCount
          if (bossSegs.current) {
            bossSegs.current.replaceChildren()
            for (let i = 0; i < boss.phaseCount; i++) {
              const s = document.createElement('i')
              bossSegs.current.appendChild(s)
            }
          }
        }
        const hp = Math.round((boss.hp / Math.max(1, boss.maxHp)) * 1000)
        if (hp !== p.bossHp) {
          p.bossHp = hp
          if (bossFill.current) bossFill.current.style.width = `${hp / 10}%`
        }
      }
    },
  }))

  return (
    <div className="hud" aria-hidden="true">
      <div className="hud-tl">
        <span className="hud-score" ref={score}>
          0
        </span>
        <span className="hud-combo" ref={combo} />
      </div>

      <div className="hud-tr">
        <span className="hud-label">level</span>
        <span className="hud-level display" ref={level}>
          01
        </span>
      </div>

      <div className="hud-boss" ref={bossWrap} style={{ display: 'none' }}>
        <span className="hud-boss-name display" ref={bossName} />
        <div className="hud-boss-bar">
          <div className="hud-boss-fill" ref={bossFill} />
          <div className="hud-boss-segs" ref={bossSegs} />
        </div>
      </div>

      <div className="hud-bl">
        <div className="hud-lives" ref={lives} />
        <div className="hud-bombs" ref={bombs} />
        {practice && <span className="hud-practice">practice mode</span>}
      </div>

      <div className="hud-weapons" ref={weapons} />

      <div className="hud-energy" ref={energyBar} data-level="ok">
        <div className="hud-energy-fill" ref={energyFill} />
      </div>
    </div>
  )
})
