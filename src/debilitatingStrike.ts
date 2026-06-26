import type { ActorPF2e, ChatMessagePF2e } from 'foundry-pf2e';
import {
  MODULE_ID, STRIGOI_ACTOR_ID, DEBILITATING_STRIKE_DC, AUTO_DEBILITATING_STRIKE_SETTING,
} from './constants';

const { DialogV2 } = foundry.applications.api;

const EFFECT_IMG = 'icons/skills/wounds/injury-pain-body-orange.webp';

type ConditionSlug = Parameters<ActorPF2e['increaseCondition']>[0];

// Mechanics only; each pick's label and description sentence live in lang/en.json (no hard-coded strings).
const DEBILITATIONS: Record<string, { condition?: ConditionSlug; rules: Record<string, unknown>[] }> = {
  speed: { rules: [{ key: 'FlatModifier', selector: 'speed', value: -10, type: 'status' }] },
  enfeebled: { condition: 'enfeebled', rules: [] },
  reactions: { rules: [] }, // GM-enforced; the effect badge serves as the reminder
  flank: {
    rules: [
      { key: 'ActiveEffectLike', mode: 'override', path: 'system.attributes.flanking.canFlank', value: false },
      { key: 'ActiveEffectLike', mode: 'override', path: 'system.attributes.flanking.canGangUp', value: false },
    ],
  },
};

const t = (key: string, data?: Record<string, string | number>): string =>
  data ? game.i18n.format(`${MODULE_ID}.${key}`, data) : game.i18n.localize(`${MODULE_ID}.${key}`);

const enrich = (html: string, actor: Actor): Promise<string> =>
  foundry.applications.ux.TextEditor.implementation.enrichHTML(html, {
    rollData: actor.getRollData(),
    relativeTo: actor,
  });

const label = (slug: string): string => t(`debilitatingStrike.labels.${slug}`);
const line = (slug: string): string => t(`debilitatingStrike.lines.${slug}`);

/**
 * Apply the strigoi's Double Debilitation to `victim`: the chosen Enfeebled condition (the other picks
 * are rule-element- or GM-enforced), one combined turn-end effect (always created, so a rules-less pick
 * still leaves a clickable badge), the Double-Debilitation card, and — on a crit — the Critical
 * Debilitation Fortitude save card.
 */
export async function applyDebilitatingStrike(
  victim: Actor | null | undefined,
  picks: string[],
  isCrit: boolean,
): Promise<void> {
  if (!victim || picks.length !== 2) return;
  const actor = victim as ActorPF2e;

  for (const slug of picks) {
    const condition = DEBILITATIONS[slug]?.condition;
    if (condition) await actor.increaseCondition(condition, { value: 1 });
  }

  const descriptionList = picks.map((slug) => `<li>${line(slug)}</li>`).join('');
  const effectData: Record<string, unknown> = {
    type: 'effect',
    name: t('debilitatingStrike.effectName', { picks: picks.map(label).join(' + ') }),
    img: EFFECT_IMG,
    system: {
      tokenIcon: { show: true },
      duration: { value: 1, unit: 'rounds', sustained: false, expiry: 'turn-end' },
      start: { value: game.time.worldTime, initiative: null },
      description: {
        value: `<p>${t('debilitatingStrike.effectIntro')}</p><ul>${descriptionList}</ul><p><em>${t('debilitatingStrike.removingNote')}</em></p>`,
      },
      traits: { value: [], rarity: 'common' },
      level: { value: 1 },
      rules: picks.flatMap((slug) => DEBILITATIONS[slug]?.rules ?? []),
    },
  };
  await actor.createEmbeddedDocuments('Item', [effectData]);

  const card = `<div class="pf2e chat-card">
  <header class="card-header"><h3>${t('debilitatingStrike.cardTitle')}</h3></header>
  <div class="card-content">
    <p>${t('debilitatingStrike.cardIntro', { name: actor.name })}</p>
    <ul>${descriptionList}</ul>
    <p><em>${t('debilitatingStrike.removingNote')}</em></p>
  </div>
</div>`;
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: await enrich(card, actor) });

  if (!isCrit) return;
  const check = `@Check[fortitude|dc:${DEBILITATING_STRIKE_DC}|traits:incapacitation]`;
  const critCard = `<div class="pf2e chat-card">
  <header class="card-header"><h3>${t('debilitatingStrike.crit.title')}</h3></header>
  <div class="card-content">
    <p>${t('debilitatingStrike.crit.intro', { name: actor.name })}</p>
    <p>${check}</p>
    <ul>
      <li>${t('debilitatingStrike.crit.criticalSuccess')}</li>
      <li>${t('debilitatingStrike.crit.success')}</li>
      <li>${t('debilitatingStrike.crit.failure')}</li>
      <li>${t('debilitatingStrike.crit.criticalFailure')}</li>
    </ul>
  </div>
</div>`;
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: await enrich(critCard, actor) });
}

/**
 * Open the debilitation picker for `victim` (default: the controlled token). The strike hook fires this
 * with the detected victim and crit state; the manual macro fires it bare. The GM still chooses which two
 * debilitations — the picker enforces exactly two and pre-ticks the crit save when one was detected.
 */
export async function openDebilitatingStrike(
  victim: Actor | null = canvas.tokens.controlled[0]?.actor ?? null,
  { isCrit = false }: { isCrit?: boolean } = {},
): Promise<void> {
  if (!victim) {
    ui.notifications.warn(t('debilitatingStrike.noTarget'));
    return;
  }

  const rows = Object.keys(DEBILITATIONS)
    .map(
      (slug) => `<div class="form-group">
      <label style="display:flex;gap:.5em;align-items:center;">
        <input type="checkbox" name="debil" value="${slug}"> ${label(slug)}
      </label>
    </div>`,
    )
    .join('');
  const content = `<p><strong>${t('debilitatingStrike.targetLabel')}:</strong> ${victim.name}</p>
  <p>${t('debilitatingStrike.prompt')}</p>
  ${rows}
  <hr>
  <div class="form-group">
    <label style="display:flex;gap:.5em;align-items:center;">
      <input type="checkbox" name="crit"${isCrit ? ' checked' : ''}>
      <span>${t('debilitatingStrike.critPrompt', { dc: DEBILITATING_STRIKE_DC })}</span>
    </label>
  </div>`;

  const result = await DialogV2.wait({
    window: { title: t('debilitatingStrike.dialogTitle', { name: victim.name }) },
    content,
    rejectClose: false,
    // Two debilitations only: once two are checked, disable the rest so a third can't be picked.
    render: (_event: Event, dialog: InstanceType<typeof DialogV2>) => {
      const boxes = [...dialog.element.querySelectorAll<HTMLInputElement>('input[name="debil"]')];
      const sync = (): void => {
        const checked = boxes.filter((b) => b.checked).length;
        for (const b of boxes) if (!b.checked) b.disabled = checked >= 2;
      };
      for (const b of boxes) b.addEventListener('change', sync);
    },
    buttons: [
      {
        action: 'apply',
        label: t('debilitatingStrike.apply'),
        default: true,
        callback: (_event: Event, button: HTMLButtonElement) => {
          const form = button.form;
          const picks = [...(form?.querySelectorAll<HTMLInputElement>('input[name="debil"]:checked') ?? [])].map(
            (el) => el.value,
          );
          const crit = form?.querySelector<HTMLInputElement>('input[name="crit"]')?.checked ?? false;
          return { picks, isCrit: crit };
        },
      },
      { action: 'cancel', label: t('debilitatingStrike.cancel') },
    ],
  });

  if (!result || typeof result !== 'object') return; // dismissed or cancelled
  const { picks, isCrit: crit } = result as { picks: string[]; isCrit: boolean };
  if (picks.length !== 2) {
    ui.notifications.error(t('debilitatingStrike.pickTwo'));
    return;
  }
  await applyDebilitatingStrike(victim, picks, crit);
}

// The strike rides the attack roll's chat message: a hit (success/crit) by Veyrin against an off-guard
// target. `target:condition:off-guard` is frozen into the roll options at roll time and covers both a
// stored off-guard condition and flanking-derived off-guard (PF2e bakes the flanking effect in first).
function isDebilitatingHit(m: ChatMessagePF2e): { victim: ActorPF2e; isCrit: boolean } | null {
  if (m.actor?.id !== STRIGOI_ACTOR_ID) return null;
  const pf2e = m.flags.pf2e as
    | { context?: { type?: string; outcome?: string; options?: string[] }; origin?: { type?: string } }
    | undefined;
  const ctx = pf2e?.context;
  if (ctx?.type !== 'attack-roll' || pf2e?.origin?.type === 'spell') return null; // a Strike, not a spell attack
  if (ctx.outcome !== 'success' && ctx.outcome !== 'criticalSuccess') return null;
  if (!ctx.options?.includes('target:condition:off-guard')) return null;
  const victim = m.target?.actor;
  return victim ? { victim, isCrit: ctx.outcome === 'criticalSuccess' } : null;
}

/**
 * Auto-prompt: when Veyrin's Strike hits an off-guard creature, open the debilitation picker pre-aimed at
 * the victim with the crit save pre-ticked. Runs only on the roller's client (an NPC strike is rolled by
 * a GM), so it fires once, not once per connected client. Off via the `autoDebilitatingStrike` setting.
 */
export function onStrigoiStrike(m: ChatMessagePF2e): void {
  if (m.author?.id !== game.user.id) return;
  if (!game.settings.get(MODULE_ID, AUTO_DEBILITATING_STRIKE_SETTING)) return;
  const hit = isDebilitatingHit(m);
  if (hit) void openDebilitatingStrike(hit.victim, { isCrit: hit.isCrit });
}
