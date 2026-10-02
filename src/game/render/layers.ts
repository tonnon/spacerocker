import * as THREE from 'three'
import { clipFrame, type LoadedAtlas } from '../core/atlas'
import { MAX_BULLETS, MAX_PARTICLES, SPRITE_TILT } from '../core/constants'
import { BULLET_LASER, BULLET_MINE, type Bullets } from '../systems/bullets'
import type { Particles } from '../systems/particles'

const SPRITE_CAP = 224
const dummy = new THREE.Object3D()

/**
 * One instanced batch per atlas: albedo and emissive share the geometry AND
 * the instance matrix, so filling one fills both. 120 enemies plus the player
 * plus every boss part costs two draw calls per atlas (spec 4, 12).
 */
class AtlasBatch {
  readonly albedo: THREE.InstancedMesh
  readonly emissive: THREE.InstancedMesh
  private readonly uv: THREE.InstancedBufferAttribute
  private readonly flash: THREE.InstancedBufferAttribute
  private readonly alpha: THREE.InstancedBufferAttribute
  count = 0

  constructor(readonly atlas: LoadedAtlas) {
    const geo = new THREE.PlaneGeometry(1, 1)
    this.uv = new THREE.InstancedBufferAttribute(new Float32Array(SPRITE_CAP * 4), 4)
    this.flash = new THREE.InstancedBufferAttribute(new Float32Array(SPRITE_CAP), 1)
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(SPRITE_CAP), 1)
    this.uv.setUsage(THREE.DynamicDrawUsage)
    this.flash.setUsage(THREE.DynamicDrawUsage)
    this.alpha.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('aUv', this.uv)
    geo.setAttribute('aFlash', this.flash)
    geo.setAttribute('aAlpha', this.alpha)

    const common = {
      vertexShader: `
        attribute vec4 aUv;
        attribute float aFlash;
        attribute float aAlpha;
        varying vec2 vTex;
        varying float vFlash;
        varying float vAlpha;
        void main() {
          // flipY is false on the texture, so v is measured from the top
          vTex = vec2(aUv.x + uv.x * aUv.z, aUv.y + (1.0 - uv.y) * aUv.w);
          vFlash = aFlash;
          vAlpha = aAlpha;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }`,
    }

    this.albedo = new THREE.InstancedMesh(
      geo,
      new THREE.ShaderMaterial({
        uniforms: { map: { value: atlas.albedo } },
        vertexShader: common.vertexShader,
        fragmentShader: `
          uniform sampler2D map;
          varying vec2 vTex;
          varying float vFlash;
          varying float vAlpha;
          void main() {
            vec4 c = texture2D(map, vTex);
            if (c.a < 0.04) discard;
            gl_FragColor = vec4(mix(c.rgb, vec3(1.0), vFlash), c.a * vAlpha);
          }`,
        transparent: true,
        // Playfield layers never depth-test against the terrain: a ship
        // or a shot must never be swallowed by the ground it flies over.
        // Ordering comes from renderOrder and from push order instead.
        depthTest: false,
        depthWrite: false,
      }),
      SPRITE_CAP,
    )

    this.emissive = new THREE.InstancedMesh(
      geo,
      new THREE.ShaderMaterial({
        uniforms: { map: { value: atlas.emissive } },
        vertexShader: common.vertexShader,
        fragmentShader: `
          uniform sampler2D map;
          varying vec2 vTex;
          varying float vFlash;
          varying float vAlpha;
          void main() {
            vec3 c = texture2D(map, vTex).rgb;
            gl_FragColor = vec4(c * (1.0 + vFlash * 2.0) * vAlpha, 1.0);
          }`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
      }),
      SPRITE_CAP,
    )
    // share the matrix buffer: fill once, both meshes see it
    this.emissive.instanceMatrix = this.albedo.instanceMatrix
    this.albedo.frustumCulled = false
    this.emissive.frustumCulled = false
    this.albedo.renderOrder = 4
    this.emissive.renderOrder = 5
  }

  begin(): void {
    this.count = 0
  }

  push(
    entityId: string,
    state: string,
    time: number,
    x: number,
    y: number,
    z: number,
    rot: number,
    scale: number,
    flash: number,
    alpha: number,
  ): void {
    if (this.count >= SPRITE_CAP) return
    const def = this.atlas.entities[entityId]
    if (!def) return
    const clip = def.clips[state] ?? def.clips.idle
    if (!clip) return
    const ord = clipFrame(clip, time)

    const i = this.count++
    this.uv.array[i * 4 + 0] = this.atlas.uv[ord * 4 + 0]
    this.uv.array[i * 4 + 1] = this.atlas.uv[ord * 4 + 1]
    this.uv.array[i * 4 + 2] = this.atlas.uv[ord * 4 + 2]
    this.uv.array[i * 4 + 3] = this.atlas.uv[ord * 4 + 3]
    this.flash.array[i] = flash
    this.alpha.array[i] = alpha

    dummy.position.set(x, y, z)
    dummy.rotation.set(SPRITE_TILT, 0, rot)
    dummy.scale.set(def.worldW * scale, def.worldH * scale, 1)
    dummy.updateMatrix()
    this.albedo.setMatrixAt(i, dummy.matrix)
  }

  end(): void {
    this.albedo.count = this.count
    this.emissive.count = this.count
    this.albedo.instanceMatrix.needsUpdate = true
    this.uv.needsUpdate = true
    this.flash.needsUpdate = true
    this.alpha.needsUpdate = true
  }
}

export class SpriteLayer {
  private readonly batches = new Map<string, AtlasBatch>()
  readonly group = new THREE.Group()

  constructor(atlases: LoadedAtlas[]) {
    for (const a of atlases) {
      const b = new AtlasBatch(a)
      this.batches.set(a.name, b)
      this.group.add(b.albedo, b.emissive)
    }
  }

  /** Meshes that the selective bloom should read. */
  get bloomTargets(): THREE.Object3D[] {
    return [...this.batches.values()].map((b) => b.emissive)
  }

  begin(): void {
    for (const b of this.batches.values()) b.begin()
  }

  push(
    atlas: string,
    entityId: string,
    state: string,
    time: number,
    x: number,
    y: number,
    z: number,
    rot: number,
    scale: number,
    flash: number,
    alpha: number,
  ): void {
    this.batches.get(atlas)?.push(entityId, state, time, x, y, z, rot, scale, flash, alpha)
  }

  end(): void {
    for (const b of this.batches.values()) b.end()
  }
}

/**
 * Shots. Shape is analytic in the fragment shader, so the colourblind mode can
 * change the silhouette (player = circle, enemy = diamond) without textures.
 */
export class BulletLayer {
  readonly mesh: THREE.InstancedMesh
  private readonly color: THREE.InstancedBufferAttribute
  private readonly shape: THREE.InstancedBufferAttribute
  private readonly material: THREE.ShaderMaterial

  constructor() {
    const geo = new THREE.PlaneGeometry(1, 1)
    this.color = new THREE.InstancedBufferAttribute(new Float32Array(MAX_BULLETS * 3), 3)
    this.shape = new THREE.InstancedBufferAttribute(new Float32Array(MAX_BULLETS), 1)
    this.color.setUsage(THREE.DynamicDrawUsage)
    this.shape.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('aColor', this.color)
    geo.setAttribute('aShape', this.shape)

    this.material = new THREE.ShaderMaterial({
      uniforms: { uBoost: { value: 1 } },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aShape;
        varying vec2 vUv;
        varying vec3 vColor;
        varying float vShape;
        void main() {
          vUv = uv - 0.5;
          vColor = aColor;
          vShape = aShape;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform float uBoost;
        varying vec2 vUv;
        varying vec3 vColor;
        varying float vShape;
        void main() {
          float d;
          if (vShape < 0.5) {
            d = length(vUv) * 2.0;                       // player: circle
          } else if (vShape < 1.5) {
            d = (abs(vUv.x) + abs(vUv.y)) * 2.0;         // enemy: diamond
          } else if (vShape < 2.5) {
            d = max(abs(vUv.x) * 5.0, abs(vUv.y)) * 2.0; // laser: needle
          } else {
            d = length(vUv) * 2.0;
          }
          float a = smoothstep(1.0, 0.25, d);
          float core = smoothstep(0.65, 0.0, d);
          vec3 c = vColor * (0.55 + core * 1.9) * uBoost;
          if (a < 0.02) discard;
          gl_FragColor = vec4(c, a);
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    })

    this.mesh = new THREE.InstancedMesh(geo, this.material, MAX_BULLETS)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 8
    this.mesh.count = 0
  }

  /**
   * Reading rule (spec 3): player shots are cyan, enemy shots are orange.
   * Never swapped, never reused for anything else.
   */
  update(b: Bullets, alpha: number, colorblind: boolean): void {
    const n = b.count
    for (let i = 0; i < n; i++) {
      const x = b.px[i] + (b.x[i] - b.px[i]) * alpha
      const z = b.pz[i] + (b.z[i] - b.pz[i]) * alpha
      const isPlayer = b.team[i] === 0
      const k = b.kind[i]

      let sx = b.radius[i] * 2.6
      let sy = b.radius[i] * 2.6
      if (k === BULLET_LASER) {
        sx = b.radius[i] * 2.0
        sy = b.radius[i] * 9.0
      } else if (isPlayer) {
        sy = b.radius[i] * 4.2
      } else if (k === BULLET_MINE) {
        sx = sy = b.radius[i] * 3.4
      }

      dummy.position.set(x, 0.55, z)
      dummy.rotation.set(SPRITE_TILT, 0, 0)
      dummy.scale.set(sx, sy, 1)
      dummy.updateMatrix()
      this.mesh.setMatrixAt(i, dummy.matrix)

      if (isPlayer) {
        this.color.array[i * 3] = 0.0
        this.color.array[i * 3 + 1] = 0.9
        this.color.array[i * 3 + 2] = 1.0
      } else {
        this.color.array[i * 3] = 1.0
        this.color.array[i * 3 + 1] = 0.42
        this.color.array[i * 3 + 2] = 0.1
      }
      // shape doubles as the colourblind cue
      this.shape.array[i] = k === BULLET_LASER ? 2 : isPlayer ? 0 : colorblind ? 1 : 1
    }
    this.mesh.count = n
    this.mesh.instanceMatrix.needsUpdate = true
    this.color.needsUpdate = true
    this.shape.needsUpdate = true
  }
}

export class ParticleLayer {
  readonly mesh: THREE.InstancedMesh
  private readonly color: THREE.InstancedBufferAttribute

  constructor() {
    const geo = new THREE.PlaneGeometry(1, 1)
    this.color = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3)
    this.color.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('aColor', this.color)

    const material = new THREE.ShaderMaterial({
      vertexShader: `
        attribute vec3 aColor;
        varying vec2 vUv;
        varying vec3 vColor;
        void main() {
          vUv = uv - 0.5;
          vColor = aColor;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        void main() {
          float d = length(vUv) * 2.0;
          float a = smoothstep(1.0, 0.0, d);
          if (a < 0.02) discard;
          gl_FragColor = vec4(vColor * a, a);
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    })

    this.mesh = new THREE.InstancedMesh(geo, material, MAX_PARTICLES)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 7
    this.mesh.count = 0
  }

  update(p: Particles): void {
    const n = p.count
    for (let i = 0; i < n; i++) {
      const t = p.life[i] / p.maxLife[i]
      const s = p.size[i] * (0.4 + t * 0.9)
      dummy.position.set(p.x[i], p.y[i], p.z[i])
      dummy.rotation.set(SPRITE_TILT, 0, 0)
      dummy.scale.set(s, s, 1)
      dummy.updateMatrix()
      this.mesh.setMatrixAt(i, dummy.matrix)
      this.color.array[i * 3] = p.r[i] * t
      this.color.array[i * 3 + 1] = p.g[i] * t
      this.color.array[i * 3 + 2] = p.b[i] * t
    }
    this.mesh.count = n
    this.mesh.instanceMatrix.needsUpdate = true
    this.color.needsUpdate = true
  }
}
