import { useCallback, useEffect, useMemo, useRef } from 'react'
import { LEVEL_COUNT } from '@/data/levels'
import { MusicDirector } from '@/game/audio/MusicDirector'
import { SfxEngine } from '@/game/audio/SfxEngine'
import { Engine } from '@/game/Engine'
import { metaStore, useMeta } from '@/store/meta'
import { actOf } from '@/theme/palette'
import {
  CreditsScreen,
  GameOverScreen,
  LevelSelect,
  OptionsScreen,
  RankingScreen,
  ResultScreen,
  TitleScreen,
} from '@/ui/screens'

/** Screen router. The game itself never lives above this component. */
export default function App(): React.ReactElement {
  const screen = useMeta((s) => s.screen)
  const settings = useMeta((s) => s.settings)
  const unlocked = useMeta((s) => s.unlocked)
  const currentLevel = useMeta((s) => s.currentLevel)
  const runScore = useMeta((s) => s.runScore)
  const runWeapons = useMeta((s) => s.runWeapons)
  const lastResult = useMeta((s) => s.lastResult)
  const ranking = useMeta((s) => s.ranking)
  const reducedMotion = useMeta((s) => s.reducedMotion)

  const sfx = useMemo(() => new SfxEngine(), [])
  const music = useMemo(() => new MusicDirector(), [])
  const unlocked0 = useRef(false)

  // Audio must wait for a real gesture, so it is armed on the title screen.
  const unlockAudio = useCallback(() => {
    sfx.unlock()
    sfx.setVolume(settings.sfxVolume)
    // Retried on every gesture: the first one can still be refused, and
    // MusicDirector.start() is a no-op once the transport is actually running.
    if (!music.running) {
      const boot = unlocked0.current ? Promise.resolve() : music.loadManifest()
      unlocked0.current = true
      // Hand the music the SFX graph's context and master bus so one limiter
      // sees the whole mix.
      const ctx = sfx.rawContext
      const dest = sfx.musicInput
      const shared = ctx && dest ? { context: ctx, destination: dest } : undefined
      void boot.then(() => music.start(shared))
    }
    music.setVolume(settings.musicVolume)
  }, [sfx, music, settings.sfxVolume, settings.musicVolume])

  useEffect(() => {
    const go = (): void => {
      unlockAudio()
      metaStore.getState().setScreen('title')
    }
    if (screen === 'boot') {
      window.addEventListener('pointerdown', go, { once: true })
      window.addEventListener('keydown', go, { once: true })
      return () => {
        window.removeEventListener('pointerdown', go)
        window.removeEventListener('keydown', go)
      }
    }
    return undefined
  }, [screen, unlockAudio])

  useEffect(() => {
    sfx.setVolume(settings.sfxVolume)
    music.setVolume(settings.musicVolume)
  }, [sfx, music, settings.sfxVolume, settings.musicVolume])

  useEffect(() => {
    music.setAct(actOf(currentLevel))
  }, [music, currentLevel])

  // Esc always gets you out of a run.
  useEffect(() => {
    if (screen !== 'game') return undefined
    const onKey = (e: KeyboardEvent): void => {
      if (e.code === 'Escape') metaStore.getState().setScreen('title')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screen])

  const meta = metaStore.getState()

  if (screen === 'boot') {
    return (
      <main className="screen boot">
        <h1 className="logo display">SPACEROCKER</h1>
        <p className="lead">Tap or press any key.</p>
      </main>
    )
  }

  if (screen === 'game') {
    return (
      <Engine
        key={currentLevel}
        level={currentLevel}
        practice={settings.practice}
        reducedMotion={reducedMotion}
        scanlines={settings.scanlines}
        colorblind={settings.colorblind}
        screenShake={settings.screenShake}
        bindings={settings.bindings}
        carriedScore={runScore}
        carriedWeapons={runWeapons}
        sfx={sfx}
        music={music}
        onLevelComplete={(r, w) => meta.completeLevel(r, w)}
        onGameOver={() => meta.endRun()}
        onExit={() => meta.setScreen('title')}
      />
    )
  }

  if (screen === 'result' && lastResult) {
    return (
      <main>
        <ResultScreen
          result={lastResult}
          isLast={lastResult.level >= LEVEL_COUNT}
          onNext={() => {
            if (lastResult.level >= LEVEL_COUNT) meta.setScreen('credits')
            // advanceLevel, not startRun: startRun is a fresh run and
            // would wipe the score and armament you just earned
            else meta.advanceLevel(lastResult.level + 1)
          }}
        />
      </main>
    )
  }

  if (screen === 'gameOver') {
    return (
      <main>
        <GameOverScreen
          level={currentLevel}
          score={runScore}
          onRetry={() => meta.startRun(currentLevel)}
          onTitle={() => meta.setScreen('title')}
          onSubmit={(ini) => meta.submitScore(ini)}
        />
      </main>
    )
  }

  if (screen === 'options') {
    return (
      <main>
        <OptionsScreen
          settings={settings}
          reducedMotion={reducedMotion}
          onChange={(p) => meta.setSettings(p)}
          onBind={(a, codes) => meta.setBinding(a, codes)}
          onBack={() => meta.setScreen('title')}
        />
      </main>
    )
  }

  if (screen === 'ranking') {
    return (
      <main>
        <RankingScreen ranking={ranking} onBack={() => meta.setScreen('title')} />
      </main>
    )
  }

  if (screen === 'levelSelect') {
    return (
      <main>
        <LevelSelect
          unlocked={unlocked}
          onPick={(l) => meta.startRun(l)}
          onBack={() => meta.setScreen('title')}
        />
      </main>
    )
  }

  if (screen === 'credits') {
    return (
      <main>
        <CreditsScreen onBack={() => meta.setScreen('title')} />
      </main>
    )
  }

  return (
    <main>
      <TitleScreen
        hasProgress={unlocked > 1}
        onPick={(key) => {
          unlockAudio()
          if (key === 'new') meta.startRun(1)
          else if (key === 'continue') meta.setScreen('levelSelect')
          else if (key === 'options') meta.setScreen('options')
          else if (key === 'ranking') meta.setScreen('ranking')
        }}
      />
    </main>
  )
}
