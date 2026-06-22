// Build the compendium packs module.json registers, from their JSON sources (run by `npm run
// build:packs`). Built packs are gitignored, like dist/. What ships is driven by module.json `packs`:
// an `Adventure` pack is derived from the per-type sources (build-adventure.ts); every other is
// compiled from packs/_source/<name>. A LevelDB lock keeps the existing build and warns. Single pack:
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
