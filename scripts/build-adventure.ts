// Assemble the per-type sources under packs/_source/* into a single Adventure document, then compile
// it to packs/netherworld. The importer creates world docs with keepId, so every _id survives a fresh
// import and the hardcoded scene ids + @UUID cross-links stay valid (loose per-pack import minted new
// ids and broke them). `effects` is excluded: a runtime library granted in place via compendium UUID,
// never imported.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { packCompendium } from './pack-leveldb.ts';

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

// …except this one, which is ALSO imported into the world with the Sacrament gift. The weapon links it by
// world @UUID[Item.…], so the crit rider (a core-PF2e rule element) keeps working even if the module is
// later removed. It still ships in the effects compendium too (the GM journal and offer dialog link it
// there). Aura-granted effects like the Queen's Rime stay compendium-only.
const IMPORTED_EFFECTS = new Set(['nwImpalingChain1']);

// Each unpacked doc's `_key` (`!collection!id`) names the Adventure field it belongs in. Routing by
// `_key` rather than directory keeps the bestiary's folder docs out of `actors`.
type Doc = { _key?: string } & Record<string, unknown>;

// Unfiled docs go under their type's root "NetherWorld" folder, so the adventure imports into tidy
// per-sidebar folders instead of dumping loose docs into each tab.
const FOLDER_TYPE: Record<string, string> = {
  actors: 'Actor', scenes: 'Scene', journal: 'JournalEntry', macros: 'Macro', items: 'Item',
};

export function buildAdventure(): void {
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

  // The allowlisted effects get a world copy alongside their compendium one, so the gift survives removal.
  for (const file of readdirSync(join(SRC, 'effects'))) {
    if (!file.endsWith('.json')) continue;
    const { _key, ...doc } = JSON.parse(readFileSync(join(SRC, 'effects', file), 'utf8')) as Doc;
    if (_key && IMPORTED_EFFECTS.has(doc._id as string)) {
      (adventure.items as Doc[]).push(doc);
      counts.items = (counts.items ?? 0) + 1;
    }
  }

  // Explicit assignments (the Shadow Reflections subfolder, actors already in NetherWorld) are left
  // as-is. Everything in this adventure is meant to be foldered, so unfiled docs get the root folder.
  const rootFolderByType: Record<string, string> = {};
  for (const f of adventure.folders as Doc[]) {
    if (f.folder == null && f.name === 'NetherWorld') rootFolderByType[f.type as string] = f._id as string;
  }
  for (const [collection, type] of Object.entries(FOLDER_TYPE)) {
    const root = rootFolderByType[type];
    const docs = adventure[collection] as Doc[] | undefined;
    if (!root || !Array.isArray(docs)) continue;
    for (const doc of docs) {
      if (doc.folder == null) doc.folder = root;
    }
  }

  // Scenes ship with their encounter tokens placed. Keep only tokens whose actor travels in this
  // adventure; drop the rest (the party placeholder, NPCs whose actor isn't bundled), which would
  // otherwise import as broken, actorless tokens.
  const actorIds = new Set((adventure.actors as Doc[]).map((a) => a._id as string));
  for (const scene of adventure.scenes as Doc[]) {
    const tokens = (scene.tokens as Doc[] | undefined) ?? [];
    const kept = tokens.filter((t) => actorIds.has(t.actorId as string));
    // A lone token links to its actor (HP on the world actor); mooks — multiple tokens of one actor,
    // e.g. the two Sacristans — stay unlinked so each tracks its own HP.
    const perActor: Record<string, number> = {};
    for (const t of kept) perActor[t.actorId as string] = (perActor[t.actorId as string] ?? 0) + 1;
    for (const t of kept) {
      if (perActor[t.actorId as string] === 1) {
        t.actorLink = true;
        delete t.delta; // the unlinked snapshot is dead weight once it derives from the world actor
      } else {
        t.actorLink = false;
      }
    }
    scene.tokens = kept;
    if (tokens.length !== kept.length) {
      console.log(`  ${String(scene.name)}: kept ${kept.length}, dropped ${tokens.length - kept.length} unbundled token(s)`);
    }
  }

  const outDir = join(SRC, PACK);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'through-the-glass.json'), JSON.stringify(adventure, null, 2) + '\n');
  console.log('assembled adventure:', Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', '));

  if (packCompendium(PACK, outDir, join(ROOT, 'packs'))) {
    console.log(`✓ packs/${PACK} built`);
  } else {
    console.warn(`⚠ adventure "${PACK}" not rebuilt (is Foundry holding it open? LevelDB lock) — keeping the existing build.`);
  }
}

// Run standalone: `node scripts/build-adventure.ts`.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildAdventure();
}
