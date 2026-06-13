# pf2e-netherworld — project rules

A Foundry VTT **Pathfinder 2e** module template. Hybrid: compendium content (`packs/`)
plus a scripted esmodule (`src/`) built with TypeScript + Svelte 5 + Vite
(`src/index.ts` → `dist/pf2e-netherworld.{js,css}`). `module.json` is the manifest.

**The Foundry/PF2e API, compendium packs, Svelte-in-ApplicationV2, the Vite build, and
multi-client sync live in the user-level `foundry-pf2e` skill** — consult it for any of
those (it loads on demand, so this file stays lean). Here: only the hard rules and
what's specific to this repo.

New module from this template: `npm run init -- <new-id> [--title "..."]` rewrites the
id/title everywhere and deletes the init script. See README.

Code style: global `~/.claude/CLAUDE.md` — comment only the non-obvious *why*.

## Hard rules (override defaults)

- **v14 only, no v1 APIs.** Everything under `foundry.*`. Never `foundry.appv1`, bare
  `Application` / `FormApplication` / `Dialog`, or bare `mergeObject` / `duplicate` /
  `getProperty`. Windows are ApplicationV2; dialogs DialogV2; structured data is
  `foundry.abstract.DataModel` + `defineSchema()`. A v1-only class → find the V2 form first.
- **TypeScript everywhere, including tooling.** `vite.config.ts`, `svelte.config.ts`,
  and `scripts/*.ts` run via `node` (≥22.6 strips types — no `tsx`/`ts-node`). No
  `.mjs`/`.js` tooling. `package.json` pins `engines.node`.
- **UI is Svelte 5 mounted in an ApplicationV2 shell** (`mount`/`unmount`, runes) — not
  Svelte 4 forms (`new Component()`, `$destroy`, `export let`). See the skill's
  `svelte-in-applicationv2.md`.

## Build & dev

- `npm run build` → `dist/` (gitignored; build before enabling a world, and after edits).
- `npm run dev` — HMR dev server (`:30001`, proxies Foundry). `npm run watch` — `vite build --watch`.
  `npm run check` — `svelte-check` + `tsc`. `npm run setup` — resolve dev paths
  (detect/clone/prompt), then scaffold the Foundry module dir + pull references in.
- **Two ways the module lands in Foundry** (both put it at `modules/<id>/`):
  - `npm run setup` (dev) — a **real** module dir whose entries (`module.json`, `dist`, `lang`,
    `packs`, `assets`) symlink back to the repo, so edits + Vite HMR are live. NOT a
    whole-repo symlink (that leaked `node_modules`/`.git` and shipped no assets).
  - `npm run deploy` — `vite build`, then **copy** a clean, link-free, self-contained dir
    (same shape as the release zip). Use to test the shipped artifact or install without the repo.
- Art is **content, not source**: it lives in a top-level `assets/` (beside `lang/`, `packs/` —
  not under `src/`, which is for built code) and is referenced as `modules/<id>/assets/…`. The
  esmodule never imports it (it's author-pickable scene/tile art). That path must resolve in dev
  (symlinked), `deploy` (copied), and the release zip — keep all three in sync.
- Active install: `FoundryVTT` (a fresh v14 desktop install may use `FoundryVTT-v14`).
  References: `_pf2e-source`, `_foundry-data`, `_foundry-modules`.

## This repo's specifics

- Module id `pf2e-netherworld`; flags, settings, the socket channel (`module.<id>`),
  and pack names (`<id>.<pack>`) all key off it. Use `const MODULE_ID`.
- Public API: `game.modules.get(MODULE_ID).api = {...}` (cast — `api` isn't typed on `Module`).
- Strings: `lang/en.json` under `pf2e-netherworld.*`; `game.i18n.localize/format`. No hard-coded strings.
- **Content ships as one Adventure pack** (`packs/netherworld`, type `Adventure`), not loose
  per-type packs. `npm run build:adventure` assembles `packs/_source/{scenes,journals,macros,
  bestiary,hazards,items}` into a single Adventure document and compiles it. The importer creates
  world docs with **keepId**, so every `_id` (the Dark Mirror scene, the intro journal, every
  actor) is preserved on every install — that's what keeps `DARK_MIRROR_SCENE_ID` and the `@UUID`
  cross-links valid. Loose import mints new ids and silently breaks them (the original fresh-install
  bug). On `ready`, the GM is prompted to import (gated by `core.adventureImports[uuid]`).
  Cross-references to imported docs are **world** UUIDs (`@UUID[Actor.<id>]` / `Item.<id>`).
- **`effects` stays a separate Item pack** — a runtime library granted in place by rule elements
  (the Queen's Rime aura's `Compendium.pf2e-netherworld.effects.Item.…`), never imported. Edit
  `packs/_source/effects` then `npm run pack -- effects --in packs/_source/effects --out packs`.
- compatibility `minimum "14"`, `verified "14"`; author `Mark Pearce`, org `rune-goblin`, MIT license.
- Release: tag `vX.Y.Z` → `release.yml` stamps the version, type-checks, builds, publishes `module.json` + `pf2e-netherworld.zip` (zip ships `dist lang packs assets` — must include the art).

## Gotchas

- Close Foundry before any `fvtt package` op (LevelDB lock). Pack workflow: skill's `packs-cli.md`.
- `dist/` is gitignored — served via the dev scaffold's `dist` symlink after build; CI builds it for releases.
- Vite does **not** type-check — run `npm run check` (the release workflow does too).
- `npm run dev` = Vite HMR dev server on `:30001` reverse-proxying Foundry (`:30000`). It proxies an *already-running* Foundry — start Foundry and **launch a world with the module enabled** first, or there's no esmodule to hot-swap. Then browse `:30001/game` (not `:30000`). `.svelte` edits hot-swap; editing `src/index.ts` full-reloads. `npm run watch` = old `vite build --watch` (browse `:30000`, manual F5; Foundry hot-reloads `.hbs`/`.css`/`.json` but not esmodules).
- Persist state in document flags, not raw socket; raw socket for transient signals only (skill's `multi-client-sync.md`).
