import { MODULE_ID } from './constants';

const SHADOW_TINT = '#694d93';
const SHADOW_TOKEN_ALPHA = 0.85;
const LEVEL_REDUCTION = 2;
const SHADOW_TRAIT = 'shadow';
const SHADOW_FOLDER = 'Shadow Reflections';

// The glass-reflection rules, embedded on every shadow so the one-round echo and shatter-on-death
// travel with the clone. Lifted verbatim from the bundled Reflection actors. The DC/damage in
// Shatter are GM-read flavor, not automated rule elements, so they stay as fixed text.
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

/**
 * Clone a PC into a hostile glass Reflection: a `character` actor two levels weaker, with the
 * shadow trait + glass tint and the four shadow actions embedded, auto-linked to its source so
 * Mirror Cast works at once. Kept as a `character` (not rebuilt as an NPC) so the reflection
 * literally owns the same feats/spells/strikes the Mirror Echo gimmick replays. GM-only.
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

  const { _id, ...source } = pc.toObject() as Record<string, any>;
  const name = game.i18n.format(`${MODULE_ID}.shadow.name`, { name: pc.name });
  const level = Math.max(1, (source.system?.details?.level?.value ?? 1) - LEVEL_REDUCTION);
  const traits = new Set<string>([...(source.system?.traits?.value ?? []), SHADOW_TRAIT]);

  const folder =
    game.folders.find((f) => f.type === 'Actor' && f.name === SHADOW_FOLDER)
    ?? (await Folder.create({ name: SHADOW_FOLDER, type: 'Actor' }));

  const data = {
    ...source,
    type: source.type,
    name,
    folder: folder?.id ?? null,
    // Strip player owners: the reflection is a hostile, GM-run actor, and dropping ownership keeps
    // it out of the PC pickers (Link/Mirror Cast filter on hasPlayerOwner).
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE },
    system: foundry.utils.mergeObject(source.system, {
      details: { level: { value: level } },
      traits: { value: [...traits], rarity: 'unique' },
    }),
    prototypeToken: foundry.utils.mergeObject(source.prototypeToken, {
      name,
      actorLink: true,
      disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
      alpha: SHADOW_TOKEN_ALPHA,
      texture: { tint: SHADOW_TINT },
    }),
    // Source items keep their _ids (preserving spell-location / granted-by cross-references); the
    // shadow actions carry none, so Foundry mints fresh ids for them.
    items: [...(source.items ?? []), ...SHADOW_ACTIONS],
    flags: foundry.utils.mergeObject(source.flags ?? {}, { world: { mirrorSource: pc.uuid } }),
  };

  return (await Actor.create(data)) ?? null;
}
