import type { ChatMessagePF2e } from 'foundry-pf2e';
import { MODULE_ID, SACRAMENT_IMG, CHAIN_COILS_EFFECT_UUID } from './constants';

const SACRAMENT_SLUG = 'the-sacrament-of-pain';
const PERSISTENT_DAMAGE_UUID = 'Compendium.pf2e.conditionitems.Item.Persistent Damage';
const WOUND_FORMULA = '1d8';
const WOUND_TORN_FLAG = 'woundTorn';

const enrich = (html: string, actor: Actor): Promise<string> =>
  foundry.applications.ux.TextEditor.implementation.enrichHTML(html, {
    rollData: actor.getRollData(),
    relativeTo: actor,
  });

const t = (key: string, data?: Record<string, string | number>): string =>
  data ? game.i18n.format(`${MODULE_ID}.${key}`, data) : game.i18n.localize(`${MODULE_ID}.${key}`);

const CHAIN_COILS_SLUG = 'the-chain-coils';

/**
 * Fire the Sacrament of Pain's Impaling Chain on `actor`: post the self-damage card (the barbs cost
 * the wielder 1d8) and start the recharge. PF2e can't gate a weapon Strike, so the 1d4-round cooldown
 * rides a duration effect the table honors — the chain's normal Strike still happens on the weapon.
 */
export async function impalingChain(actor: Actor | null | undefined): Promise<void> {
  if (!actor) {
    ui.notifications.warn(t('sacrament.noActor'));
    return;
  }

  // The cooldown is the effect itself: while The Chain Coils is on the actor, the chain hasn't
  // re-coiled, so the activation refuses rather than trusting the table to remember.
  const effects = (actor as { itemTypes?: { effect?: { slug: string | null }[] } }).itemTypes?.effect ?? [];
  if (effects.some((e) => e.slug === CHAIN_COILS_SLUG)) {
    ui.notifications.warn(t('sacrament.recharging'));
    return;
  }

  const rounds = (await new Roll('1d4').evaluate()).total ?? 1;
  const damage = t('sacrament.selfDamage', { name: actor.name, damage: '@Damage[1d8[piercing]]' });
  const cooldown = t('sacrament.cooldown', {
    rounds,
    unit: t(rounds === 1 ? 'sacrament.round' : 'sacrament.rounds'),
  });
  const body = await enrich(`<p>${damage}</p><p class="cooldown"><em>${cooldown}</em></p>`, actor);
  const content = `<div class="pf2e-netherworld-impaling-chain"><img src="${SACRAMENT_IMG}" alt="" /><div>${body}</div></div>`;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: t('sacrament.cardTitle'),
    content,
  });

  const effect = await fromUuid(CHAIN_COILS_EFFECT_UUID);
  if (!effect) {
    ui.notifications.error(t('sacrament.noEffect'));
    return;
  }
  const source = (effect as { toObject(): { system: { duration: { value: number; unit: string } } } }).toObject();
  source.system.duration.value = rounds;
  source.system.duration.unit = 'rounds';
  await actor.createEmbeddedDocuments('Item', [source as Record<string, unknown>]);
}

// The strike rides the attack roll's identifier (`itemId.slug.meleeOrRanged`), as in reflection.ts.
function isSacramentStrike(m: ChatMessagePF2e): boolean {
  const pf2e = m.flags.pf2e as
    | { context?: { type?: string; identifier?: string }; origin?: { type?: string } }
    | undefined;
  if (pf2e?.context?.type !== 'attack-roll' || pf2e.origin?.type === 'spell') return false;
  const identifier =
    (m.rolls?.[0]?.options as { identifier?: string } | undefined)?.identifier ?? pf2e.context?.identifier ?? '';
  return identifier.split('.')[1] === SACRAMENT_SLUG;
}

/**
 * One-click recoil: striking with the chain posts its self-damage card and rolls the recharge on its own,
 * so there's no separate macro step. Runs only on the roller's client — it owns the actor and fires once,
 * not once per connected client.
 */
export function onSacramentStrike(m: ChatMessagePF2e): void {
  if (game.user.id !== (m as { author?: { id?: string } | null }).author?.id || !isSacramentStrike(m)) return;
  const origin = m.flags.pf2e?.origin?.actor;
  const actor = (m.speakerActor as Actor | null) ?? (origin ? (fromUuidSync(origin) as Actor | null) : null);
  void impalingChain(actor);
}

/**
 * The wound reopens the instant a Sacrament-bearer rolls initiative: apply the bleed straight to them (a
 * persistent-damage condition, not a wrapper effect) and post a flavor card. Active-GM-only (one writer
 * with permission over every actor); a per-combatant flag stops a re-roll from stacking a second bleed,
 * and resets when the next fight mints a fresh combatant, so that fight reopens the wound anew.
 */
export async function tearWoundOnInitiative(combatant: Combatant, changed: Record<string, unknown>): Promise<void> {
  if (game.users.activeGM?.id !== game.user.id || typeof changed.initiative !== 'number') return;
  const actor = combatant.actor;
  if (!actor) return;
  const bears = (actor as { itemTypes?: { weapon?: { slug: string | null }[] } }).itemTypes?.weapon?.some(
    (w) => w.slug === SACRAMENT_SLUG,
  );
  if (!bears || combatant.getFlag(MODULE_ID, WOUND_TORN_FLAG)) return;
  await combatant.setFlag(MODULE_ID, WOUND_TORN_FLAG, true);

  const condition = await fromUuid(PERSISTENT_DAMAGE_UUID);
  if (condition) {
    const source = (condition as { toObject(): { system: Record<string, unknown> } }).toObject();
    source.system.persistent = { formula: WOUND_FORMULA, damageType: 'bleed', dc: 15 };
    await actor.createEmbeddedDocuments('Item', [source as Record<string, unknown>]);
  }

  const flavor = t('sacrament.woundReopens', { name: actor.name, formula: WOUND_FORMULA });
  const body = await enrich(`<p>${flavor}</p>`, actor);
  const content = `<div class="pf2e-netherworld-impaling-chain"><img src="${SACRAMENT_IMG}" alt="" /><div>${body}</div></div>`;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: t('sacrament.woundCardTitle'),
    content,
  });
}
