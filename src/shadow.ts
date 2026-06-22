import { MODULE_ID, NETHERWORLD_ACTOR_FOLDER_ID, SHADOW_REFLECTIONS_FOLDER_ID } from './constants';

const SHADOW_TINT = '#694d93';
const SHADOW_TOKEN_ALPHA = 0.85;
const LEVEL_REDUCTION = 2;
const SHADOW_TRAIT = 'shadow';
const SHADOW_FOLDER = 'Shadow Reflections';

// Glass-reflection rules embedded on every shadow, so the one-round echo and shatter-on-death travel
// with the clone. The DC/damage in Shatter are GM-read flavor, not automated rule elements.
const SHADOW_ACTION_TEXT = [
  {
    name: 'Mirror Echo',
    actionType: 'passive',
    category: 'interaction',
    value:
      '<p>The reflection acts on a one-round lag, regardless of initiative order.</p>\n'
      + '<p><strong>Round 1:</strong> it has nothing to copy yet, so it simply Strides toward the '
      + 'nearest foe and Strikes (or claws its way free of the glass).</p>\n'
      + '<p><strong>Round 2+:</strong> on its turn it repeats, as best it can, every action its '
      + 'original took on the <em>previous</em> round, retargeting effects to the nearest valid '
      + "creature. If it can't replicate an action — a consumable it doesn't have, a target that's "
      + "gone — it instead makes a basic Strike or the nearest equivalent (GM's call).</p>\n"
      + '<p><strong>Feed the Echo:</strong> if the original wastes a round (Strides in a circle, '
      + 'Recall Knowledge), the reflection wastes its next turn faithfully copying it. Reward that '
      + 'cleverness.</p>',
  },
  {
    name: 'Shattered Echo',
    actionType: 'passive',
    category: 'defensive',
    value:
      '<p>If the original does something the reflection genuinely cannot follow — breaking line of '
      + 'sight to the reflection, or shattering the pane it emerged from — the reflection has nothing '
      + 'to echo and is <strong>off-guard until the end of its next turn</strong>.</p>',
  },
  {
    name: 'Glass Body',
    actionType: 'passive',
    category: 'defensive',
    value:
      '<p>The reflection has no dying condition and makes no death saves. The instant it reaches 0 '
      + 'Hit Points it is destroyed, using <strong>Shatter</strong>.</p>',
  },
  {
    name: 'Shatter',
    actionType: 'free',
    category: 'offensive',
    value:
      '<p><strong>Trigger</strong> The reflection is reduced to 0 Hit Points.</p>\n'
      + '<p>The reflection bursts into razor shards. Each creature in a 10-foot emanation takes '
      + '<strong>4d6 slashing damage</strong> (<strong>basic Reflex DC 30</strong>).</p>',
  },
] as const;

const SHADOW_ACTIONS = SHADOW_ACTION_TEXT.map((a) => ({
  name: a.name,
  type: 'action',
  img: 'systems/pf2e/icons/actions/Passive.webp',
  system: {
    description: { value: a.value },
    actionType: { value: a.actionType },
    category: a.category,
    actions: { value: null },
    traits: { value: [] },
  },
}));

// A character's prepareBaseData resets system.traits.value to [], wiping any trait set on the clone's
// source — so the shadow trait is re-granted in *derived* prep via this effect's ActiveEffectLike.
// The trait is what makes the Hall's Vortex of Souls (a region behavior) skip the reflection.
const SHADOW_TRAIT_EFFECT = {
  name: 'Glass Reflection',
  type: 'effect',
  img: 'icons/magic/control/silhouette-hold-beam-blue.webp',
  system: {
    description: {
      value:
        '<p>This figure is a glass reflection: it bears the <strong>shadow</strong> trait, so the '
        + 'Vortex of Souls in the Hall of Reflections passes it by.</p>',
    },
    rules: [{ key: 'ActiveEffectLike', mode: 'add', path: 'system.traits.value', value: SHADOW_TRAIT }],
    duration: { expiry: null, sustained: false, unit: 'unlimited', value: -1 },
    tokenIcon: { show: true },
    traits: { rarity: 'unique', value: [] },
    slug: 'glass-reflection',
  },
};

/** First grid cell free of a token, spiralling out from the GM's current view centre, so a batch
 *  of reflections fills neighbouring squares instead of stacking on one. */
function freeDropPoint(scene: Scene): { x: number; y: number } {
  const grid = scene.grid;
  const dims = scene.dimensions;
  const centre = canvas.scene?.id === scene.id
    ? { x: canvas.stage.pivot.x, y: canvas.stage.pivot.y }
    : { x: dims.sceneX + dims.sceneWidth / 2, y: dims.sceneY + dims.sceneHeight / 2 };
  const origin = grid.getOffset(centre);
  const taken = new Set(scene.tokens.map((t) => {
    const o = grid.getOffset({ x: t.x, y: t.y });
    return `${o.i},${o.j}`;
  }));
  for (let r = 0; r < 64; r++) {
    for (let di = -r; di <= r; di++) {
      for (let dj = -r; dj <= r; dj++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const cell = { i: origin.i + di, j: origin.j + dj };
        if (!taken.has(`${cell.i},${cell.j}`)) return grid.getTopLeftPoint(cell);
      }
    }
  }
  return grid.getTopLeftPoint(origin);
}

/** The Reflection already made for this PC, matched by the mirrorSource flag, or null. */
export function findReflection(pc: Actor): Actor | null {
  return game.actors.find((a) => a.getFlag(MODULE_ID, 'mirrorSource') === pc.uuid) ?? null;
}

/**
 * The "Shadow Reflections" folder, preferring the bundled one (a NetherWorld subfolder, both keepId).
 * If it's gone, recreate it under NetherWorld — and pull a stray root-level one back under it — so
 * reflections never sit loose at the sidebar root.
 */
async function shadowFolder(): Promise<Folder | null | undefined> {
  const bundled = game.folders.get(SHADOW_REFLECTIONS_FOLDER_ID);
  if (bundled) return bundled;

  const parent =
    game.folders.get(NETHERWORLD_ACTOR_FOLDER_ID)
    ?? game.folders.find((f) => f.type === 'Actor' && f.name === 'NetherWorld');

  const existing = game.folders.find((f) => f.type === 'Actor' && f.name === SHADOW_FOLDER);
  if (existing) {
    if (parent && !existing.folder) await existing.update({ folder: parent.id });
    return existing;
  }
  return Folder.create({ name: SHADOW_FOLDER, type: 'Actor', folder: parent?.id ?? null });
}

// Drop the reflection's token on the active scene, skipping it if one's already there so a repeat
// click doesn't litter duplicates.
async function placeOnMap(reflection: Actor): Promise<void> {
  const scene = canvas.scene;
  if (!scene || scene.tokens.some((t) => t.actorId === reflection.id)) return;
  const token = await reflection.getTokenDocument(freeDropPoint(scene), { parent: scene });
  await scene.createEmbeddedDocuments('Token', [token.toObject()]);
}

/**
 * Clone a PC into a hostile glass Reflection: a `character` two levels weaker, glass-tinted, with the
 * four shadow actions and the shadow-trait effect, auto-linked to its source. Kept a `character` (not
 * rebuilt as an NPC) so it owns the same feats/spells/strikes the Mirror Echo replays. Drops a token
 * on the active scene. GM-only.
 */
export async function makeShadow(pc: Actor): Promise<Actor | null> {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.notifications.gmOnly`));
    return null;
  }
  if (pc?.type !== 'character') {
    ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.notifications.shadowNeedsPc`));
    return null;
  }

  // One reflection per PC: if it exists, bring it onto the map instead of duplicating.
  const existing = findReflection(pc);
  if (existing) {
    await placeOnMap(existing);
    return existing;
  }

  const { _id, ...source } = pc.toObject() as Record<string, any>;
  const name = game.i18n.format(`${MODULE_ID}.shadow.name`, { name: pc.name });
  const level = Math.max(1, (source.system?.details?.level?.value ?? 1) - LEVEL_REDUCTION);

  const folder = await shadowFolder();

  const data = {
    ...source,
    type: source.type,
    name,
    folder: folder?.id ?? null,
    // Strip player owners: the reflection is a hostile, GM-run actor, and dropping ownership keeps
    // it out of the PC pickers (Link/Mirror Cast filter on hasPlayerOwner).
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE },
    // A cloned character defaults to the party alliance; force opposition so the reflection counts
    // as an enemy for flanking, targeting, and aura automation, not just a hostile token disposition.
    system: foundry.utils.mergeObject(source.system, {
      details: { level: { value: level }, alliance: 'opposition' },
    }),
    prototypeToken: foundry.utils.mergeObject(source.prototypeToken, {
      name,
      actorLink: true,
      disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
      alpha: SHADOW_TOKEN_ALPHA,
      texture: { tint: SHADOW_TINT },
    }),
    // Source items keep their _ids (preserving spell-location / granted-by cross-references); the
    // shadow actions and trait effect carry none, so Foundry mints fresh ids for them.
    items: [...(source.items ?? []), ...SHADOW_ACTIONS, SHADOW_TRAIT_EFFECT],
    flags: foundry.utils.mergeObject(source.flags ?? {}, { [MODULE_ID]: { mirrorSource: pc.uuid } }),
  };

  const reflection = (await Actor.create(data)) ?? null;
  if (reflection) await placeOnMap(reflection);
  return reflection;
}
