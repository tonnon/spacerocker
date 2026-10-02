import {
  BlendFunction,
  ChromaticAberrationEffect,
  Effect,
  EffectComposer,
  EffectPass,
  KernelSize,
  NoiseEffect,
  RenderPass,
  SelectiveBloomEffect,
  VignetteEffect,
} from 'postprocessing'
import * as THREE from 'three'

/** Subtle CRT scanlines. Toggleable, because not everyone wants them. */
class ScanlineEffect extends Effect {
  constructor(opacity: number) {
    super(
      'SpacerockerScanline',
      `
      uniform float uOpacity;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        float line = sin(uv.y * resolution.y * 3.14159) * 0.5 + 0.5;
        outputColor = vec4(inputColor.rgb * (1.0 - uOpacity * line), inputColor.a);
      }`,
      {
        blendFunction: BlendFunction.NORMAL,
        uniforms: new Map([['uOpacity', new THREE.Uniform(opacity)]]),
      },
    )
  }

  set opacity(v: number) {
    const u = this.uniforms.get('uOpacity')
    if (u) u.value = v
  }
}

export interface PostOptions {
  scanlines: boolean
  reducedMotion: boolean
}

/**
 * Pipeline order is fixed by spec 3:
 * SelectiveBloom -> ChromaticAberration -> Noise -> Vignette -> Scanline.
 * No motion blur, no DOF: the game needs instant reading.
 */
export class PostChain {
  readonly composer: EffectComposer
  private readonly bloom: SelectiveBloomEffect
  private readonly chroma: ChromaticAberrationEffect
  private readonly scanline: ScanlineEffect
  private readonly baseOffset = 0.0006

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    opts: PostOptions,
  ) {
    this.composer = new EffectComposer(renderer, {
      frameBufferType: THREE.HalfFloatType,
    })
    this.composer.addPass(new RenderPass(scene, camera))

    this.bloom = new SelectiveBloomEffect(scene, camera, {
      blendFunction: BlendFunction.ADD,
      luminanceThreshold: 0.25,
      luminanceSmoothing: 0.12,
      intensity: 1.1,
      radius: 0.7,
      // Not mipmapBlur: generating mipmaps of a half-float target is
      // broken on software GL and flaky on some integrated drivers, and
      // it takes the whole base image with it. Kernel blur works
      // everywhere for a barely distinguishable result.
      kernelSize: KernelSize.LARGE,
      mipmapBlur: false,
    })
    this.bloom.ignoreBackground = true

    this.chroma = new ChromaticAberrationEffect({
      offset: new THREE.Vector2(this.baseOffset, this.baseOffset),
      radialModulation: false,
      modulationOffset: 0,
    })

    const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY })
    noise.blendMode.opacity.value = opts.reducedMotion ? 0.015 : 0.035

    const vignette = new VignetteEffect({ darkness: 0.55, offset: 0.32 })

    this.scanline = new ScanlineEffect(opts.scanlines && !opts.reducedMotion ? 0.04 : 0)

    this.composer.addPass(
      new EffectPass(camera, this.bloom, this.chroma, noise, vignette, this.scanline),
    )
  }

  /** Emissive meshes, bullets and sparks are what should glow. */
  addBloomTargets(objects: THREE.Object3D[]): void {
    for (const o of objects) this.bloom.selection.add(o)
  }

  setScanlines(on: boolean): void {
    this.scanline.opacity = on ? 0.04 : 0
  }

  /** 0..1, ramps the aberration up to 0.003 on damage and boss entry. */
  setAberration(amount: number): void {
    const v = this.baseOffset + amount * (0.003 - this.baseOffset)
    this.chroma.offset.set(v, v)
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h)
  }

  render(dt: number): void {
    this.composer.render(dt)
  }

  dispose(): void {
    this.composer.dispose()
  }
}
