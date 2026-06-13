// Assemble the per-type pack sources under packs/_source/* into a single Adventure document,
// then compile it to packs/netherworld. The Adventure importer creates world documents with
// keepId, so every _id (scene, journal, actor, …) is preserved on every install — that is what
// keeps the hardcoded Dark Mirror scene id and all the @UUID cross-links valid after a fresh
// import. Loose per-pack import (what we shipped before) mints new ids and breaks them.
//
// `effects` is deliberately excluded: those are a runtime library granted in place by rule
// elements (e.g. the Queen's Rime aura) via compendium UUID, never imported into the world.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'packs/_source');

const PACK = 'netherworld';
const ADVENTURE = {
  _id: 'nwNetherworldAdv',
  name: 'Through the Glass',
  img: 'modules/pf2e-netherworld/assets/the-dark-mirror/icy-hall-start.webp',
  caption: 'The Pursuit of Lord Veyrin — a Shadow Plane encounter arc for four 14th-level characters.',
  description:
    '<p>The strigoi Lord Veyrin flees into the Shadow Plane, and the party follows through a tall '
    + 'looking-glass into a drained, lightless echo of the world. This adventure imports its scenes, '
    + 'journals, bestiary, hazards, items, and macros — with their ids preserved so every link resolves.</p>',
};

// Every source dir except `effects` (a runtime library, shipped as its own compendium).
const SOURCE_DIRS = ['scenes', 'journals', 'macros', 'bestiary', 'hazards', 'items'];

// Each unpacked doc carries a `_key` of `!collection!id`; the collection name is also the
// Adventure field it belongs in (scenes, journal, actors, items, macros, folders, …). Routing
// by `_key` rather than by directory keeps the bestiary's folder docs out of `actors`.
type Doc = { _key?: string } & Record<string, unknown>;
const adventure: Record<string, unknown> = {
  ...ADVENTURE,
  folders: [], actors: [], items: [], journal: [], scenes: [], macros: [],
  sort: 0,
  flags: {},
  _key: `!adventures!${ADVENTURE._id}`,
};

const counts: Record<string, number> = {};
for (const dir of SOURCE_DIRS) {
  const abs = join(SRC, dir);
  for (const file of readdirSync(abs)) {
    if (!file.endsWith('.json')) continue;
    const { _key, ...doc } = JSON.parse(readFileSync(join(abs, file), 'utf8')) as Doc;
    const collection = _key?.split('!')[1];
    if (!collection || !Array.isArray(adventure[collection])) {
      throw new Error(`${dir}/${file}: unroutable _key ${JSON.stringify(_key)}`);
    }
    (adventure[collection] as Doc[]).push(doc);
    counts[collection] = (counts[collection] ?? 0) + 1;
  }
}

// Scenes ship with their encounter tokens placed. Keep only tokens whose actor travels in this
// adventure and make those linked (so each token derives from the imported actor); drop the rest —
// the world party placeholder and any NPC whose actor isn't bundled would otherwise import as a
// broken, actorless token on a fresh world.
const actorIds = new Set((adventure.actors as Doc[]).map((a) => a._id as string));
for (const scene of adventure.scenes as Doc[]) {
  const tokens = (scene.tokens as Doc[] | undefined) ?? [];
  const kept = tokens.filter((t) => actorIds.has(t.actorId as string));
  for (const t of kept) {
    t.actorLink = true;
    delete t.delta; // a linked token derives from the world actor; the unlinked snapshot is dead weight
  }
  scene.tokens = kept;
  if (tokens.length !== kept.length) {
    console.log(`  ${String(scene.name)}: linked ${kept.length}, dropped ${tokens.length - kept.length} unbundled token(s)`);
  }
}

const outDir = join(SRC, PACK);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'through-the-glass.json'), JSON.stringify(adventure, null, 2) + '\n');
console.log('assembled adventure:', Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', '));

// Compile to LevelDB. Foundry must be closed (it holds the pack LOCK).
console.log('packing…');
execFileSync('npx', ['fvtt', 'package', 'pack', PACK, '--in', outDir, '--out', join(ROOT, 'packs')], {
  stdio: 'inherit',
  cwd: ROOT,
});
console.log(`\n✓ packs/${PACK} built`);
