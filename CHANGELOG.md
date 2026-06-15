# Changelog

All notable changes to **PF2e Netherworld** are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project uses
[Semantic Versioning](https://semver.org/). Install/update from the manifest:
`https://github.com/rune-goblin/pf2e-netherworld/releases/latest/download/module.json`.

## [Unreleased]

### Added
- **Reflection Reflected Actions panel** — a floating, GM-only panel that auto-shows
  during combat and lists every Reflection fighting in the encounter. Expand one to see
  the actions its original took on the previous round (the Mirror Echo window), then
  click each to replay it from the Reflection's own stat block: spells recast at the
  Reflection's reduced rank, weapon **Strikes** rolled with the matching weapon at the
  same multiple-attack penalty. Performed actions are checked off; ↻ re-reads the round.
  Turns the manual *Mirror Cast* macro into one-click turn-running and extends it to
  Strikes.

## [0.4.0] — 2026-06-14

### Added
- **Make Shadow macro** (`Nether World: Make Shadow`) — spawn a hostile glass
  Reflection of any selected player character: clones them two levels weaker, adds
  the shadow trait and a glass tint, embeds the Mirror Echo / Shattered Echo /
  Glass Body / Shatter actions, and auto-links the double to its original.
- **Reflection toolbar** — a floating, draggable toolbar (bound to the Hall of
  Reflections scene) for running the Shattered Gallery's reflection tools.
- **The Threshold Glass** hazard (Hazard 14).
- **Sacristan** added to the bestiary (the Flesh Shaper's attendants).
- Generic token and portrait art for the bundled actors.

### Changed
- **Content now ships as a single Adventure pack** (`packs/netherworld`, type
  `Adventure`) instead of loose per-type compendiums. One-click import creates the
  world documents with **keepId**, so every `_id` — the Dark Mirror scene, the
  journal, every actor — is preserved on every install, keeping `DARK_MIRROR_SCENE_ID`
  and all `@UUID` cross-links valid. The GM is prompted to import on `ready`.
- **`effects` stays a separate Item pack** — a runtime library granted in place by
  rule elements (the Queen's Rime aura), never imported.
- Cross-references now point at the imported **world** documents (`@UUID[Actor.…]`,
  `@UUID[Item.…]`) rather than compendium UUIDs.
- New build pipeline: `npm run build:adventure` assembles the Adventure from
  `packs/_source/{scenes,journals,macros,bestiary,hazards,items}`; `npm run build:packs`
  compiles the Adventure and effects. Compiled LevelDB packs are now gitignored build
  output (like `dist/`); only `packs/_source` JSON is tracked.
- Raised the PF2e system compatibility minimum to **8.2.0**.

## [0.3.0] — 2026-06-14

### Added
- **Scenes** — Hall of Reflections, The Dark Mirror, and Threshold of Pain, packaged
  with their map backgrounds wired to `background.src` (the maps had been tile-only).

## [0.2.0] — 2026-06-13

### Added
- **Mirror Echo macros** — `Nether World: Link Mirror` (bind a Reflection to the PC
  it mirrors) and `Nether World: Mirror Cast` (replay the linked PC's spell casts from
  the Reflection at the Reflection's spell DC, with an initiative-correct window and a
  rank-6 clamp). Documented in Encounter 1 of the journal.

## [0.1.0] — 2026-06-13

### Added
- First release of **Through the Glass**, a Shadow Plane encounter arc for four
  14th-level PCs: the bestiary (Veyrin, the Shaper of Ecstasy, the Shadow Reflections),
  the three Threshold gifts as items (The Sacrament of Pain, Shroud of the Nameless,
  Shadow's Clarity), the supporting effects (Queen's Rime, Wound Reopens, Impaling Chain,
  Rime's Grip, Warded Against the Rime), the Glass to the Ice Palace hazard, the journal,
  and the mirror toolbar.

[0.4.0]: https://github.com/rune-goblin/pf2e-netherworld/releases/tag/v0.4.0
[0.3.0]: https://github.com/rune-goblin/pf2e-netherworld/releases/tag/v0.3.0
[0.2.0]: https://github.com/rune-goblin/pf2e-netherworld/releases/tag/v0.2.0
[0.1.0]: https://github.com/rune-goblin/pf2e-netherworld/releases/tag/v0.1.0
