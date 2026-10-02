import * as THREE from 'three'
import { ACTS, actOf } from '@/theme/palette'
import { BOSSES } from '../bosses'
import type { LoadedAtlas } from '../core/atlas'
import { CAM_DIST, CAM_LOOK_Z, CAM_PITCH, PLAYER_HIT_RADIUS } from '../core/constants'
import type { Simulation } from '../Simulation'
import { BulletLayer, ParticleLayer, SpriteLayer } from './layers'
import { PostChain, type PostOptions } from './post'
import { Terrain } from './terrain'

const SHIP_Y = 0.75
const PICKUP_Y = 0.6

/**
 * Owns every three.js object and pushes simulation state into it once per
 * frame. Nothing here is React; nothing here mutates the simulation.
 */
export class Renderer {
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  private readonly sprites: SpriteLayer
  private readonly bullets = new BulletLayer()
  private readonly particles = new ParticleLayer()
  private readonly terrain: Terrain
  private post: PostChain | null = null
  private gl: THREE.WebGLRenderer | null = null
  /** Debug escape hatch: draw the raw scene, skipping the effect chain. */
  bypassPost = false
  private readonly baseCamPos = new THREE.Vector3()
  /** 0..1 extra camera distance, ramped in for oversized bosses. */
  private camPull = 0
  private hitboxRing: THREE.Mesh
  private readonly pointerRay = new THREE.Raycaster()
  /** The plane the ships fly on, y = SHIP_Y. */
  private readonly flightPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -SHIP_Y)
  private readonly pointerNdc = new THREE.Vector2()
  private readonly pointerHit = new THREE.Vector3()

  constructor(atlases: LoadedAtlas[], act = 1) {
    const theme = ACTS[act as 1 | 2 | 3]
    this.scene.background = new THREE.Color(theme.fog)
    this.scene.fog = new THREE.Fog(theme.fog, 22, 46)

    this.camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.5, 220)
    this.baseCamPos.set(
      0,
      Math.sin(CAM_PITCH) * CAM_DIST,
      CAM_LOOK_Z + Math.cos(CAM_PITCH) * CAM_DIST,
    )
    this.camera.position.copy(this.baseCamPos)
    this.camera.lookAt(0, 0, CAM_LOOK_Z)

    this.terrain = new Terrain(theme)
    this.sprites = new SpriteLayer(atlases)

    this.scene.add(this.terrain.group)
    this.scene.add(this.sprites.group)
    this.scene.add(this.particles.mesh)
    this.scene.add(this.bullets.mesh)

    // focus-mode hitbox indicator
    const ringGeo = new THREE.RingGeometry(PLAYER_HIT_RADIUS * 0.8, PLAYER_HIT_RADIUS, 20)
    this.hitboxRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff2e88,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    this.hitboxRing.rotation.x = -Math.PI / 2
    this.hitboxRing.renderOrder = 9
    this.scene.add(this.hitboxRing)
  }

  attach(renderer: THREE.WebGLRenderer, opts: PostOptions): void {
    this.gl = renderer
    this.post = new PostChain(renderer, this.scene, this.camera, opts)
    this.post.addBloomTargets([
      ...this.sprites.bloomTargets,
      this.bullets.mesh,
      this.particles.mesh,
      this.terrain.edgeMesh,
    ])
  }

  /**
   * Where the cursor actually is in the world, so the ship can sit under
   * it instead of at a fixed fraction of the lane.
   */
  pointerToWorld(nx: number, ny: number, out: { pointerX: number; pointerZ: number }): void {
    // NDC y points up; DOM y points down
    this.pointerNdc.set(nx, -ny)
    this.pointerRay.setFromCamera(this.pointerNdc, this.camera)
    if (this.pointerRay.ray.intersectPlane(this.flightPlane, this.pointerHit)) {
      out.pointerX = this.pointerHit.x
      out.pointerZ = this.pointerHit.z
    }
  }

  setScanlines(on: boolean): void {
    this.post?.setScanlines(on)
  }

  setSize(w: number, h: number): void {
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.post?.setSize(w, h)
  }

  setAct(level: number, dark: boolean): void {
    const theme = ACTS[actOf(level)]
    this.terrain.setTheme(theme, dark)
    ;(this.scene.background as THREE.Color).set(theme.fog)
    ;(this.scene.fog as THREE.Fog).color.set(theme.fog)
    ;(this.scene.fog as THREE.Fog).near = dark ? 12 : 22
    ;(this.scene.fog as THREE.Fog).far = dark ? 30 : 46
  }

  /**
   * One frame. `alpha` is the fixed-step remainder, so positions are
   * interpolated and motion stays smooth at any refresh rate.
   */
  render(sim: Simulation, alpha: number, dt: number): void {
    const lerp = (p: number, c: number): number => p + (c - p) * alpha

    this.terrain.update(sim.canyon, sim.scroll)

    this.sprites.begin()

    // player
    const p = sim.player
    if (p.alive) {
      const px = lerp(p.px, p.x)
      const pz = lerp(p.pz, p.z)
      const blink = p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0
      this.sprites.push(
        'common',
        'player',
        p.weapons.lance > 0
          ? 'fire'
          : Math.abs(p.bank) > 0.35
            ? p.bank < 0
              ? 'bank_left'
              : 'bank_right'
            : 'idle',
        sim.time,
        px,
        SHIP_Y,
        pz,
        -p.bank * 0.22,
        1,
        p.hitFlash,
        blink ? 0.35 : 1,
      )
      this.hitboxRing.position.set(px, 0.5, pz)
      const ringMat = this.hitboxRing.material as THREE.MeshBasicMaterial
      ringMat.opacity += ((p.focus ? 0.95 : 0) - ringMat.opacity) * Math.min(1, dt * 12)
    } else {
      const ringMat = this.hitboxRing.material as THREE.MeshBasicMaterial
      ringMat.opacity = 0
    }

    // everything else with a sprite
    for (const e of sim.qSprites.entities) {
      if (e.dead) continue
      const t = e.transform
      const y = e.pickup ? PICKUP_Y + Math.sin(e.pickup.bob) * 0.25 : SHIP_Y
      this.sprites.push(
        e.sprite.atlas,
        e.sprite.entity,
        e.sprite.state,
        e.sprite.time,
        lerp(t.px, t.x),
        y,
        lerp(t.pz, t.z),
        t.rot,
        t.scale,
        e.sprite.flash,
        e.sprite.alpha,
      )
    }
    this.sprites.end()

    this.bullets.update(sim.bullets, alpha, sim.opts.colorblind)
    this.particles.update(sim.particles)

    // A boss bigger than the playfield needs the camera to give ground, or
    // there is nowhere left to dodge (spec 8: the Ouroboros pulls back 40%).
    const want = sim.boss && sim.boss.state !== 'dead' ? (BOSSES[sim.boss.id].cameraPull ?? 0) : 0
    this.camPull += (want - this.camPull) * Math.min(1, dt * 0.9)
    const dist = CAM_DIST * (1 + this.camPull)
    this.baseCamPos.set(0, Math.sin(CAM_PITCH) * dist, CAM_LOOK_Z + Math.cos(CAM_PITCH) * dist)

    // screen shake, unless the player turned it off
    const shake = sim.opts.reducedMotion ? 0 : sim.shake
    this.camera.position.set(
      this.baseCamPos.x + (Math.random() - 0.5) * shake * 0.9,
      this.baseCamPos.y + (Math.random() - 0.5) * shake * 0.9,
      this.baseCamPos.z,
    )
    this.camera.lookAt(0, 0, CAM_LOOK_Z)

    this.post?.setAberration(sim.opts.reducedMotion ? 0 : sim.aberration)
    if (this.bypassPost || !this.post) this.gl?.render(this.scene, this.camera)
    else this.post.render(dt)
  }

  dispose(): void {
    this.post?.dispose()
  }
}
