import { FIXED_DT, MAX_CATCHUP_STEPS } from './constants'

/**
 * Accumulator loop (spec §4): simulate in whole 1/60s ticks, then hand the
 * renderer an alpha so it can interpolate between the last two states.
 */
export class FixedStepClock {
  private acc = 0
  alpha = 0

  /** Calls `step` zero or more times; returns how many ticks ran. */
  advance(frameDt: number, step: () => void): number {
    this.acc += Math.min(frameDt, 0.25)
    let n = 0
    while (this.acc >= FIXED_DT && n < MAX_CATCHUP_STEPS) {
      step()
      this.acc -= FIXED_DT
      n++
    }
    if (n === MAX_CATCHUP_STEPS) this.acc = 0
    this.alpha = this.acc / FIXED_DT
    return n
  }

  reset(): void {
    this.acc = 0
    this.alpha = 0
  }
}
