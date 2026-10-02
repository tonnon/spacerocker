import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import type { WeaponState } from '@/data/weapons'
import type { RunSummary } from '@/store/meta'
import { actOf } from '@/theme/palette'
import { Hud, type HudHandle } from '@/ui/Hud'
import type { MusicDirector } from './audio/MusicDirector'
import type { SfxEngine } from './audio/SfxEngine'
import { type LoadedAtlas, loadAtlas } from './core/atlas'
import { FixedStepClock } from './core/fixedStep'
import { Renderer } from './render/Renderer'
import { Simulation } from './Simulation'
import type { Bindings } from './systems/input'
import { InputManager } from './systems/input'

export interface EngineProps {
  level: number
  practice: boolean
  reducedMotion: boolean
  scanlines: boolean
  colorblind: boolean
  screenShake: boolean
  bindings: Bindings
  carriedScore: number
  carriedWeapons: WeaponState
  sfx: SfxEngine
  music: MusicDirector
  onLevelComplete(r: RunSummary, weapons: WeaponState): void
  onGameOver(): void
  onExit(): void
}

const SPRITE_BASE = '/sprites'

async function loadAllAtlases(): Promise<LoadedAtlas[]> {
  let names: string[] = ['common', 'act1', 'boss_hexapod']
  try {
    const res = await fetch(`${SPRITE_BASE}/index.json`)
    if (res.ok) {
      const doc = (await res.json()) as { atlases: string[] }
      if (Array.isArray(doc.atlases) && doc.atlases.length) names = doc.atlases
    }
  } catch {
    // fall back to the act I set, which always ships
  }
  const loaded = await Promise.all(names.map((n) => loadAtlas(SPRITE_BASE, n).catch(() => null)))
  return loaded.filter((a): a is LoadedAtlas => a !== null)
}

interface LoopProps extends EngineProps {
  sim: Simulation
  renderer: Renderer
  input: InputManager
  hud: React.RefObject<HudHandle | null>
  debug: React.RefObject<HTMLPreElement | null>
}

function GameLoop(props: LoopProps): null {
  const { sim, renderer, input, hud, debug, sfx, music } = props
  const { gl, size } = useThree()
  const clock = useRef(new FixedStepClock())
  const fps = useRef({ frames: 0, acc: 0, value: 60 })
  const finished = useRef(false)

  useEffect(() => {
    renderer.attach(gl, {
      scanlines: props.scanlines,
      reducedMotion: props.reducedMotion,
    })
    input.attach(gl.domElement)
    // The composer renders several passes per frame; with autoReset on,
    // gl.info would only ever report the last one.
    gl.info.autoReset = false
    if (import.meta.env.DEV) {
      ;(window as unknown as { __sr: unknown }).__sr = { sim, renderer }
    }
    return () => {
      input.detach()
      renderer.dispose()
    }
  }, [gl, renderer, input, sim, props.scanlines, props.reducedMotion])

  useEffect(() => {
    renderer.setSize(size.width, size.height)
  }, [renderer, size])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    gl.info.reset()

    const snapshot = input.poll()
    if (snapshot.pointer) renderer.pointerToWorld(input.ndc.x, input.ndc.y, snapshot)
    sim.input = snapshot

    clock.current.advance(dt, () => sim.step())
    renderer.render(sim, clock.current.alpha, dt)
    hud.current?.update(sim)

    // music follows the state of play, not the menu
    if (sim.boss && sim.boss.state !== 'dead') music.setIntensity('boss')
    else if (sim.qAi.entities.length > 0) music.setIntensity('combat')
    else music.setIntensity('calm')
    music.setComboHeat(sim.combo >= 4)

    // F3 overlay
    const f = fps.current
    f.frames++
    f.acc += dt
    if (f.acc >= 0.5) {
      f.value = f.frames / f.acc
      f.frames = 0
      f.acc = 0
      if (debug.current && debug.current.style.display !== 'none') {
        const info = gl.info
        debug.current.textContent = [
          `fps      ${f.value.toFixed(0)}`,
          `draws    ${info.render.calls}`,
          `tris     ${info.render.triangles}`,
          `entities ${sim.world.entities.length}`,
          `bullets  ${sim.bullets.count}/${sim.bullets.pool.capacity}`,
          `parts    ${sim.particles.count}/${sim.particles.pool.capacity}`,
          `scroll   ${sim.scroll.toFixed(0)}`,
          `state    ${sim.state}`,
        ].join('\n')
      }
    }

    if (finished.current) return
    if (sim.state === 'cleared' && sim.result) {
      finished.current = true
      sfx.play('pickup')
      props.onLevelComplete(sim.result, { ...sim.player.weapons })
    } else if (sim.state === 'gameOver') {
      finished.current = true
      props.onGameOver()
    }
  }, 1)

  return null
}

export function Engine(props: EngineProps): React.ReactElement {
  const [atlases, setAtlases] = useState<LoadedAtlas[] | null>(null)
  const hud = useRef<HudHandle>(null)
  const debug = useRef<HTMLPreElement>(null)
  const state = useRef<{ sim: Simulation; renderer: Renderer; input: InputManager } | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadAllAtlases().then((list) => {
      if (!cancelled) setAtlases(list)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // F3 toggles the debug overlay
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.code !== 'F3') return
      e.preventDefault()
      const el = debug.current
      if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (atlases && !state.current) {
    const sim = new Simulation({
      practice: props.practice,
      reducedMotion: props.reducedMotion || !props.screenShake,
      colorblind: props.colorblind,
      startLevel: props.level,
      seed: 0x5eed,
    })
    sim.setAtlases(atlases)
    sim.setSfxSink(props.sfx.play)
    sim.startLevel(props.level)
    sim.score = props.carriedScore
    // the run's armament follows the player from level to level
    Object.assign(sim.player.weapons, props.carriedWeapons)

    const renderer = new Renderer(atlases, actOf(props.level))
    renderer.setAct(props.level, !!sim.level.dark)

    const input = new InputManager()
    input.bindings = props.bindings

    sim.bus.on('bossPhaseShift', () => props.music.bossSting())
    state.current = { sim, renderer, input }
  }

  const ready = atlases && state.current

  return (
    <div className="game-root">
      {ready ? (
        <Canvas
          dpr={[1, 1.75]}
          gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x05060d, 1)
          }}
        >
          <GameLoop
            {...props}
            sim={state.current!.sim}
            renderer={state.current!.renderer}
            input={state.current!.input}
            hud={hud}
            debug={debug}
          />
        </Canvas>
      ) : (
        <div className="boot-note">Loading atlases…</div>
      )}
      <Hud ref={hud} practice={props.practice} />
      <pre className="debug" ref={debug} style={{ display: 'none' }} />
      <button type="button" className="exit-btn" onClick={props.onExit}>
        Sair (Esc)
      </button>
    </div>
  )
}
