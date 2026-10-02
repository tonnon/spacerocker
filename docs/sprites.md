# Spacerocker — pack de sprites (Ato I + CHEFE 1)

200 frames gerados proceduralmente. Determinístico: mesmo código, mesmos bytes.

```
act1_albedo.png / act1_emissive.png / act1.json      2048×1024 · 108 frames
boss_hexapod_albedo.png / _emissive.png / .json      2048×4096 ·  92 frames
sprites-preview.html                                 contact sheet animada
spritegen/                                           o gerador (Python)
```

Abra `sprites-preview.html` no navegador — ele é autocontido (os PNGs vão
embutidos), então funciona sozinho, fora da pasta. Toca cada animação no fps real
e tem quatro modos: composto (como a engine desenha), albedo, emissivo e teste de
silhueta a 60px.

---

## O que tem dentro

**Ato I — 4 inimigos.** `scrap` 128px · `interceptor` 128px · `turret` 128px ·
`swarmer` 64px. Cada um com `idle` 4f · `bank_left` 3f · `bank_right` 3f ·
`charge` 6f · `fire` 2f · `hit` 1f · `death` 8f.

**CHEFE 1 HEXAPOD — 5 partes destrutíveis.** `hull` 448×416 · `pod_l` e `pod_r`
208×208 · `bay` 232×176 · `core` 152×152. Partes com armamento têm
`idle` · `charge` · `fire` · `damaged` · `destroyed`; o casco tem
`idle` · `damaged` · `destroyed`.

O chefe **não é um sprite só**. Cada parte é montada pela engine no offset
publicado em `anchor`, em unidades normalizadas da largura do casco. Destruir um
pod troca a animação daquela parte para `destroyed` sem tocar no resto.

---

## Duas camadas, sempre

Cada atlas vem em par, com layout idêntico:

- `*_albedo.png` — casco, RGBA
- `*_emissive.png` — só os neons, sobre preto, RGB

O Bloom lê **apenas** o emissivo. É isso que dá o brilho eletropunk sem lavar o
casco. No Three.js:

```ts
const albedo = useTexture('/sprites/act1_albedo.png')
const emissive = useTexture('/sprites/act1_emissive.png')
albedo.magFilter = albedo.minFilter = THREE.LinearFilter
albedo.colorSpace = THREE.SRGBColorSpace

// plano do inimigo: material base + material aditivo na layer EMISSIVE
<mesh>
  <planeGeometry args={[w, h]} />
  <meshBasicMaterial map={albedo} transparent depthWrite={false} />
</mesh>
<mesh layers={EMISSIVE_LAYER}>
  <planeGeometry args={[w, h]} />
  <meshBasicMaterial map={emissive} blending={THREE.AdditiveBlending}
                     transparent depthWrite={false} />
</mesh>
```

Para animar, ajuste `map.offset` e `map.repeat` a partir do `frame` do JSON —
as duas texturas usam exatamente o mesmo retângulo.

---

## Formato do JSON

TexturePacker *hash*, com extras. Um JSON descreve os dois PNGs.

```jsonc
{
  "meta": {
    "image": "act1_albedo.png",
    "emissive": "act1_emissive.png",
    "size": { "w": 2048, "h": 1024 },
    "padding": 2, "extrude": 1, "act": 1,
    "entities": {
      "scrap": {
        "frameSize": { "w": 128, "h": 128 },
        "hitRadius": 0.34,          // fração da largura do frame
        "gun": [0.03, 0.72],        // onde nasce o projétil, normalizado
        "animations": {
          "idle": { "frames": ["scrap_idle_0", "..."], "fps": 8, "loop": true }
        }
      }
    }
  },
  "frames": {
    "scrap_idle_0": {
      "frame": { "x": 652, "y": 392, "w": 128, "h": 128 },
      "pivot": { "x": 0.5, "y": 0.5 },
      "entity": "scrap", "state": "idle"
    }
  }
}
```

`boss_hexapod.json` troca `meta.entities` por `meta.boss`, que traz `parts`
(com `hp` e `anchor` por parte) e `phases` com os limiares de HP.

**`hitRadius` é menor que o sprite de propósito.** Colisão justa em shmup vem
daí; não aumente para casar com a arte.

---

## Regenerar

```bash
pip install pillow numpy
python -m spritegen.build            # tudo
python -m spritegen.build --skip-boss
```

Saída em `out/sprites/`. Rodar duas vezes produz bytes idênticos — o RNG é
semeado por entidade.

### Onde mexer

| Quero | Arquivo |
|---|---|
| Mudar a forma de um inimigo | `spritegen/enemies.py` |
| Mudar o chefe | `spritegen/hexapod.py` |
| Rampa de tons, bevel, contorno, explosão | `spritegen/render.py` |
| Curvas de animação, dano, flash de hit | `spritegen/anim.py` |
| Packing, padding, extrude, JSON | `spritegen/atlas.py` |

### Atos II e III

As cores emissivas já são por ato em `render.ACT_EMISSIVE`. Para gerar o mesmo
bestiário na paleta do Ato II:

```bash
python -m spritegen.build --act 2
```

O casco não muda — só o neon e o nome do atlas (`act2_*`). Os inimigos novos de
cada ato (`bulwark`, `miner`, `lance`, `wraith`, `splitter`, `runner`, `barge`)
entram como funções novas em `enemies.py` e uma entrada em `SHIPS`.

---

## Regras de arte embutidas no gerador

Se você editar as formas, mantenha isto, senão o jogo perde leitura:

- **Silhueta primeiro.** Cada inimigo tem que ser distinguível em preto sólido a
  60px. O modo "Silhueta" da contact sheet é o teste.
- **Emissivo ≤ 15% da área.** Neon é acento, não cobertura.
- **Rampa de 3 tons com corte duro.** Sem gradiente suave — o corte é o que
  segura a leitura em movimento.
- **Telegrafia.** `charge` existe para avisar. Se um ataque não passa por
  `charge` antes de `fire`, o inimigo é injusto.
- **Contorno escuro de 1px** em tudo, para separar do terreno.
