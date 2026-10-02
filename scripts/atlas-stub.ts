import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { AtlasDoc, EntityRuntime, LoadedAtlas } from '@/game/core/atlas'
import { PX_PER_UNIT } from '@/game/core/constants'

/**
 * Boss atlases loaded from disk without their textures.
 *
 * The simulation only reads part names, HP, anchors and frame sizes out of an
 * atlas; the pixels are the renderer's business. That lets a headless harness
 * fight the real bosses with the real published metadata.
 */
export function loadBossAtlasesFromDisk(): LoadedAtlas[] {
  const names = ['boss_hexapod', 'boss_basilisk', 'boss_ouroboros']
  const out: LoadedAtlas[] = []

  for (const name of names) {
    let doc: AtlasDoc
    try {
      doc = JSON.parse(
        readFileSync(
          fileURLToPath(new URL(`../public/sprites/${name}.json`, import.meta.url)),
          'utf8',
        ),
      ) as AtlasDoc
    } catch {
      continue
    }
    const boss = doc.meta.boss
    if (!boss) continue

    const entities: Record<string, EntityRuntime> = {}
    for (const [id, part] of Object.entries(boss.parts)) {
      entities[id] = {
        id,
        hitRadius: 0.4,
        gun: [0, 0],
        worldW: part.frameSize.w / PX_PER_UNIT,
        worldH: part.frameSize.h / PX_PER_UNIT,
        clips: {},
      }
    }
    out.push({
      name,
      doc,
      albedo: null as unknown as LoadedAtlas['albedo'],
      emissive: null as unknown as LoadedAtlas['emissive'],
      uv: new Float32Array(0),
      entities,
      boss,
    })
  }
  return out
}
