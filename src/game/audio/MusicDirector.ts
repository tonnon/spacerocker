import type * as ToneNS from 'tone'
import { ACTS, type ActId } from '@/theme/palette'

/**
 * Three layers that fade in and out by intensity, always in sync (spec 10).
 *
 * The transport is never restarted mid-level - layers are gated by gain, so
 * the groove stays locked to the kick no matter what the player is doing.
 *
 * Tone is imported lazily, on the gesture that unlocks audio. Importing it
 * eagerly spins up its global AudioContext and its internal clock at page
 * load; while that context is still suspended the clock queries its own tick
 * timeline at a negative time and throws on every callback. Loading it late
 * also keeps ~400KB of synth engine out of the initial bundle.
 */

export type Intensity = 'calm' | 'combat' | 'boss'

interface StemEntry {
  base: string
  groove: string
  lead: string
  bpm: number
}

type Manifest = Record<string, StemEntry | null>

const SCALES: Record<string, number[]> = {
  // natural minor, as semitone offsets
  A: [57, 59, 60, 62, 64, 65, 67],
  C: [48, 50, 51, 53, 55, 56, 58],
  F: [53, 55, 56, 58, 60, 61, 63],
}

const midi = (n: number): number => 440 * 2 ** ((n - 69) / 12)

/**
 * React StrictMode mounts twice in development, and two MusicDirectors both
 * driving Tone's single global Transport corrupts its tick timeline. Only the
 * first instance is allowed to own the transport.
 */
let transportOwner: MusicDirector | null = null

export class MusicDirector {
  private started = false
  private act: ActId = 1
  private intensity: Intensity = 'calm'
  private comboHot = false
  private volume = 0.6
  private muted = false

  private T: typeof ToneNS | null = null
  private master?: ToneNS.Gain
  private filter?: ToneNS.Filter
  private sidechain?: ToneNS.Gain
  private gains: Record<'base' | 'groove' | 'lead', ToneNS.Gain> | null = null
  private kick?: ToneNS.MembraneSynth
  private sub?: ToneNS.MonoSynth
  private acid?: ToneNS.MonoSynth
  private hat?: ToneNS.NoiseSynth
  private lead?: ToneNS.PolySynth
  private parts: ToneNS.Sequence[] = []
  private stems: Manifest = {}

  async loadManifest(url = '/audio/manifest.json'): Promise<void> {
    try {
      const res = await fetch(url)
      if (res.ok) this.stems = (await res.json()) as Manifest
    } catch {
      // The game must sound right with public/audio empty (spec 10).
      this.stems = {}
    }
  }

  get running(): boolean {
    return this.started
  }

  /**
   * Call from a user gesture. Safe to call again if autoplay was refused.
   *
   * `shared` routes the music through the SFX engine's master bus so both
   * sit behind one limiter. Without it each side is limited alone and
   * their SUM still clips at the device.
   */
  async start(shared?: { context: BaseAudioContext; destination: AudioNode }): Promise<void> {
    if (this.started) return
    if (transportOwner && transportOwner !== this) return

    const T = await import('tone')
    if (shared) {
      try {
        T.setContext(shared.context as unknown as Parameters<typeof T.setContext>[0])
      } catch {
        // Tone keeps its own context; the music then limits alone
        shared = undefined
      }
    }
    await T.start()

    const ctx = T.getContext()
    if (ctx.state !== 'running') {
      try {
        await ctx.resume()
      } catch {
        // still blocked
      }
    }
    if (ctx.state !== 'running') {
      // Autoplay still refused. Leave the transport alone and wait for a real
      // gesture; starting it on a suspended context leaves Tone's tick
      // timeline empty and its clock throws on every audio callback.
      return
    }

    this.T = T
    transportOwner = this
    this.started = true
    this.build(shared?.destination)

    const t = T.getTransport()
    // Order matters: the transport must be running before any bpm automation.
    t.bpm.value = ACTS[this.act].bpm
    if (t.state !== 'started') t.start('+0.08')
  }

  private build(out?: AudioNode): void {
    const T = this.T
    if (!T) return

    // -3 leaves headroom for the shared bus limiter downstream to work
    // with, rather than handing it a signal already at full scale.
    const limiter = new T.Limiter(-3)
    if (out) limiter.connect(out)
    else limiter.toDestination()
    const comp = new T.Compressor({ threshold: -18, ratio: 4, attack: 0.008, release: 0.12 })
    this.master = new T.Gain(this.muted ? 0 : this.volume)
    this.filter = new T.Filter({ type: 'lowpass', frequency: 18000, Q: 1 })
    this.sidechain = new T.Gain(1)
    this.master.connect(this.filter)
    this.filter.connect(this.sidechain)
    this.sidechain.connect(comp)
    comp.connect(limiter)

    this.gains = {
      base: new T.Gain(1).connect(this.master),
      groove: new T.Gain(0).connect(this.master),
      lead: new T.Gain(0).connect(this.master),
    }

    this.kick = new T.MembraneSynth({
      pitchDecay: 0.045,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.1 },
    }).connect(this.gains.base)

    this.sub = new T.MonoSynth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.7, release: 0.2 },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.2, baseFrequency: 90 },
    }).connect(this.gains.base)
    this.sub.volume.value = -10

    // acid: high resonance plus a fast filter envelope is the whole genre
    this.acid = new T.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.005, decay: 0.16, sustain: 0.2, release: 0.1 },
      filterEnvelope: {
        attack: 0.005,
        decay: 0.14,
        sustain: 0.2,
        release: 0.2,
        baseFrequency: 180,
        octaves: 3.4,
        exponent: 2,
      },
      filter: { Q: 9, type: 'lowpass' },
    }).connect(this.gains.groove)
    this.acid.volume.value = -12

    this.hat = new T.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.035, sustain: 0 },
    }).connect(this.gains.groove)
    this.hat.volume.value = -24

    this.lead = new T.PolySynth(T.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.24, sustain: 0.15, release: 0.3 },
    }).connect(this.gains.lead)
    this.lead.volume.value = -18

    this.buildSequences(T)
  }

  private buildSequences(T: typeof ToneNS): void {
    const scale = (): number[] => SCALES[ACTS[this.act].tonic] ?? SCALES.A

    const kickSeq = new T.Sequence(
      (time) => {
        this.kick?.triggerAttackRelease('C1', '8n', time)
        // sidechain duck, the cheapest way to make a mix breathe
        const g = this.sidechain?.gain
        if (g) {
          g.cancelScheduledValues(time)
          g.setValueAtTime(0.45, time)
          g.linearRampToValueAtTime(1, time + 0.18)
        }
      },
      [0, 0, 0, 0],
      '4n',
    ).start(0)

    const subSeq = new T.Sequence(
      (time, step: number) => {
        const s = scale()
        this.sub?.triggerAttackRelease(midi(s[step % s.length] - 24), '8n', time)
      },
      [0, 0, 4, 0, 0, 2, 4, 0],
      '8n',
    ).start(0)

    const acidSeq = new T.Sequence(
      (time, step: number) => {
        if (step < 0) return
        const s = scale()
        this.acid?.triggerAttackRelease(midi(s[step % s.length] - 12), '16n', time)
      },
      [0, -1, 2, 0, 4, -1, 0, 6, 2, -1, 4, 0, 5, -1, 2, 4],
      '16n',
    ).start(0)

    const hatSeq = new T.Sequence(
      (time, on: number) => {
        if (on) this.hat?.triggerAttackRelease('32n', time)
      },
      [0, 1, 0, 1, 0, 1, 1, 1],
      '8n',
    ).start(0)

    const leadSeq = new T.Sequence(
      (time, step: number) => {
        if (step < 0) return
        const s = scale()
        this.lead?.triggerAttackRelease(
          [midi(s[step % s.length]), midi(s[(step + 2) % s.length])],
          '16n',
          time,
        )
      },
      [0, 4, -1, 2, 6, -1, 4, 0],
      '8n',
    ).start(0)

    this.parts = [kickSeq, subSeq, acidSeq, hatSeq, leadSeq]
  }

  private applyAct(act: ActId): void {
    const T = this.T
    if (!T || !this.started) return
    const t = T.getTransport()
    if (t.state !== 'started') return
    const theme = ACTS[act]
    const boss = this.intensity === 'boss'
    t.bpm.rampTo(theme.bpm + (boss ? 6 : 0), 1.2)
  }

  setAct(act: ActId): void {
    this.act = act
    this.applyAct(act)
  }

  setIntensity(i: Intensity): void {
    if (this.intensity === i) return
    this.intensity = i
    if (!this.gains) return
    const t = 1.4
    this.gains.base.gain.rampTo(1, t)
    this.gains.groove.gain.rampTo(i === 'calm' ? 0 : 1, t)
    this.gains.lead.gain.rampTo(i === 'boss' ? 1 : 0, t)
    this.applyAct(this.act)
  }

  /**
   * Lead also comes in on a hot multiplier, not just on bosses.
   * Edge-triggered: this is called every frame, and scheduling a ramp on each
   * one floods Tone's automation timeline.
   */
  setComboHeat(hot: boolean): void {
    if (this.comboHot === hot) return
    this.comboHot = hot
    if (!this.gains || this.intensity === 'boss') return
    this.gains.lead.gain.rampTo(hot ? 0.8 : 0, 1.2)
  }

  /** Duck to a 400Hz lowpass for 1.5s, then open. Cheapest tension trick. */
  bossSting(): void {
    const T = this.T
    const f = this.filter
    if (!T || !f) return
    const now = T.now()
    f.frequency.cancelScheduledValues(now)
    f.frequency.setValueAtTime(400, now)
    f.frequency.exponentialRampToValueAtTime(18000, now + 1.5)
  }

  setVolume(v: number): void {
    this.volume = v
    this.master?.gain.rampTo(this.muted ? 0 : v, 0.1)
  }

  setMuted(m: boolean): void {
    this.muted = m
    this.master?.gain.rampTo(m ? 0 : this.volume, 0.1)
  }

  /** True when real stems were found for this act. */
  hasStems(act: ActId): boolean {
    return !!this.stems[`act${act}`]
  }

  stop(): void {
    if (transportOwner === this) transportOwner = null
    this.T?.getTransport().stop()
    for (const p of this.parts) p.dispose()
    this.parts = []
    this.started = false
  }
}
