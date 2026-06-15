import type { ActorPF2e, ChatMessagePF2e } from 'foundry-pf2e';
import { MODULE_ID } from './constants';

export interface MirroredAction {
  message: ChatMessagePF2e;
  kind: 'spell' | 'strike' | 'action';
  name: string;
  /** Spell cast rank (0 when unknown); 0 for strikes/actions. */
  rank: number;
  /** Multiple-attack penalty step 0/1/2 for strikes; 0 otherwise. */
  map: number;
  /** Item slug used to find the reflection's matching strike/ability; null for spells. */
  slug: string | null;
}

function sourceUuid(reflection: ActorPF2e): string | null {
  return (reflection.getFlag(MODULE_ID, 'mirrorSource') as string | undefined) ?? null;
}

function actorIdFromUuid(uuid: string | null | undefined): string | null {
  return uuid ? (fromUuidSync(uuid)?.id ?? null) : null;
}

/** Reflections that are combatants in the active encounter, deduplicated by actor. */
export function reflectionCombatants(): ActorPF2e[] {
  const combat = game.combat;
  if (!combat) return [];
  const seen = new Set<string>();
  const out: ActorPF2e[] = [];
  for (const combatant of combat.combatants) {
    const actor = combatant.actor;
    if (!actor || seen.has(actor.id) || !sourceUuid(actor)) continue;
    seen.add(actor.id);
    out.push(actor);
  }
  return out;
}

// Who acted: speaker first, then the pf2e origin actor (covers messages without a speaker token).
function actingActor(m: ChatMessagePF2e): ActorPF2e | null {
  const origin = m.flags.pf2e?.origin?.actor;
  return (m.speakerActor as ActorPF2e | null) ?? (origin ? (fromUuidSync(origin) as ActorPF2e | null) : null);
}

// Weapon + MAP for a strike message. The slug rides the attack roll's identifier
// (`itemId.slug.meleeOrRanged`); mapIncreases is on the context flag but omitted from its type.
function strikeInfo(m: ChatMessagePF2e): { slug: string | null; meleeOrRanged: string | null; map: number } {
  const rollOptions = m.rolls?.[0]?.options as { identifier?: string } | undefined;
  const context = m.flags.pf2e?.context as { identifier?: string; mapIncreases?: number } | undefined;
  const identifier = rollOptions?.identifier ?? context?.identifier ?? '';
  const [, slug = null, meleeOrRanged = null] = identifier.split('.');
  return { slug, meleeOrRanged, map: typeof context?.mapIncreases === 'number' ? context.mapIncreases : 0 };
}

// Per-original capture, stored on the combat keyed by the original's actor id. Holds one round only:
// the chat-message ids of the actions it took that round, for its Reflection to replay.
const CAPTURES_FLAG = 'captures';
interface Capture {
  round: number;
  messageIds: string[];
}
type Captures = Record<string, Capture>;

function hasReflection(actor: ActorPF2e): boolean {
  return game.actors.some((a) => a.getFlag(MODULE_ID, 'mirrorSource') === actor.uuid);
}

// Serialise capture writes: createChatMessage fires synchronously per message, so chaining keeps two
// quick actions from each reading the same pre-write flag and one clobbering the other's append.
let captureQueue: Promise<unknown> = Promise.resolve();

/**
 * Record one of an original's actions onto the active combat so its Reflection can replay it. Keeps
 * exactly one round per original: the first action of a new round replaces the prior round's capture,
 * further actions that round append. GM-only — a single writer keeps the shared flag consistent.
 */
export function captureSourceAction(m: ChatMessagePF2e): void {
  if (!game.user.isGM) return;
  captureQueue = captureQueue
    .then(() => recordCapture(m))
    .catch((e) => console.error(`${MODULE_ID} | failed to capture reflected action`, e));
}

async function recordCapture(m: ChatMessagePF2e): Promise<void> {
  const combat = game.combat;
  if (!combat?.started || !actionFromMessage(m)) return;
  const actor = actingActor(m);
  if (!actor || !hasReflection(actor)) return;

  const round = combat.round;
  const captures: Captures = { ...((combat.getFlag(MODULE_ID, CAPTURES_FLAG) as Captures) ?? {}) };
  const existing = captures[actor.id];
  captures[actor.id] = existing?.round === round
    ? { round, messageIds: [...existing.messageIds, m.id] }
    : { round, messageIds: [m.id] };
  await combat.setFlag(MODULE_ID, CAPTURES_FLAG, captures);
}

/** Wipe all captures at the start of an encounter so no Reflection echoes a previous fight. GM-only. */
export async function clearCaptures(combat: Combat): Promise<void> {
  if (game.user.isGM && combat.getFlag(MODULE_ID, CAPTURES_FLAG)) {
    await combat.unsetFlag(MODULE_ID, CAPTURES_FLAG);
  }
}

/**
 * Classify a chat message as the one discrete action it represents, or null. The general rule that
 * keeps a single spell/strike/ability from listing two or three times — and keeps reactive rolls out
 * entirely: an entry is an action the creature *initiated*. A damage roll rides on a cast/strike/use
 * already listed, and a saving throw is a roll the creature was *forced* to make; neither is an
 * initiated action, so reject both up front. (`isDamageRoll` also catches context-less damage rolls.)
 */
function actionFromMessage(m: ChatMessagePF2e): MirroredAction | null {
  const pf2e = m.flags.pf2e as
    | { casting?: { id?: string } | null; origin?: { type?: string; castRank?: number }; context?: { type?: string } }
    | undefined;
  const ctx = pf2e?.context?.type;

  if (m.isDamageRoll || ctx === 'saving-throw') return null;

  // Spell cast card — carries the `casting` flag; the cast's own attack roll is a separate message.
  if (pf2e?.casting?.id && ctx !== 'attack-roll') {
    return { message: m, kind: 'spell', name: m.item?.name ?? 'Spell', rank: pf2e.origin?.castRank ?? 0, map: 0, slug: null };
  }
  // Weapon/unarmed Strike — exclude spell attack rolls (origin.type 'spell'), which belong to a cast.
  if (ctx === 'attack-roll' && pf2e?.origin?.type !== 'spell') {
    const { slug, map } = strikeInfo(m);
    return { message: m, kind: 'strike', name: m.item?.name ?? prettify(slug), rank: 0, map, slug };
  }
  // Any other ability the source used — Raise a Symbol, Demoralize, a feat: a use-action / self-effect
  // card or a skill check.
  if (ctx === 'self-effect' || pf2e?.origin?.type === 'action' || pf2e?.origin?.type === 'feat') {
    return { message: m, kind: 'action', name: m.item?.name ?? 'Action', rank: 0, map: 0, slug: m.item?.slug ?? null };
  }
  return null;
}

/**
 * The one round this Reflection echoes: its source's captured actions. The capture only updates when
 * the source actually acts, so it is naturally "this round" when the source's initiative precedes the
 * Reflection's (it has already acted) and "last round" otherwise — empty until the source acts at all.
 */
export function mirroredActions(reflection: ActorPF2e): MirroredAction[] {
  const combat = game.combat;
  const sourceId = actorIdFromUuid(sourceUuid(reflection));
  if (!combat || !sourceId) return [];

  const capture = (combat.getFlag(MODULE_ID, CAPTURES_FLAG) as Captures | undefined)?.[sourceId];
  if (!capture) return [];

  return capture.messageIds
    .map((id) => game.messages.get(id))
    .filter((m): m is ChatMessagePF2e => Boolean(m))
    .map(actionFromMessage)
    .filter((a): a is MirroredAction => a !== null);
}

function prettify(slug: string | null): string {
  return slug ? slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Strike';
}

/**
 * Recast a mirrored spell from the Reflection at its own (reduced) rank — ranks above the
 * Reflection's ceiling clamp down. The Reflection is a full clone of the PC's spellbook, so it
 * normally owns this spell already: casting its *own* persisted spell is what keeps the posted
 * card live (the Save / Roll Damage buttons and target capture re-resolve the spell by uuid, which
 * a throwaway clone's uuid can't satisfy — that left a dead card).
 */
export async function castMirroredSpell(reflection: ActorPF2e, m: ChatMessagePF2e): Promise<boolean> {
  if (!reflection.isOfType('character')) return false;
  const origin = m.flags.pf2e?.origin;
  if (origin?.type !== 'spell') return false;

  const source = m.item && m.item.isOfType('spell') ? m.item : null;
  const maxRank = Math.max(1, Math.ceil((reflection.level || 12) / 2));
  const castRank = Math.min(origin.castRank ?? source?.rank ?? 1, maxRank);

  const own = source ? reflection.itemTypes.spell.find((s) => s.slug === source.slug) : null;
  if (own) {
    await own.toMessage(null, { data: { castRank } });
    return true;
  }

  // Fallback: a spell the Reflection lacks (cast from a consumable, or a one-off innate). Clone it
  // into a spellcasting entry, then embed the spell on the message so its card still re-resolves.
  let entryId: string | undefined = reflection.itemTypes.spellcastingEntry[0]?.id;
  if (!entryId) {
    const dc = (reflection.getFlag(MODULE_ID, 'mirrorSpellDC') as number | undefined) ?? 32;
    const entryData = {
      name: game.i18n.localize(`${MODULE_ID}.reflectActions.entryName`),
      type: 'spellcastingEntry',
      system: {
        ability: { value: 'cha' },
        spelldc: { dc, value: dc - 8 },
        tradition: { value: 'arcane' },
        prepared: { value: 'innate' },
        proficiency: { value: 1 },
        showSlotlessLevels: { value: false },
      },
    };
    const created = await reflection.createEmbeddedDocuments('Item', [entryData] as any[]);
    entryId = (created[0] as { id: string } | undefined)?.id;
  }
  if (!entryId) return false;

  const embedded = m.flags.pf2e?.casting?.embeddedSpell;
  // Loose by necessity: an embedded spell is rebuilt as an owned item, an external one is fetched.
  const base: any = embedded
    ? new CONFIG.Item.documentClass(embedded as any, { parent: reflection })
    : await fromUuid(origin.uuid);
  if (base?.type !== 'spell') return false;

  const clone = base.clone({ 'system.location.value': entryId }, { parent: reflection });
  const message = await clone.toMessage(null, { create: false, data: { castRank } });
  if (!message) return false;
  const data = message.toObject();
  foundry.utils.setProperty(data, 'flags.pf2e.casting.embeddedSpell', clone.toObject());
  await (CONFIG.ChatMessage.documentClass as any).create(data);
  return true;
}

/** Roll the Reflection's matching weapon Strike at the same MAP the source used. */
export async function rollMirroredStrike(reflection: ActorPF2e, m: ChatMessagePF2e): Promise<boolean> {
  if (!reflection.isOfType('character')) return false;
  const { slug, meleeOrRanged, map } = strikeInfo(m);
  if (!slug) return false;

  const matches = reflection.system.actions.filter((s) => s.slug === slug);
  const strike =
    (meleeOrRanged && matches.find((s) => ((s.item as { isMelee?: boolean }).isMelee ? 'melee' : 'ranged') === meleeOrRanged))
    || matches[0];
  if (!strike) {
    ui.notifications.warn(game.i18n.format(`${MODULE_ID}.reflectActions.noStrike`, { name: m.item?.name ?? slug }));
    return false;
  }

  const variant = strike.variants[Math.min(map, strike.variants.length - 1)] ?? strike.variants[0];
  const [target = null] = game.user.targets;
  await variant.roll({ target });
  return true;
}

/**
 * Replay a mirrored ability from the Reflection. A recognized skill/basic action (Demoralize, Trip,
 * Feint, …) is run through PF2e's action API so it actually rolls — using the Reflection's own
 * statistics — against the GM's current target. Anything else (Raise a Symbol, a bespoke class
 * feat) has no such roll, so its card is re-posted for the GM to resolve by hand.
 */
export async function postMirroredAction(reflection: ActorPF2e, m: ChatMessagePF2e): Promise<boolean> {
  const slug = m.item?.slug ?? null;

  const action = slug ? game.pf2e.actions.get(slug) : null;
  if (action) {
    const [target] = game.user.targets;
    await action.use({ actors: reflection, ...(target ? { target } : {}) });
    return true;
  }

  const item = slug
    ? reflection.items.find((i) => i.slug === slug && (i.isOfType('action') || i.isOfType('feat')))
    : null;
  if (item) {
    await item.toMessage();
    return true;
  }

  ui.notifications.warn(game.i18n.format(`${MODULE_ID}.reflectActions.noAction`, { name: m.item?.name ?? slug ?? '' }));
  return false;
}
