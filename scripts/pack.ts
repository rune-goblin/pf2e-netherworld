// Build the compendium packs module.json registers, from their JSON sources. Run by
// `npm run build:packs`, so the shipped LevelDB always matches the tracked sources — built packs
// are gitignored, like dist/.
//
// What ships is driven by module.json `packs`, not the source layout:
//   - an `Adventure` pack is *derived* from the per-type sources (scripts/build-adventure.ts)
//   - every other pack is compiled from packs/_source/<name>
// Here: the `netherworld` Adventure plus the `effects` runtime library (its own Item compendium,
// never imported — granted in place by rule elements via compendium UUID).
//
// If Foundry holds a pack open (LevelDB lock), the existing build is kept and we warn rather than
// fail; close Foundry to refresh it. Manual single-pack rebuild:
//   npm run pack -- <name> --in packs/_source/<name> --out packs
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAdventure } from './build-adventure.ts';
import { packCompendium } from './pack-leveldb.ts';

const ROOT = process.cwd();
const SOURCE = join(ROOT, 'packs', '_source');
if (!existsSync(SOURCE)) process.exit(0);

interface PackEntry { name: string; type?: string }
const manifest = JSON.parse(readFileSync(join(ROOT, 'module.json'), 'utf8')) as { packs?: PackEntry[] };
const packs = manifest.packs ?? [];

for (const pack of packs) {
  if (pack.type === 'Adventure') {
    buildAdventure();
    continue;
  }
  const dir = join(SOURCE, pack.name);
  if (!existsSync(dir)) {
    console.warn(`⚠ pack "${pack.name}" registered in module.json but no source at packs/_source/${pack.name} — skipping.`);
    continue;
  }
  if (!packCompendium(pack.name, dir, join(ROOT, 'packs'))) {
    console.warn(`⚠ pack "${pack.name}" not rebuilt (is Foundry holding it open? LevelDB lock) — keeping the existing build.`);
  }
}
