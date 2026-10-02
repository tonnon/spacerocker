/**
 * SFX synthesised with raw Web Audio (spec 10) - no samples, no files.
 *
 * Gain staging, in order, because getting this wrong is what makes a shmup
 * clip the moment three explosions land together:
 *
 *   voice gains -> bus -> compressor -> limiter -> soft clip -> volume -> out
 *
 * The volume control sits AFTER the limiter on purpose. In front of it, a
 * louder setting just drives the limiter harder and changes how the whole mix
 * behaves; behind it, the limiter guarantees a bounded signal and volume only
 * scales it down.
 */

const MAX_VOICES = 20

/**
 * Every per-sound gain below is multiplied by this. The individual numbers are
 * tuned for how a sound reads on its own; this is the one knob for how loud
 * they are when twenty of them pile up.
 */
const VOICE_TRIM = 0.45

interface SfxSpec {
  priority: number
  build(ctx: BaseAudioContext, out: AudioNode, t: number): number
}

const noiseBuffer = (ctx: BaseAudioContext, seconds: number): AudioBuffer => {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let seed = 12345
  for (let i = 0; i < len; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    d[i] = (seed / 0x3fffffff - 1) * (1 - i / len)
  }
  return buf
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>()

function sharedNoise(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseCache.get(ctx)
  if (!b) {
    b = noiseBuffer(ctx, 1.4)
    noiseCache.set(ctx, b)
  }
  return b
}

function tone(
  ctx: BaseAudioContext,
  out: AudioNode,
  t: number,
  type: OscillatorType,
  f0: number,
  f1: number,
  dur: number,
  gain: number,
): void {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain * VOICE_TRIM, t + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + dur + 0.02)
}

function noise(
  ctx: BaseAudioContext,
  out: AudioNode,
  t: number,
  dur: number,
  gain: number,
  f0: number,
  f1: number,
  q = 1,
): void {
  const src = ctx.createBufferSource()
  src.buffer = sharedNoise(ctx)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(f0, t)
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur)
  filter.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(gain * VOICE_TRIM, t)
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur)
  src.connect(filter).connect(g).connect(out)
  src.start(t)
  src.stop(t + dur + 0.02)
}

const SFX: Record<string, SfxSpec> = {
  player_shot: {
    priority: 2,
    build: (ctx, out, t) => {
      tone(ctx, out, t, 'square', 1250, 420, 0.09, 0.1)
      tone(ctx, out, t, 'sine', 2400, 900, 0.06, 0.04)
      return 0.12
    },
  },
  // deliberately darker and grainier than player_shot: you must hear the
  // difference without looking
  enemy_shot: {
    priority: 2,
    build: (ctx, out, t) => {
      tone(ctx, out, t, 'sawtooth', 340, 120, 0.16, 0.09)
      noise(ctx, out, t, 0.1, 0.04, 900, 300, 2)
      return 0.18
    },
  },
  hit_metal: {
    priority: 1,
    build: (ctx, out, t) => {
      noise(ctx, out, t, 0.07, 0.09, 3200, 1100, 3)
      return 0.09
    },
  },
  explode_small: {
    priority: 3,
    build: (ctx, out, t) => {
      noise(ctx, out, t, 0.32, 0.24, 1400, 90, 0.8)
      tone(ctx, out, t, 'triangle', 210, 44, 0.3, 0.13)
      return 0.34
    },
  },
  explode_medium: {
    priority: 4,
    build: (ctx, out, t) => {
      noise(ctx, out, t, 0.6, 0.32, 1000, 60, 0.7)
      tone(ctx, out, t, 'triangle', 150, 32, 0.55, 0.17)
      return 0.62
    },
  },
  explode_huge: {
    priority: 6,
    build: (ctx, out, t) => {
      noise(ctx, out, t, 1.1, 0.38, 800, 40, 0.6)
      tone(ctx, out, t, 'triangle', 110, 24, 0.95, 0.22)
      tone(ctx, out, t, 'sine', 70, 20, 1.2, 0.16)
      return 1.2
    },
  },
  pickup: {
    priority: 5,
    build: (ctx, out, t) => {
      // ascending triad, so a pickup always reads as good news
      tone(ctx, out, t, 'triangle', 660, 660, 0.1, 0.1)
      tone(ctx, out, t + 0.06, 'triangle', 880, 880, 0.1, 0.1)
      tone(ctx, out, t + 0.12, 'triangle', 1320, 1320, 0.16, 0.11)
      return 0.32
    },
  },
  shield_break: {
    priority: 6,
    build: (ctx, out, t) => {
      noise(ctx, out, t, 0.4, 0.24, 4200, 400, 1.6)
      tone(ctx, out, t, 'square', 520, 160, 0.3, 0.11)
      return 0.42
    },
  },
  energy_low: {
    priority: 9,
    build: (ctx, out, t) => {
      tone(ctx, out, t, 'square', 880, 880, 0.1, 0.1)
      tone(ctx, out, t + 0.16, 'square', 660, 660, 0.12, 0.1)
      return 0.3
    },
  },
  boss_part_destroyed: {
    priority: 7,
    build: (ctx, out, t) => {
      noise(ctx, out, t, 0.7, 0.32, 1600, 80, 0.7)
      tone(ctx, out, t, 'sawtooth', 240, 50, 0.6, 0.16)
      return 0.72
    },
  },
  boss_phase_shift: {
    priority: 8,
    build: (ctx, out, t) => {
      // riser then impact
      tone(ctx, out, t, 'sawtooth', 120, 1400, 0.9, 0.13)
      noise(ctx, out, t + 0.9, 0.5, 0.32, 900, 60, 0.6)
      tone(ctx, out, t + 0.9, 'triangle', 130, 34, 0.6, 0.2)
      return 1.5
    },
  },
}

/**
 * tanh soft knee, so anything the limiter misses rounds off instead of tearing.
 *
 * `peak` caps the curve below full scale. A WaveShaper clamps its input to
 * [-1, 1], so the curve alone bounds the output - but with oversampling the
 * resampling filters ring and overshoot past it. On the final stage, use a
 * peak under 1 and no oversampling.
 */
function softClipCurve(peak = 1): Float32Array {
  const n = 2048
  const curve = new Float32Array(n)
  const k = 1.8
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = (Math.tanh(x * k) / Math.tanh(k)) * peak
  }
  return curve
}

interface Voice {
  gain: GainNode
  until: number
  priority: number
}

export class SfxEngine {
  private ctx: BaseAudioContext | null = null
  /** An offline context renders faster than real time and is never 'running'. */
  private offline = false
  private bus: GainNode | null = null
  private master: GainNode | null = null
  private masterBus: GainNode | null = null
  private voices: Voice[] = []
  private volume = 0.7
  private muted = false

  /**
   * Must be called from a user gesture, or the context stays suspended.
   * Accepts an existing context so the mix can be rendered offline and
   * measured for clipping.
   */
  unlock(external?: BaseAudioContext): void {
    if (this.ctx) {
      const live = this.ctx as AudioContext
      if (live.state === 'suspended' && typeof live.resume === 'function') void live.resume()
      return
    }
    if (external) {
      this.ctx = external
    } else {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctor()
    }
    const ctx = this.ctx
    this.offline = 'startRendering' in ctx

    this.bus = ctx.createGain()
    this.bus.gain.value = 1

    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.knee.value = 8
    comp.ratio.value = 6
    comp.attack.value = 0.003
    comp.release.value = 0.14

    // brickwall-ish: fast, hard, low threshold
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -2
    limiter.knee.value = 0
    limiter.ratio.value = 20
    limiter.attack.value = 0.001
    limiter.release.value = 0.06

    const shaper = ctx.createWaveShaper()
    shaper.curve = softClipCurve()
    shaper.oversample = '2x'

    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : this.volume

    // One final bus that the MUSIC also feeds into.
    //
    // Limiting each source on its own is not enough: two sources peaking at
    // -3 and -5.7 dBFS sum to +1.8 dBFS and clip at the device. Only a shared
    // limiter downstream of both can bound the mix.
    this.masterBus = ctx.createGain()
    this.masterBus.gain.value = 1

    const busLimiter = ctx.createDynamicsCompressor()
    busLimiter.threshold.value = -2.5
    busLimiter.knee.value = 0
    busLimiter.ratio.value = 20
    busLimiter.attack.value = 0.001
    busLimiter.release.value = 0.08

    // Last stage before the device: no oversampling and a sub-unity ceiling,
    // so nothing can ring past full scale. Measured: the summed mix peaked at
    // 1.046 with 2x oversampling here, which is exactly the clipping this is
    // meant to prevent.
    const busShaper = ctx.createWaveShaper()
    busShaper.curve = softClipCurve(0.94)
    busShaper.oversample = 'none'

    this.bus.connect(comp).connect(limiter).connect(shaper).connect(this.master)
    this.master.connect(this.masterBus)
    this.masterBus.connect(busLimiter).connect(busShaper).connect(ctx.destination)
  }

  /**
   * Where the music should connect, so both sources share one limiter.
   * Null until unlock() has built the graph.
   */
  get musicInput(): AudioNode | null {
    return this.masterBus
  }

  get rawContext(): BaseAudioContext | null {
    return this.ctx
  }

  setVolume(v: number): void {
    this.volume = v
    if (this.master) this.master.gain.value = this.muted ? 0 : v
  }

  setMuted(m: boolean): void {
    this.muted = m
    if (this.master) this.master.gain.value = m ? 0 : this.volume
  }

  get context(): BaseAudioContext | null {
    return this.ctx
  }

  play = (name: string): void => {
    const ctx = this.ctx
    const bus = this.bus
    if (!ctx || !bus || this.muted) return
    // A suspended context has currentTime frozen at 0, so everything would be
    // scheduled at the same instant and fire as one blast when it resumes.
    if (!this.offline) {
      const live = ctx as AudioContext
      if (typeof live.state === 'string' && live.state !== 'running') return
    }
    const spec = SFX[name]
    if (!spec) return

    const now = ctx.currentTime
    this.voices = this.voices.filter((v) => v.until > now)

    if (this.voices.length >= MAX_VOICES) {
      let worst = -1
      let worstP = spec.priority
      for (let i = 0; i < this.voices.length; i++) {
        if (this.voices[i].priority < worstP) {
          worstP = this.voices[i].priority
          worst = i
        }
      }
      // energy_low outranks everything, so it is never the one stolen
      if (worst < 0) return
      // Actually silence the stolen voice. Dropping only the bookkeeping
      // entry, as this used to, freed a slot while the sound kept playing -
      // so far more than MAX_VOICES could be audible at once, which is what
      // drove the bus into clipping.
      const victim = this.voices[worst]
      victim.gain.gain.cancelScheduledValues(now)
      victim.gain.gain.setValueAtTime(victim.gain.gain.value, now)
      victim.gain.gain.linearRampToValueAtTime(0, now + 0.03)
      this.voices.splice(worst, 1)
    }

    const voice = ctx.createGain()
    voice.gain.value = 1
    voice.connect(bus)

    const dur = spec.build(ctx, voice, now)
    this.voices.push({ gain: voice, until: now + dur, priority: spec.priority })
  }
}
