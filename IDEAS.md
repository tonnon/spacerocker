# IDEAS

Things that came up while building and were **not** implemented, because they are
not in `spacerocker-prompt.md`. Noted here per rule 6 of §16, so they do not
become scope by accident.

---

## Gameplay

- **Replay from seed + inputs.** The simulation is already deterministic and
  reads input only from one snapshot per step. Recording the input track would
  give replays and scoreboard ghosts almost for free.
- **A branching route in Act II.** The Reef and the Rift are distinct enough as
  biomes to become a route choice rather than a fixed sequence.
- **A per-level "no-miss" counter.** The no-damage bonus already exists; showing
  the live chain during the level would add a secondary goal without touching
  balance.
- **Bombs costing energy** instead of being a consumable, to tie the fuel clock
  to the defensive decision. It would shift balance considerably — which is why
  it stayed out.

## Art and pipeline

- **Silhouette mode in the contact sheet as a build gate.** The generator already
  knows how to render silhouettes; the build could fail automatically if two
  enemies look too alike (comparing perceptual hashes of the black shapes at
  60px). It would have caught the `miner`/`splitter`/`runner` blur without human
  review.
- **Per-act hull variants.** Today only the emissive changes between acts. A
  second wear layer per act (more rust in III) would give visual progression
  without redrawing silhouettes.
- **Directional death frames.** The current explosion is radial; inheriting the
  movement vector would make deaths feel more physical.

## Engine

- **An atlas shared between acts.** `act2` and `act3` re-render the same hulls
  with different neon, which duplicates pixels. One hull atlas plus one emissive
  atlas per act would cut the payload almost in half.
- **Instancing the terrain with `InstancedMesh`** instead of rewriting the vertex
  buffer every frame. The current cost is low, but it scales badly if the canyon
  gains detail.
- **An adaptive particle budget.** §12 says to cut particles before projectiles;
  today that is a fixed multiplier per setting, not a reaction to measured frame
  time.

## Accessibility

- **Gamepad remapping.** The keyboard is remappable; the gamepad binding is
  fixed.
- **A high-contrast mode** that flattens the terrain to near-black and leaves
  only projectiles and enemies coloured.
