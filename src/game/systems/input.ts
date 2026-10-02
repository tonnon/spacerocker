import { PLAY_HALF_W, PLAYER_Z_MAX, PLAYER_Z_MIN } from '../core/constants'
import type { InputState } from '../Simulation'

export type Action = 'up' | 'down' | 'left' | 'right' | 'fire' | 'focus' | 'bomb'

export type Bindings = Record<Action, string[]>

export const DEFAULT_BINDINGS: Bindings = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  fire: ['Space', 'KeyJ'],
  focus: ['ShiftLeft', 'ShiftRight'],
  bomb: ['KeyX', 'KeyK'],
}

const GAMEPAD_DEADZONE = 0.15

/**
 * Collects keyboard, mouse and gamepad into one snapshot per frame.
 *
 * The simulation never touches the DOM; it only reads the snapshot, which is
 * also what makes replays from a seed plus inputs possible.
 */
export class InputManager {
  readonly state: InputState = {
    moveX: 0,
    moveZ: 0,
    fire: false,
    focus: false,
    bomb: false,
    pointer: false,
    pointerX: 0,
    pointerZ: 0,
  }

  /**
   * Raw pointer position in normalised device coords (-1..1, y down).
   * The renderer turns this into a world position, because only it knows
   * the camera. Mapping it linearly to the playfield instead leaves the
   * ship short of the cursor by however much wider the view is than the
   * lane.
   */
  readonly ndc = { x: 0, y: 0 }

  bindings: Bindings = { ...DEFAULT_BINDINGS }
  private readonly down = new Set<string>()
  private mouseActive = false
  private mouseNx = 0
  private mouseNy = 0
  private mouseDown = false
  private bombEdge = false
  private target: HTMLElement | null = null

  attach(target: HTMLElement): void {
    this.target = target
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    target.addEventListener('pointermove', this.onPointerMove)
    target.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointerup', this.onPointerUp)
    target.addEventListener('contextmenu', this.onContextMenu)
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    this.target?.removeEventListener('pointermove', this.onPointerMove)
    this.target?.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('pointerup', this.onPointerUp)
    this.target?.removeEventListener('contextmenu', this.onContextMenu)
    this.target = null
  }

  private onContextMenu = (e: Event): void => e.preventDefault()

  private onKeyDown = (e: KeyboardEvent): void => {
    // never swallow keys the menus need for accessibility
    if (e.code === 'Tab' || e.code === 'Escape') return
    this.down.add(e.code)
    if (
      this.isBound('fire', e.code) ||
      this.isBound('up', e.code) ||
      this.isBound('down', e.code)
    ) {
      e.preventDefault()
    }
    this.mouseActive = false
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code)
  }

  private onBlur = (): void => {
    this.down.clear()
    this.mouseDown = false
  }

  private onPointerMove = (e: PointerEvent): void => {
    const el = this.target
    if (!el) return
    const r = el.getBoundingClientRect()
    this.mouseNx = ((e.clientX - r.left) / r.width) * 2 - 1
    this.mouseNy = ((e.clientY - r.top) / r.height) * 2 - 1
    this.ndc.x = this.mouseNx
    this.ndc.y = this.mouseNy
    this.mouseActive = true
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button === 0) this.mouseDown = true
  }

  private onPointerUp = (): void => {
    this.mouseDown = false
  }

  private isBound(action: Action, code: string): boolean {
    return this.bindings[action].includes(code)
  }

  private held(action: Action): boolean {
    for (const code of this.bindings[action]) if (this.down.has(code)) return true
    return false
  }

  /** Refresh the snapshot. Call once per rendered frame. */
  poll(): InputState {
    const s = this.state
    let mx = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0)
    let mz = (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0)
    let fire = this.held('fire')
    let focus = this.held('focus')
    let bomb = this.held('bomb')

    const pads = navigator.getGamepads?.() ?? []
    for (const pad of pads) {
      if (!pad) continue
      const ax = pad.axes[0] ?? 0
      const ay = pad.axes[1] ?? 0
      if (Math.abs(ax) > GAMEPAD_DEADZONE) mx = ax
      if (Math.abs(ay) > GAMEPAD_DEADZONE) mz = ay
      if (pad.buttons[0]?.pressed) fire = true
      if (pad.buttons[1]?.pressed) bomb = true
      if ((pad.buttons[7]?.value ?? 0) > 0.4) focus = true
      if (pad.buttons[12]?.pressed) mz = -1
      if (pad.buttons[13]?.pressed) mz = 1
      if (pad.buttons[14]?.pressed) mx = -1
      if (pad.buttons[15]?.pressed) mx = 1
    }

    const len = Math.hypot(mx, mz)
    if (len > 1) {
      mx /= len
      mz /= len
    }

    s.moveX = mx
    s.moveZ = mz
    s.focus = focus
    // edge-triggered so holding X does not burn every bomb
    s.bomb = bomb && !this.bombEdge
    this.bombEdge = bomb

    if (this.mouseActive) {
      s.pointer = true
      // A rough fallback only; the Engine overwrites these by projecting
      // `ndc` through the real camera before the simulation reads them.
      s.pointerX = this.mouseNx * PLAY_HALF_W
      s.pointerZ = PLAYER_Z_MIN + ((this.mouseNy + 1) / 2) * (PLAYER_Z_MAX - PLAYER_Z_MIN)
      fire = fire || this.mouseDown
    } else {
      s.pointer = false
    }
    s.fire = fire

    return s
  }
}
