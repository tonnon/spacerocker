import { useEffect, useRef, useState } from 'react'
import { LEVELS } from '@/data/levels'
import type { Action } from '@/game/systems/input'
import { type RunSummary, type ScoreEntry, type Settings, useMeta } from '@/store/meta'
import { ACTS, actOf } from '@/theme/palette'

/** Vertical list menu, fully keyboard navigable (spec 12). */
function Menu({
  items,
  onPick,
}: {
  items: { key: string; label: string; disabled?: boolean }[]
  onPick(key: string): void
}): React.ReactElement {
  const [index, setIndex] = useState(0)
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    refs.current[index]?.focus()
  }, [index])

  const move = (d: number): void => {
    let i = index
    for (let n = 0; n < items.length; n++) {
      i = (i + d + items.length) % items.length
      if (!items[i].disabled) break
    }
    setIndex(i)
  }

  return (
    <ul
      className="menu"
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          move(1)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          move(-1)
        }
      }}
    >
      {items.map((it, i) => (
        <li key={it.key}>
          <button
            type="button"
            ref={(el) => {
              refs.current[i] = el
            }}
            disabled={it.disabled}
            onFocus={() => setIndex(i)}
            onClick={() => onPick(it.key)}
          >
            {it.label}
          </button>
        </li>
      ))}
    </ul>
  )
}

export function TitleScreen({
  onPick,
  hasProgress,
}: {
  onPick(key: string): void
  hasProgress: boolean
}): React.ReactElement {
  return (
    <div className="screen title-screen">
      <div className="title-stage">
        <h1 className="logo display">SPACEROCKER</h1>
        <p className="tagline">One canyon. Fifteen levels. No continues.</p>
      </div>
      <Menu
        items={[
          { key: 'continue', label: 'Continue', disabled: !hasProgress },
          { key: 'new', label: 'New game' },
          { key: 'options', label: 'Options' },
          { key: 'ranking', label: 'High scores' },
        ]}
        onPick={onPick}
      />
      <p className="hint">Arrows to navigate · Enter to select</p>
    </div>
  )
}

export function LevelSelect({
  unlocked,
  onPick,
  onBack,
}: {
  unlocked: number
  onPick(level: number): void
  onBack(): void
}): React.ReactElement {
  return (
    <div className="screen">
      <h2 className="display heading">Select level</h2>
      <div className="level-grid">
        {LEVELS.map((l) => {
          const locked = l.id > unlocked
          const act = ACTS[actOf(l.id)]
          return (
            <button
              type="button"
              key={l.id}
              className="level-card"
              disabled={locked}
              onClick={() => onPick(l.id)}
              style={{ borderColor: locked ? undefined : `${act.wallEdge.toString(16)}` }}
            >
              <span className="level-num display">{String(l.id).padStart(2, '0')}</span>
              <span className="level-name">{locked ? 'Locked' : l.name}</span>
              <span className="level-act">{locked ? '' : act.name}</span>
              {l.boss && !locked && <span className="level-boss">boss</span>}
            </button>
          )
        })}
      </div>
      <button type="button" className="link" onClick={onBack}>
        Back
      </button>
    </div>
  )
}

const ACTION_LABELS: Record<Action, string> = {
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  fire: 'Fire',
  focus: 'Focus mode',
  bomb: 'Bomb',
}

export function OptionsScreen({
  settings,
  onChange,
  onBind,
  onBack,
  reducedMotion,
}: {
  settings: Settings
  onChange(p: Partial<Settings>): void
  onBind(a: Action, codes: string[]): void
  onBack(): void
  reducedMotion: boolean
}): React.ReactElement {
  const [listening, setListening] = useState<Action | null>(null)

  useEffect(() => {
    if (!listening) return
    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault()
      if (e.code !== 'Escape') onBind(listening, [e.code])
      setListening(null)
    }
    window.addEventListener('keydown', onKey, { once: true })
    return () => window.removeEventListener('keydown', onKey)
  }, [listening, onBind])

  return (
    <div className="screen options">
      <h2 className="display heading">Options</h2>

      <section>
        <h3>Audio</h3>
        <label className="row">
          <span>Music</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.musicVolume}
            onChange={(e) => onChange({ musicVolume: Number(e.target.value) })}
          />
          <b>{Math.round(settings.musicVolume * 100)}</b>
        </label>
        <label className="row">
          <span>Effects</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.sfxVolume}
            onChange={(e) => onChange({ sfxVolume: Number(e.target.value) })}
          />
          <b>{Math.round(settings.sfxVolume * 100)}</b>
        </label>
      </section>

      <section>
        <h3>Video</h3>
        <label className="row toggle">
          <input
            type="checkbox"
            checked={settings.scanlines}
            onChange={(e) => onChange({ scanlines: e.target.checked })}
          />
          <span>Scanlines</span>
        </label>
        <label className="row toggle">
          <input
            type="checkbox"
            checked={settings.screenShake}
            onChange={(e) => onChange({ screenShake: e.target.checked })}
          />
          <span>Screen shake</span>
        </label>
        <label className="row toggle">
          <input
            type="checkbox"
            checked={settings.colorblind}
            onChange={(e) => onChange({ colorblind: e.target.checked })}
          />
          <span>Colorblind mode (shape as well as colour)</span>
        </label>
        {reducedMotion && (
          <p className="note">
            The system asks for reduced motion. Shake, aberration and scanlines are off, and
            particles drop by 70%.
          </p>
        )}
      </section>

      <section>
        <h3>Game</h3>
        <label className="row toggle">
          <input
            type="checkbox"
            checked={settings.practice}
            onChange={(e) => onChange({ practice: e.target.checked })}
          />
          <span>Practice mode — energy never drains, 5 lives (no score entry)</span>
        </label>
      </section>

      <section>
        <h3>Controls</h3>
        <div className="binds">
          {(Object.keys(ACTION_LABELS) as Action[]).map((a) => (
            <div className="row" key={a}>
              <span>{ACTION_LABELS[a]}</span>
              <button type="button" onClick={() => setListening(a)}>
                {listening === a ? 'Press a key…' : settings.bindings[a].join(' / ')}
              </button>
            </div>
          ))}
        </div>
        <p className="note">Gamepad: left stick, A fires, RT focuses, B drops a bomb.</p>
      </section>

      <button type="button" className="link" onClick={onBack}>
        Back
      </button>
    </div>
  )
}

export function RankingScreen({
  ranking,
  onBack,
}: {
  ranking: ScoreEntry[]
  onBack(): void
}): React.ReactElement {
  return (
    <div className="screen">
      <h2 className="display heading">High scores</h2>
      {ranking.length === 0 ? (
        <p className="empty">No scores yet. The first one is yours.</p>
      ) : (
        <ol className="ranking">
          {ranking.map((r, i) => (
            <li key={`${r.at}-${r.initials}-${r.score}`}>
              <span className="rk-pos">{String(i + 1).padStart(2, '0')}</span>
              <span className="rk-ini display">{r.initials}</span>
              <span className="rk-score tabular">{r.score.toLocaleString('en-US')}</span>
              <span className="rk-lvl">level {String(r.level).padStart(2, '0')}</span>
            </li>
          ))}
        </ol>
      )}
      <button type="button" className="link" onClick={onBack}>
        Back
      </button>
    </div>
  )
}

export function ResultScreen({
  result,
  onNext,
  isLast,
}: {
  result: RunSummary
  onNext(): void
  isLast: boolean
}): React.ReactElement {
  return (
    <div className="screen result">
      <h2 className="display heading">Level {String(result.level).padStart(2, '0')} cleared</h2>
      <dl className="tally">
        <div>
          <dt>Score</dt>
          <dd className="tabular">{result.score.toLocaleString('en-US')}</dd>
        </div>
        <div>
          <dt>Energy left</dt>
          <dd className="tabular">{result.energyBonus.toLocaleString('en-US')}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd className="tabular">{result.timeBonus.toLocaleString('en-US')}</dd>
        </div>
        <div>
          <dt>No damage</dt>
          <dd className="tabular">{result.noDamageBonus.toLocaleString('en-US')}</dd>
        </div>
        <div className="total">
          <dt>Total</dt>
          <dd className="tabular">{result.total.toLocaleString('en-US')}</dd>
        </div>
      </dl>
      <button type="button" className="primary" onClick={onNext}>
        {isLast ? 'See credits' : 'Next level'}
      </button>
    </div>
  )
}

export function GameOverScreen({
  level,
  score,
  onRetry,
  onTitle,
  onSubmit,
}: {
  level: number
  score: number
  onRetry(): void
  onTitle(): void
  onSubmit(initials: string): void
}): React.ReactElement {
  const [initials, setInitials] = useState('')
  return (
    <div className="screen gameover">
      <h2 className="display heading">Ship lost</h2>
      <p className="lead">
        Level {String(level).padStart(2, '0')} · {score.toLocaleString('en-US')} points
      </p>
      <form
        className="initials"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(initials)
        }}
      >
        <label htmlFor="ini">Three letters for the scoreboard</label>
        <input
          id="ini"
          maxLength={3}
          value={initials}
          autoComplete="off"
          onChange={(e) => setInitials(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
        />
        <button type="submit" className="primary">
          Save
        </button>
      </form>
      <div className="actions">
        <button type="button" onClick={onRetry}>
          Try again
        </button>
        <button type="button" onClick={onTitle}>
          Back to title
        </button>
      </div>
    </div>
  )
}

export function CreditsScreen({ onBack }: { onBack(): void }): React.ReactElement {
  const total = useMeta((s) => s.runScore)
  return (
    <div className="screen credits">
      <h2 className="display heading">Ouroboros down</h2>
      <p className="lead">{total.toLocaleString('en-US')} points</p>
      <p>
        Everything in this game is generated: the sprites by a deterministic Python pipeline, the
        soundtrack synthesised in real time, the terrain by seeded noise. No external assets.
      </p>
      <button type="button" className="primary" onClick={onBack}>
        Back to title
      </button>
    </div>
  )
}
