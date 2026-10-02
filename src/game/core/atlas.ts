import * as THREE from 'three'
import { PX_PER_UNIT } from './constants'

export interface FrameRect {
  x: number
  y: number
  w: number
  h: number
}

export interface AtlasFrame {
  frame: FrameRect
  pivot: { x: number; y: number }
  entity: string
  state: string
  partId?: string
}

export interface AnimDef {
  frames: string[]
  fps: number
  loop: boolean
}

export interface EntityDef {
  frameSize: { w: number; h: number }
  hitRadius: number
  gun?: [number, number]
  animations: Record<string, AnimDef>
}

export interface BossPartDef {
  frameSize: { w: number; h: number }
  hp: number
  anchor: [number, number]
  animations: Record<string, AnimDef>
}

export interface BossPhaseDef {
  from: number
  to: number
  [k: string]: unknown
}

export interface BossDef {
  id: string
  name: string
  level: number
  scale: number
  screenWidthFraction: number
  phases: BossPhaseDef[]
  parts: Record<string, BossPartDef>
}

export interface AtlasDoc {
  meta: {
    image: string
    emissive: string
    size: { w: number; h: number }
    padding: number
    extrude: number
    act: number
    entities?: Record<string, EntityDef>
    boss?: BossDef
  }
  frames: Record<string, AtlasFrame>
}

export interface AnimClip {
  /** Ordinals into the atlas uv table. */
  frames: Int32Array
  fps: number
  loop: boolean
  /** Total clip duration in seconds. */
  duration: number
}

export interface EntityRuntime {
  id: string
  hitRadius: number
  gun: [number, number]
  worldW: number
  worldH: number
  clips: Record<string, AnimClip>
}

export interface LoadedAtlas {
  name: string
  doc: AtlasDoc
  albedo: THREE.Texture
  emissive: THREE.Texture
  /** 4 floats per frame: u0, v0 (from top), du, dv - all normalised. */
  uv: Float32Array
  entities: Record<string, EntityRuntime>
  boss?: BossDef
}

function loadTexture(url: string, srgb: boolean): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (t) => {
        // flipY=false keeps UVs in image space, so the packer's rects are used
        // verbatim; the shader flips v instead.
        t.flipY = false
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
        t.magFilter = THREE.LinearFilter
        // No mipmaps: an atlas + mipmaps bleeds neighbouring frames.
        t.minFilter = THREE.LinearFilter
        t.generateMipmaps = false
        t.wrapS = THREE.ClampToEdgeWrapping
        t.wrapT = THREE.ClampToEdgeWrapping
        t.needsUpdate = true
        resolve(t)
      },
      undefined,
      reject,
    )
  })
}

export async function loadAtlas(base: string, name: string): Promise<LoadedAtlas> {
  const res = await fetch(`${base}/${name}.json`)
  if (!res.ok) throw new Error(`atlas ${name}: ${res.status}`)
  const doc = (await res.json()) as AtlasDoc

  const [albedo, emissive] = await Promise.all([
    loadTexture(`${base}/${doc.meta.image}`, true),
    loadTexture(`${base}/${doc.meta.emissive}`, true),
  ])

  const keys = Object.keys(doc.frames)
  const ordinal = new Map<string, number>()
  const uv = new Float32Array(keys.length * 4)
  const { w: AW, h: AH } = doc.meta.size
  keys.forEach((k, i) => {
    ordinal.set(k, i)
    const f = doc.frames[k].frame
    uv[i * 4 + 0] = f.x / AW
    uv[i * 4 + 1] = f.y / AH
    uv[i * 4 + 2] = f.w / AW
    uv[i * 4 + 3] = f.h / AH
  })

  const buildClips = (anims: Record<string, AnimDef>): Record<string, AnimClip> => {
    const out: Record<string, AnimClip> = {}
    for (const [state, def] of Object.entries(anims)) {
      const idx = new Int32Array(def.frames.length)
      def.frames.forEach((fk, i) => {
        idx[i] = ordinal.get(fk) ?? 0
      })
      out[state] = {
        frames: idx,
        fps: def.fps,
        loop: def.loop,
        duration: def.frames.length / def.fps,
      }
    }
    return out
  }

  const entities: Record<string, EntityRuntime> = {}
  for (const [id, def] of Object.entries(doc.meta.entities ?? {})) {
    entities[id] = {
      id,
      hitRadius: def.hitRadius,
      gun: def.gun ?? [0, 0],
      worldW: def.frameSize.w / PX_PER_UNIT,
      worldH: def.frameSize.h / PX_PER_UNIT,
      clips: buildClips(def.animations),
    }
  }

  const boss = doc.meta.boss
  if (boss) {
    for (const [id, part] of Object.entries(boss.parts)) {
      entities[id] = {
        id,
        hitRadius: 0.4,
        gun: [0, 0],
        worldW: part.frameSize.w / PX_PER_UNIT,
        worldH: part.frameSize.h / PX_PER_UNIT,
        clips: buildClips(part.animations),
      }
    }
  }

  return { name, doc, albedo, emissive, uv, entities, boss }
}

/** Frame ordinal for a clip at time `t`, honouring loop / clamp. */
export function clipFrame(clip: AnimClip, t: number): number {
  const n = clip.frames.length
  if (n === 0) return 0
  let i = Math.floor(t * clip.fps)
  if (clip.loop) i = ((i % n) + n) % n
  else i = Math.min(n - 1, Math.max(0, i))
  return clip.frames[i]
}
