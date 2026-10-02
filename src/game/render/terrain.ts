import * as THREE from 'three'
import type { ActTheme } from '@/theme/palette'
import type { Canyon } from '../world/canyon'

const SLICES = 128
const SLICE_STEP = 0.95
const Z_NEAR = 8
const WALL_H = 6.2
/** Half-extent of the starfield plane, in world units. */
const OUTER = 38

/**
 * The canyon, drawn from the same 1D function the collision uses.
 *
 * Two wall ribbons plus a floor. Rebuilt every frame from ~128 slices, which
 * is a few thousand float writes - far cheaper than a scrolling heightfield,
 * and it guarantees the wall you see is the wall that kills you.
 */
export class Terrain {
  readonly group = new THREE.Group()
  private readonly wallGeo = new THREE.BufferGeometry()
  private readonly edgeGeo = new THREE.BufferGeometry()
  private readonly pos: Float32Array
  private readonly col: Float32Array
  private readonly edgePos: Float32Array
  private readonly edgeCol: Float32Array
  private readonly floor: THREE.Mesh
  private readonly floorMat: THREE.ShaderMaterial
  readonly edgeMesh: THREE.Mesh
  private theme: ActTheme

  constructor(theme: ActTheme) {
    this.theme = theme
    // 2 walls x (SLICES-1) segments x 1 quad x 6 verts. There is no
    // plateau any more: the canyon is a pair of structures hanging over
    // open space, so past the wall you see stars, not rock.
    const quads = 2 * (SLICES - 1)
    this.pos = new Float32Array(quads * 6 * 3)
    this.col = new Float32Array(quads * 6 * 3)
    this.wallGeo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    this.wallGeo.setAttribute('color', new THREE.BufferAttribute(this.col, 3))
    // the ribbon winding flips between the left and right wall, so both
    // faces must draw rather than half the canyon vanishing
    const wallMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
    })
    this.group.add(new THREE.Mesh(this.wallGeo, wallMat))

    // neon rim along the top of each wall
    const edgeQuads = 2 * (SLICES - 1)
    this.edgePos = new Float32Array(edgeQuads * 6 * 3)
    this.edgeCol = new Float32Array(edgeQuads * 6 * 3)
    this.edgeGeo.setAttribute('position', new THREE.BufferAttribute(this.edgePos, 3))
    this.edgeGeo.setAttribute('color', new THREE.BufferAttribute(this.edgeCol, 3))
    this.edgeMesh = new THREE.Mesh(
      this.edgeGeo,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    )
    this.edgeMesh.renderOrder = 3
    this.group.add(this.edgeMesh)

    this.floorMat = new THREE.ShaderMaterial({
      uniforms: {
        uScroll: { value: 0 },
        uFloor: { value: new THREE.Color(theme.floor) },
        uLine: { value: new THREE.Color(theme.wallEdge) },
        uFog: { value: new THREE.Color(theme.fog) },
        uDark: { value: 0 },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          // World space, not local: the plane lies in its own XY, so local z
          // is 0 everywhere and the grid would never scroll.
          vec4 world = modelMatrix * vec4(position, 1.0);
          vPos = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: `
        uniform float uScroll;
        uniform float uDark;
        uniform vec3 uFloor;
        uniform vec3 uLine;
        uniform vec3 uFog;
        varying vec3 vPos;

        float hash21(vec2 p) {
          p = fract(p * vec2(127.31, 311.7));
          p += dot(p, p + 34.23);
          return fract(p.x * p.y);
        }

        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
                     mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
                     f.y);
        }

        float nebula(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * vnoise(p);
            p *= 2.07;
            a *= 0.5;
          }
          return v;
        }

        // One star layer on a jittered lattice. Cells above the threshold get
        // a star, so density is a threshold rather than a loop.
        float stars(vec2 p, float thresh, float size) {
          vec2 id = floor(p);
          float n = hash21(id);
          if (n < thresh) return 0.0;
          vec2 off = vec2(hash21(id + 19.1), hash21(id + 47.7)) - 0.5;
          float d = length(fract(p) - 0.5 - off * 0.7);
          return smoothstep(size, 0.0, d) * (0.35 + 0.65 * fract(n * 91.7));
        }

        void main() {
          // NOTE: this shader writes LINEAR colour - the effect chain does the
          // linear->sRGB encode on the way out. A mid value here lands far
          // brighter on screen than the hex it came from, which is why every
          // coefficient below looks so small. Raise them and the background
          // turns into a bright wash that a bullet cannot be read against.
          vec3 c = uFloor * 0.26;

          // Domain-warped fbm: feeding noise back into its own coordinates is
          // what turns smooth blobs into the filaments and voids a real nebula
          // has. Drifts slowest of everything.
          // 0.055, not 0.022: at the lower frequency barely one noise cell
          // spanned the whole 49-unit view, so the cloud read as flat tint
          // instead of structure.
          vec2 nb = vec2(vPos.x, vPos.z + uScroll * 0.18) * 0.055;
          vec2 warp = vec2(nebula(nb + 3.1), nebula(nb + 7.7)) - 0.5;
          float n1 = nebula(nb * 1.6 + warp * 1.5);
          float n2 = nebula(nb * 3.1 - warp * 1.1 + 11.0);

          // two clouds, different hues: the act accent plus a magenta hydrogen
          // band, so the field has colour variation instead of one flat tint
          vec3 cloudA = uLine;
          vec3 cloudB = vec3(0.95, 0.22, 0.5);
          c = mix(c, cloudA * 0.07, smoothstep(0.30, 0.78, n1));
          c = mix(c, cloudB * 0.055, smoothstep(0.46, 0.88, n2) * 0.9);
          // voids: push the thin areas back down so filaments stand out
          c *= 0.45 + 0.55 * smoothstep(0.12, 0.55, n1);

          // Four star layers. Small cells keep the field dense, each layer
          // scrolls faster the closer it is meant to be, and the last one is
          // a handful of bright foreground stars with a halo.
          float s = stars(vec2(vPos.x, vPos.z + uScroll) * 2.4 + 5.0, 0.915, 0.085);
          s += stars(vec2(vPos.x, vPos.z + uScroll * 0.55) * 1.4 + 31.0, 0.895, 0.075) * 0.62;
          s += stars(vec2(vPos.x, vPos.z + uScroll * 0.28) * 0.75 + 77.0, 0.875, 0.07) * 0.38;
          c += vec3(0.55, 0.6, 0.72) * s;

          float big = stars(vec2(vPos.x, vPos.z + uScroll * 1.15) * 0.5 + 101.0, 0.988, 0.055);
          c += vec3(0.85, 0.88, 1.0) * big * 1.2;
          float halo = stars(vec2(vPos.x, vPos.z + uScroll * 1.15) * 0.5 + 101.0, 0.988, 0.17);
          c += cloudA * halo * 0.07;

          // Gentle haze at the far edge, plus the dark-biome squeeze on level 8
          float fog = clamp((-vPos.z - 10.0) / 36.0, 0.0, 1.0);
          float near = clamp((-vPos.z + 2.0) / 12.0, 0.0, 1.0);
          c = mix(c, uFog * 0.45, fog * 0.4);
          c = mix(c, uFog * 0.3, uDark * near * 0.85);
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
    const floorGeo = new THREE.PlaneGeometry(OUTER * 2.4, 170, 1, 1)
    this.floor = new THREE.Mesh(floorGeo, this.floorMat)
    this.floor.rotation.x = -Math.PI / 2
    this.floor.position.z = -55
    this.floor.renderOrder = 0
    this.group.add(this.floor)
  }

  setTheme(theme: ActTheme, dark: boolean): void {
    this.floorMat.uniforms.uFloor.value.set(theme.floor)
    this.floorMat.uniforms.uLine.value.set(theme.wallEdge)
    this.floorMat.uniforms.uFog.value.set(theme.fog)
    this.floorMat.uniforms.uDark.value = dark ? 1 : 0
    this.theme = theme
  }

  private writeQuad(
    arr: Float32Array,
    o: number,
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    cx: number,
    cy: number,
    cz: number,
    dx: number,
    dy: number,
    dz: number,
  ): number {
    // a-b-c, a-c-d
    arr[o++] = ax
    arr[o++] = ay
    arr[o++] = az
    arr[o++] = bx
    arr[o++] = by
    arr[o++] = bz
    arr[o++] = cx
    arr[o++] = cy
    arr[o++] = cz
    arr[o++] = ax
    arr[o++] = ay
    arr[o++] = az
    arr[o++] = cx
    arr[o++] = cy
    arr[o++] = cz
    arr[o++] = dx
    arr[o++] = dy
    arr[o++] = dz
    return o
  }

  private writeColor(arr: Float32Array, o: number, lo: THREE.Color, hi: THREE.Color): number {
    const seq = [lo, hi, hi, lo, hi, lo]
    for (const c of seq) {
      arr[o++] = c.r
      arr[o++] = c.g
      arr[o++] = c.b
    }
    return o
  }

  private readonly cLo = new THREE.Color()
  private readonly cHi = new THREE.Color()
  private readonly cEdge = new THREE.Color()

  update(canyon: Canyon, scroll: number): void {
    this.floorMat.uniforms.uScroll.value = scroll
    this.cLo.set(this.theme.fog)
    // darkened: at this camera the walls are big slabs, and at full
    // brightness they pull the eye off the playfield
    this.cHi.set(this.theme.wall).multiplyScalar(0.5)
    this.cEdge.set(this.theme.wallEdge)

    let p = 0
    let c = 0
    let ep = 0
    let ec = 0

    for (let i = 0; i < SLICES - 1; i++) {
      const z0 = Z_NEAR - i * SLICE_STEP
      const z1 = Z_NEAR - (i + 1) * SLICE_STEP
      const s0 = scroll - z0
      const s1 = scroll - z1

      for (const side of [-1, 1]) {
        const x0 = side < 0 ? canyon.leftAt(s0) : canyon.rightAt(s0)
        const x1 = side < 0 ? canyon.leftAt(s1) : canyon.rightAt(s1)
        // vertical face
        p = this.writeQuad(this.pos, p, x0, 0, z0, x0, WALL_H, z0, x1, WALL_H, z1, x1, 0, z1)
        c = this.writeColor(this.col, c, this.cLo, this.cHi)
        // neon rim
        ep = this.writeQuad(
          this.edgePos,
          ep,
          x0,
          WALL_H - 0.12,
          z0,
          x0,
          WALL_H + 0.16,
          z0,
          x1,
          WALL_H + 0.16,
          z1,
          x1,
          WALL_H - 0.12,
          z1,
        )
        ec = this.writeColor(this.edgeCol, ec, this.cEdge, this.cEdge)
      }
    }

    this.wallGeo.attributes.position.needsUpdate = true
    this.wallGeo.attributes.color.needsUpdate = true
    this.edgeGeo.attributes.position.needsUpdate = true
    this.edgeGeo.attributes.color.needsUpdate = true
    this.wallGeo.computeBoundingSphere()
  }
}
