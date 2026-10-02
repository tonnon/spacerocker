# SPACEROCKER — Prompt de construção

> Cole este documento inteiro como primeira mensagem para o agente (Claude Code, Cursor, etc.).
> Ele é a fonte de verdade do projeto: se algo neste doc conflitar com uma sugestão sua, este doc vence.

---

## 0. Papel e missão

Você é o desenvolvedor-líder e diretor técnico de **Spacerocker**, um shoot 'em up vertical (top-down scrolling shooter) para navegador, na linhagem de *River Raid* e *Xevious*, mas com renderização 3D em tempo real e estética eletropunk.

Você é responsável por **todo o pipeline**: engine, gameplay, níveis, IA de inimigos, chefes, HUD, áudio **e a geração dos sprite sheets de inimigos e chefes**. Não peça assets externos — você os produz.

Entregue um projeto que roda com `npm install && npm run dev`, sem assets binários baixados da internet.

---

## 1. Stack obrigatória

| Camada | Escolha | Motivo |
|---|---|---|
| Build | **Vite 6** + TypeScript 5.7 (strict) | HMR rápido, zero config pesada |
| UI / app shell | **React 19** | Só para menus, HUD e telas — nunca para o loop de jogo |
| 3D | **Three.js** via **@react-three/fiber v9** | Cena declarativa, integra com React sem custo no loop |
| Helpers 3D | **@react-three/drei** | Câmera, texturas, instancing |
| Pós-processamento | **@react-three/postprocessing** (`postprocessing`) | Bloom seletivo, chromatic aberration, scanlines |
| Simulação | **miniplex v2** (ECS) | Entidades/queries sem overhead de classes |
| Estado meta | **zustand v5** (vanilla store) | Menu, save, progressão — fora do frame loop |
| Áudio | **Tone.js** (música) + **Web Audio API cru** (SFX) | Trilha adaptativa sintetizada + SFX com pooling |
| Geração de assets | **Python + Pillow** (`spritegen/`, fora do bundle) | Sprite sheets determinísticos, versionáveis |
| Testes | **Vitest** | Colisão, spawn tables, máquinas de estado dos chefes |
| Lint | **Biome** | Um binário, rápido |

**Proibido:** motor de jogo pronto (Phaser, PlayCanvas, Unity WebGL), `localStorage` como fonte de verdade do estado de jogo, física de terceiros (Rapier/Cannon — a colisão é analítica), e qualquer asset com licença de terceiros.

---

## 2. A decisão visual central: 2.5D

O jogo pede **sprite sheets** e ao mesmo tempo **estética 3D bonita**. Resolva assim, e siga à risca:

- O **mundo** (terreno, cânions, estruturas, água/plasma, skybox) é geometria 3D real, com scroll no eixo Z e iluminação dinâmica.
- As **naves** (player, inimigos, chefes) são **billboards texturizados** — planos no espaço 3D com o sprite aplicado, levemente inclinados no eixo X para acompanhar a perspectiva da câmera.
- Cada sprite tem **duas texturas**: `albedo` (casco, metal dessaturado) e `emissive` (só os neons, resto preto). O Bloom lê apenas o canal emissivo via `SelectiveBloom`. É isso que produz o brilho eletropunk sem lavar a imagem inteira.
- Câmera: `PerspectiveCamera`, FOV 42°, posicionada acima e ligeiramente atrás do player, inclinada ~68° para baixo. Não é top-down puro — a inclinação é o que vende o 3D.

Resultado: parece um jogo 3D moderno, mas a arte dos inimigos é sprite sheet, como pedido.

---

## 3. Direção de arte

### Paleta base (tokens em `src/theme/palette.ts`)

```
--void        #05060D   fundo profundo, quase preto azulado
--hull        #2A2F3E   casco metálico (albedo dos inimigos)
--hull-light  #4B5368   highlight de chapa
--rust        #7A4A3C   desgaste, painéis danificados
--signal      #FF2E88   magenta de sinalização (player + UI crítica)
--coolant     #00E5FF   ciano de propulsão e escudo
```

Cada ato reescreve **apenas** as cores emissivas dos inimigos e a luz ambiente do terreno:

| Ato | Fases | Emissivo inimigo | Luz do terreno | Nome |
|---|---|---|---|---|
| I | 1–5 | `#00E5FF` ciano | azul-aço frio | Órbita Morta |
| II | 6–10 | `#9D4EDD` violeta + `#B6FF3B` ácido | verde-abissal | Recife de Neon |
| III | 11–15 | `#FF6B1A` laranja + `#FFF3C4` branco quente | vermelho de fundição | Colapso do Núcleo |

O player é **sempre magenta/ciano**, em qualquer ato — é assim que o jogador se acha no meio do caos.

### Tipografia

- **Display (título, nome de chefe, "FASE 07"):** uma grotesca condensada pesada — use **Archivo Black** ou **Anton** via `@fontsource`. Letra grande, tracking negativo, quase colidindo.
- **HUD e números:** **Chakra Petch** (semi-técnica, legível em movimento). Uma família só para todo o HUD.
- Números de score/combo em tabular-nums, senão os dígitos dançam.
- Não use ALL CAPS em labels pequenos do HUD — use no display, onde é gesto gráfico, não rótulo.

### Pós-processamento (ordem exata do pipeline)

1. `SelectiveBloom` — intensidade 1.1, luminanceThreshold 0.25, radius 0.7, só na layer `EMISSIVE`
2. `ChromaticAberration` — offset 0.0006, sobe para 0.003 durante dano e entrada de chefe
3. `Noise` — opacity 0.035, blend `OVERLAY`
4. `Vignette` — darkness 0.55
5. Scanline sutil como shader custom, opacity 0.04, **desligável** nas opções

Nada de motion blur. Nada de DOF. O jogo precisa de leitura instantânea.

### Regra de leitura (inegociável)

Projétil inimigo é **sempre** laranja-quente `#FF6B1A`. Projétil do player é **sempre** ciano `#00E5FF`. Nunca inverta, nunca use as duas cores para outra coisa no gameplay. Power-up pulsa em branco. Se um efeito visual atrapalhar a leitura de um projétil, o efeito sai.

---

## 4. Arquitetura

```
Loop:  requestAnimationFrame → acumulador
       ├─ fixed step 1/60s (simulação: input, IA, movimento, colisão, spawn)
       └─ render interpolado (alpha entre estado anterior e atual)
```

Regras duras:

- **Zero alocação dentro do fixed step.** Vetores reutilizados, object pools para projéteis, inimigos, partículas e textos flutuantes. Pré-aloque: 1200 projéteis, 120 inimigos, 2000 partículas.
- **Projéteis em `InstancedMesh`** — um draw call para todos os tiros do player, outro para os inimigos.
- **Colisão:** spatial hash grid (célula de 4 unidades), teste circle-circle para naves/tiros e AABB para partes de chefe. Sem broadphase de biblioteca.
- **Hitbox do player é menor que o sprite** (~35% da largura visual, centralizada). Isso é o que faz o bullet hell ser justo.
- **React nunca re-renderiza durante o jogo.** O HUD lê valores via `useRef` + assinatura no store, atualizando só quando o valor muda de verdade (score, vidas, energia, boss HP). Se você causar re-render por frame, está errado.
- **ECS (miniplex):** componentes `Transform`, `Velocity`, `Sprite`, `Health`, `Collider`, `Weapon`, `AIBehavior`, `Lifetime`, `Team`. Sistemas rodam em ordem fixa e documentada em `src/game/systems/index.ts`.
- **Determinismo:** RNG com seed (`mulberry32`). A mesma seed + mesmos inputs = mesma partida. Necessário para testar e para replays.
- **Fases são dados, não código:** `src/data/levels/level-07.ts` exporta um objeto `LevelDefinition` com biome, waves (tempo, formação, tipo de inimigo, path), densidade de terreno e trilha. Um designer deve conseguir editar uma fase sem tocar em sistema.

---

## 5. Gameplay

### Núcleo

- Scroll vertical automático, velocidade base 18 u/s, subindo 4% por fase.
- Movimento livre nos dois eixos dentro do frame de jogo (não é só esquerda/direita).
- Colidir com a parede do cânion mata. Esse é o DNA de River Raid — mantenha.
- **Energia (o "combustível" de River Raid):** barra que drena continuamente (~1.4%/s). Coletar células de energia no cenário recarrega. Zerar a energia = perde uma vida. Isso força o jogador a avançar e a arriscar.
- 3 vidas, sem continues no modo normal. Ao morrer, volta ao último checkpoint (início da fase, ou meio da fase em chefes).

### Controles

- Teclado: WASD/setas, `espaço` ou botão esquerdo para tiro (hold para auto-fire), `shift` para modo focado (metade da velocidade + hitbox visível), `X` para bomba.
- Gamepad: analógico esquerdo, `A` tiro, `RT` focado, `B` bomba. Suporte via Gamepad API, com deadzone 0.15.
- Mouse: posição direta da nave (com lerp de 0.3), botão esquerdo atira.
- Rebind completo no menu de opções, persistido.

### Armas e power-ups

| Item | Efeito | Duração |
|---|---|---|
| `SPREAD` | 3 → 5 → 7 tiros em leque | Permanente até morrer |
| `LANCE` | Feixe contínuo, alto DPS, alcance curto | 20s |
| `SEEKER` | 2 mísseis teleguiados auxiliares | 25s |
| `AEGIS` | Escudo que absorve 3 hits | Até quebrar |
| `WINGMAN` | Drone orbital que replica o tiro | Até morrer |
| `PULSE` (bomba) | Limpa projéteis da tela + 400 dano em área | Consumível, máx. 3 |

Morrer derruba a arma um nível — não zera. Zerar pune demais e mata a sessão.

### Pontuação

- Base por inimigo + **multiplicador de cadeia**: matar sem levar dano sobe o multiplicador (máx. 8x). Levar dano zera.
- Bônus de fase: energia restante × 50 + tempo × 10 + bônus de "sem dano" (5000).
- Ranking local (top 10) com iniciais de 3 letras. Sim, três letras — é o gênero.

---

## 6. As 15 fases

| # | Ato | Bioma | Novidade introduzida | Duração alvo |
|---|---|---|---|---|
| 1 | I | Cânion orbital | Tutorial implícito: movimento, tiro, energia | 90s |
| 2 | I | Cânion orbital | Torres fixas no terreno | 100s |
| 3 | I | Estação em ruínas | Corredores estreitos, paredes móveis | 110s |
| 4 | I | Estação em ruínas | Enxames + primeiro `SPREAD` | 110s |
| 5 | I | Doca de carga | **CHEFE 1 — Hexapod** | 120s |
| 6 | II | Recife de neon | Inimigos com escudo frontal | 115s |
| 7 | II | Recife de neon | Campos minados | 120s |
| 8 | II | Fenda abissal | Kamikazes + escuridão (visão reduzida) | 125s |
| 9 | II | Fenda abissal | Snipers com laser telegrafado | 130s |
| 10 | II | Cidade submersa | **CHEFE 2 — Basilisk** | 150s |
| 11 | III | Refinaria | Splitters (dividem ao morrer) | 130s |
| 12 | III | Refinaria | Phase runners (teleporte) | 135s |
| 13 | III | Núcleo em fusão | Barragem de artilharia, terreno que desmorona | 140s |
| 14 | III | Núcleo em fusão | Esquadrão de elite: mix de tudo | 150s |
| 15 | III | Coração do Ouroboros | **CHEFE 3 — Ouroboros** | 210s |

Cada fase tem um **pico de tensão aos ~70%** e uma respiração de ~8s antes do fim. Não faça densidade linear.

---

## 7. Bestiário (inimigos comuns)

Cada um precisa de sprite sheet próprio. Comportamento em `src/game/ai/`.

| ID | Nome | Introduz | HP | Comportamento |
|---|---|---|---|---|
| `scrap` | Sucata | F1 | 20 | Desce reto, tiro único a cada 1.8s |
| `interceptor` | Interceptador | F1 | 30 | Entra em V, cruza a tela na diagonal |
| `turret` | Torre Fulcro | F2 | 60 | Fixa no terreno, mira no player, rajada de 3 |
| `swarmer` | Enxame Vespa | F4 | 12 | Senoidal, aparece em grupos de 8–12 |
| `bulwark` | Baluarte | F6 | 90 | Escudo frontal invulnerável — só morre pelos lados/trás |
| `miner` | Semeador | F7 | 45 | Solta minas que explodem em 6 estilhaços |
| `lance` | Lança Kamikaze | F8 | 35 | Telegrafa 0.6s, então dá dash na posição prevista |
| `wraith` | Espectro | F9 | 50 | Laser fino com mira vermelha por 1.2s antes de disparar |
| `splitter` | Cisão | F11 | 70 | Ao morrer, vira 2 `scrap` com movimento errático |
| `runner` | Corredor de Fase | F12 | 40 | Teleporta a cada 2.5s, dispara ao reaparecer |
| `barge` | Barcaça | F13 | 140 | Lenta, barragem de 12 projéteis em arco |

Regra de telegrafia: **todo ataque perigoso tem no mínimo 0.4s de aviso visual** (flash no emissivo, linha de mira, mudança de pose no sprite). Sem exceção. É a diferença entre difícil e injusto.

---

## 8. Os três chefes

Cada chefe é uma entidade composta: um corpo + **partes destrutíveis independentes**, cada uma com HP, hitbox e sprite próprios. Destruir uma parte remove o ataque dela e abre acesso ao núcleo.

Máquina de estados por chefe em `src/game/bosses/<id>.ts`, com fases acionadas por limiar de HP. Toda transição de fase tem 1.2s de invulnerabilidade + animação + som — o jogador precisa entender que algo mudou.

### CHEFE 1 — HEXAPOD (Fase 5) — escala 1.0×

Nave-mãe de transporte. Ocupa **~45% da largura da tela**.

- **Partes:** 2 pods de canhão laterais (HP 400 cada), 1 baia de lançamento central (HP 600), núcleo (HP 900, só exposto após a baia cair).
- **Fase 1 (100–60%):** Pods alternam rajadas de 5 projéteis em leque. Baia libera 4 `swarmer` a cada 8s.
- **Fase 2 (60–25%):** Pods disparam simultaneamente. Varredura horizontal lenta com laser contínuo.
- **Fase 3 (<25%):** Baia destruída expõe núcleo. Espiral de projéteis + investida horizontal.
- **Morte:** 9 explosões encadeadas ao longo do casco, 2.4s, então desintegração dos pedaços com física simples.

### CHEFE 2 — BASILISK (Fase 10) — escala 1.8×

Encouraçado serpentiforme. Ocupa **~78% da largura**. O corpo é segmentado (7 segmentos) e ondula.

- **Partes:** cabeça blindada (invulnerável na fase 1), 4 torres nos segmentos (HP 500 cada), 2 propulsores traseiros (HP 700), núcleo no 4º segmento (HP 1800).
- **Fase 1 (100–70%):** Entra pelo lado, ondulação senoidal. Torres disparam em padrão de perseguição.
- **Fase 2 (70–40%):** Se enrola em círculo no centro da tela, criando uma arena. Muro de projéteis com uma brecha rotativa — o jogador tem que ler a brecha.
- **Fase 3 (40–15%):** Propulsores em chamas, movimento errático e rápido, investidas diagonais.
- **Fase 4 (<15%):** Segmentos se soltam e atacam independentemente. Núcleo exposto, tiro de laser carregado de 2s.
- **Morte:** segmentos explodem em sequência da cauda à cabeça.

### CHEFE 3 — OUROBOROS (Fase 15) — escala 2.6×

Leviatã de fundição. **Maior que a tela** — a câmera recua 40% e ainda assim ele extravasa nas bordas. A entrada leva 12s de scroll só para revelá-lo inteiro, com o nome em display size cruzando a tela.

- **Partes:** 6 canhões de casco (HP 600), 2 braços manipuladores (HP 1200), 4 ventilações de núcleo (HP 800, só abrem em janelas de 6s), núcleo (HP 4000).
- **Fase 1 (100–75%):** Bullet hell em grade — projéteis lentos e densos, navegação de precisão.
- **Fase 2 (75–50%):** Braços varrem a tela fisicamente (dano por contato). Ventilações abrem pela primeira vez.
- **Fase 3 (50–30%):** Invoca ondas de `runner` e `lance`. Terreno ao redor começa a desmoronar, estreitando a arena.
- **Fase 4 (30–10%):** Todos os canhões restantes atiram. Padrão de espiral dupla contrarrotativa.
- **Fase 5 (<10%):** Tela vira vermelho-branco, som filtra para quase silêncio, o Ouroboros carrega um feixe de 8s que ocupa 70% da tela. O jogador tem que sobreviver num corredor de 30% enquanto causa dano. Esse é o clímax do jogo.
- **Morte:** 6s de explosões, whiteout, créditos.

---

## 9. Pipeline de sprite sheets (você constrói isto)

**Os sprites do Ato I e do CHEFE 1 já existem** e vêm junto com este prompt, em `spacerocker-sprites/`: atlas albedo + emissivo, JSON e a contact sheet. Consuma-os como estão — não redesenhe.

O que falta gerar são os atos II e III e os chefes 2 e 3, seguindo exatamente a mesma especificação e o mesmo gerador (`spritegen/`, Python + Pillow, rodando com `python -m spritegen.build --act 2`). Nada de arte desenhada à mão, nada de imagem baixada. O pipeline é determinístico: mesmo código, mesmos bytes.

### Estrutura do gerador

```
spritegen/
  render.py     # paletas, contexto de desenho, chapa/rebite/bocal, bevel, explosão
  enemies.py    # definição paramétrica dos inimigos (4 do Ato I já prontos)
  hexapod.py    # CHEFE 1, por parte destrutível (já pronto)
  anim.py       # curvas de animação, dano de combate, flash de hit, morte
  atlas.py      # shelf packer, padding 2px, extrude 1px, export PNG + JSON
  contact.py    # gera sprites-preview.html
  build.py      # entrypoint: python -m spritegen.build --act N
```

Para os atos II e III, cada inimigo novo é uma função em `enemies.py` mais uma
entrada em `SHIPS`. Para os chefes 2 e 3, um módulo novo no modelo de
`hexapod.py`, com um `PARTS` declarando `anchor`, `hp` e estados por parte.

### Especificação dos atlas

- **Inimigos comuns:** frame `128×128` (pequenos como o `swarmer`, `64×64`), um atlas por ato — as cores emissivas mudam por ato, o casco não.
- **Elites (`barge`, `bulwark`):** frame `192×192`.
- **Chefes:** **um atlas dedicado por chefe**, partes modulares em frames separados (casco não é um sprite único — é casco + cada canhão + cada braço + núcleo, para poder animar e destruir independentemente).
- **Duas camadas por frame:** exporte `*_albedo.png` (RGBA) e `*_emissive.png` (RGB sobre preto). Mesmo layout de atlas, mesmo JSON.
- **Padding 2px + extrude 1px** em cada frame. Sem isso você terá bleeding no atlas.
- **Pivô** declarado no JSON por frame (o pivô do `barge` não é o centro geométrico).
- **Formato do JSON:** TexturePacker *hash*, com campos extras `pivot`, `hitRadius`, `partId`.

### Estados de animação obrigatórios

| Estado | Frames | Loop | Quando |
|---|---|---|---|
| `idle` | 4 | sim | padrão, 8 fps |
| `bank_left` / `bank_right` | 3 cada | não | ao mudar de direção horizontal |
| `charge` | 6 | não | telegrafia de ataque — emissivo sobe em rampa |
| `fire` | 2 | não | frame do disparo |
| `hit` | 1 | não | flash branco, 80ms |
| `death` | 8 | não | 12 fps, com frames 6–8 já em dissipação |

Chefes: cada **parte** tem `idle`, `charge`, `fire`, `damaged` (2 frames, casco rachado) e `destroyed` (6 frames).

### Como desenhar (direção para o kitbash)

Silhueta primeiro — cada inimigo precisa ser reconhecível **em preto, a 60px de altura, em movimento**. Antes de detalhar, renderize a silhueta sólida e verifique que os 11 inimigos são distinguíveis entre si. Se dois forem confundíveis, mude a silhueta, não a cor.

- `scrap`: trapézio assimétrico, sucateado, 1 bocal
- `interceptor`: ponta de flecha fina, asas retrovertidas
- `turret`: base hexagonal + cúpula rotativa
- `swarmer`: losango minúsculo, 2 antenas
- `bulwark`: retângulo pesado com placa côncava na frente (a placa precisa ler como "escudo" instantaneamente)
- `miner`: casco bulboso com berço inferior visível
- `lance`: agulha, quase sem corpo
- `wraith`: Y invertido, com lente central grande
- `splitter`: dois módulos unidos por uma junta visível — o jogador tem que prever a divisão
- `runner`: forma instável com contorno duplicado (fantasma)
- `barge`: chato e largo, treliça exposta

Sombreamento: rampa de 3 tons (sombra, base, highlight) com luz vindo de cima-frente. Nada de gradiente suave — o corte duro entre tons é o que dá a leitura em movimento. Desgaste (rust) só nas bordas das chapas.

Emissivo: **no máximo 15% da área do sprite**. Neon é acento, não cobertura. Concentre em: bocais de propulsão, boca do canhão, uma faixa de identificação, e o ponto fraco quando houver.

### Validação

`python -m spritegen.build` gera `sprites-preview.html`: todos os frames, cada animação em loop na velocidade real, silhuetas em preto ao lado, e o atlas cru. Você **revisa essa página antes de considerar os sprites prontos**. Se uma animação estiver tremendo, o pivô está errado.

### Fallback autorizado

Se e somente se o resultado procedural ficar abaixo da barra de qualidade, é permitido gerar bases por modelo de imagem, **desde que** passem por um passe de normalização automatizado: recorte de fundo, quantização para a paleta do ato, alinhamento de pivô, extração da camada emissiva e empacotamento no mesmo atlas. Nunca misture os dois métodos dentro de um mesmo ato — a inconsistência de estilo aparece na hora.

---

## 10. Áudio — trilha eletropunk

### Música (Tone.js, sintetizada em runtime)

Três camadas que entram e saem por intensidade, sempre em sync (nunca reinicie o transporte no meio da fase):

1. **Base** — kick 4/4, sub-bass, sempre presente
2. **Groove** — baixo acid (MonoSynth + filtro lowpass com envelope, ressonância alta), hats, entra em combate
3. **Lead** — arpejo/pad agressivo, entra em chefe e em multiplicador ≥ 4x

| Ato | BPM | Tônica | Caráter |
|---|---|---|---|
| I | 132 | Am | acid house sujo, espaço entre os elementos |
| II | 144 | Cm | breakbeat quebrado, reverb longo, dub |
| III | 156 | Fm | industrial, distorção no bus, kick saturado |
| Chefes | +6 BPM sobre o ato | relativa menor | camada lead obrigatória + risers entre fases |

Mix: bus master com compressor (4:1, ratio suave) + limiter em -1 dBFS. Sidechain do bus de música pelo kick. Durante entrada de chefe, filtre a música para lowpass 400Hz por 1.5s e abra — é o truque mais barato e mais eficaz de tensão.

### Suporte a stems externos

Implemente `public/audio/manifest.json`:

```json
{
  "act1": { "base": "act1_base.ogg", "groove": "act1_groove.ogg", "lead": "act1_lead.ogg", "bpm": 132 },
  "act2": null
}
```

Se a entrada existir e os arquivos estiverem presentes, o `MusicDirector` toca os stems (com crossfade entre camadas, alinhado ao BPM declarado). Se for `null` ou ausente, cai na síntese via Tone.js. **O jogo tem que funcionar 100% sem nenhum arquivo de áudio no repo** — os stems são substituição opcional, não dependência.

### SFX (Web Audio cru, não Tone)

Sintetizados em runtime, pool de vozes com limite de 24 simultâneas e roubo de voz por prioridade:

`player_shot` (blip curto com pitch envelope) · `enemy_shot` (mais grave, timbre distinto — o jogador precisa ouvir a diferença sem olhar) · `hit_metal` · `explode_small/medium/huge` · `pickup` (acorde ascendente) · `shield_break` · `energy_low` (alarme pulsante a partir de 20%) · `boss_part_destroyed` · `boss_phase_shift` (riser + impacto)

Autoplay: contexto de áudio destravado no primeiro gesto do usuário na tela de título. Sliders separados para música e SFX, persistidos. `energy_low` nunca é abafado por outros SFX.

---

## 11. Telas e HUD

### Fluxo

`Boot → Título → [Continuar | Nova partida | Opções | Ranking] → Seleção de ato (desbloqueado) → Fase → Resultado → próxima fase`

### Tela de título

O herói da tela é o **logo em movimento**: "SPACEROCKER" em Archivo Black condensado, com o Ouroboros passando lentamente ao fundo, desfocado, quase invisível — um teaser do que o jogador vai enfrentar. Uma única sequência orquestrada na entrada, não animações espalhadas. Menu em lista vertical alinhada à esquerda, sem caixas, sem cards.

### HUD (durante o jogo)

- **Canto superior esquerdo:** score (tabular) + multiplicador quando > 1x
- **Canto superior direito:** fase atual em display size, discreto
- **Base esquerda:** vidas como ícones de nave (não números)
- **Base inteira:** barra de energia horizontal fina, que muda de ciano para magenta abaixo de 30% e pulsa abaixo de 20%
- **Chefe:** barra de HP no topo, segmentada pelo número de fases do chefe, com o nome do chefe à esquerda em display
- **Bombas:** 3 pips ao lado das vidas

O HUD ocupa as bordas e deixa o centro absolutamente livre. Nenhum elemento de HUD entra na área jogável.

### Copy

Tom direto, sem ironia, sem excesso. "Continuar", não "Retomar sua jornada". Tela de game over diz o que aconteceu e o que fazer: "Nave perdida. Fase 8. — Tentar de novo / Voltar ao título." Estado vazio no ranking é convite: "Nenhuma pontuação ainda. A primeira é sua."

---

## 12. Performance e acessibilidade

**Orçamento (obrigatório, medido):** 60 fps estáveis com 400 projéteis + 40 inimigos + chefe ativo, em notebook com gráficos integrados. Draw calls < 60. Frame time do fixed step < 4ms. Overlay de debug (`F3`) mostrando fps, draw calls, entidades vivas e tamanho dos pools.

Se não bater o orçamento: reduza partículas antes de reduzir projéteis, e resolução do render target antes de qualidade de simulação. Nunca corte frames de animação dos inimigos para ganhar performance.

**Acessibilidade:**
- `prefers-reduced-motion`: desliga screen shake, chromatic aberration e scanlines; reduz partículas em 70%
- Modo daltônico: alternativa de forma para projéteis (inimigo vira losango, player vira círculo) além da cor
- Foco de teclado visível em todos os menus, navegação completa sem mouse
- Toggle de screen shake independente
- Modo prático: energia não drena, 5 vidas — separado do ranking

---

## 13. Estrutura de arquivos

```
src/
  main.tsx
  App.tsx                    # roteador de telas
  theme/                     # palette, type scale, tokens
  ui/                        # React: título, menus, HUD, resultado, ranking
  game/
    Engine.tsx               # canvas R3F, loop, montagem dos sistemas
    world/                   # terreno, scroll, biomas, skybox, iluminação
    systems/                 # input, ai, movement, collision, spawn, damage, fx
    entities/                # factories de player, inimigo, projétil, pickup
    ai/                      # um arquivo por comportamento do bestiário
    bosses/                  # hexapod.ts, basilisk.ts, ouroboros.ts + FSM comum
    render/                  # billboards, instanced bullets, pós-processamento
    audio/                   # MusicDirector, SfxEngine, manifest loader
    core/                    # pool, spatial hash, rng, fixed-step, event bus
  data/
    levels/level-01..15.ts
    enemies.ts               # stats
    weapons.ts
public/
  sprites/                   # gerado — commitado
  audio/manifest.json
scripts/                     # gerador de sprites
tests/
```

---

## 14. Ordem de execução

Entregue em fases. **Ao fim de cada fase, pare e reporte** o que está jogável, o que falta e qualquer decisão que você tomou fora do que este doc especifica.

| Fase | Entregável | Critério de "pronto" |
|---|---|---|
| **F0** | Setup, Vite + R3F + TS strict, tela preta com câmera e terreno scrollando | 60 fps, sem warnings |
| **F1** | Player: movimento, tiro, colisão com parede, energia, morte | Dá para "jogar" sem inimigos e é gostoso de mover |
| **F2** | Integrar o atlas do Ato I: billboards, camada emissiva, troca de frame por estado | Os 4 inimigos animam na cena |
| **F3** | Combate: spawn, IA dos 4 primeiros, dano, explosões, SFX básico | Fase 1 completável |
| **F4** | Fases 1–4, sistema de waves por dados, power-ups, HUD | 4 fases jogáveis em sequência |
| **F5** | Chefe 1 completo: montar as 5 partes pelos `anchor`, FSM de 3 fases, destruição por parte | Ato I fechado |
| **F6** | Bestiário restante (gerar atlas dos atos II e III) + fases 6–9 e 11–14 | Todas as fases não-chefe prontas |
| **F7** | Chefes 2 e 3 | Jogo completável do início ao fim |
| **F8** | MusicDirector completo, telas, ranking, opções, acessibilidade, polimento | Todos os critérios da seção 15 |

---

## 15. Critérios de aceite

- [ ] `npm install && npm run dev` funciona em máquina limpa, sem asset externo
- [ ] `python -m spritegen.build` reproduz todos os atlas bit a bit idênticos (determinístico)
- [ ] As 15 fases são jogáveis em sequência, com progressão salva
- [ ] Os 3 chefes escalam visivelmente: 1.0× / 1.8× / 2.6×, e o terceiro extravasa a tela
- [ ] Todo ataque perigoso tem ≥ 0.4s de telegrafia visual
- [ ] Projétil inimigo é laranja, do player é ciano, em 100% do jogo
- [ ] 60 fps no cenário de carga da seção 12, verificado no overlay F3
- [ ] Zero re-render do React durante o gameplay (verificado no React DevTools profiler)
- [ ] O jogo roda e soa bem com `public/audio/` vazio
- [ ] `prefers-reduced-motion` respeitado
- [ ] Navegação completa por teclado e por gamepad
- [ ] Testes: colisão, RNG determinístico, transições de fase dos 3 chefes
- [ ] Nenhum `any` no código, Biome sem erros

---

## 16. Regras para você, agente

1. Trabalhe em fases, na ordem da seção 14. Não pule para o chefe 3 antes do chefe 1 estar redondo.
2. Antes de escrever código de uma fase, escreva em 5–10 linhas o que vai fazer. Depois execute.
3. Faça commit por fase, mensagem no imperativo.
4. Quando este documento for ambíguo, **escolha e documente** em `DECISIONS.md` — não pare para perguntar em detalhe menor. Pergunte só se a decisão for irreversível ou custar mais de uma fase para desfazer.
5. Teste jogando. Se você não conseguir descrever como a fase 3 *se sente* em uma frase, você não a testou.
6. Não adicione features que não estão aqui. Se tiver uma ideia boa, anote em `IDEAS.md` e siga.
