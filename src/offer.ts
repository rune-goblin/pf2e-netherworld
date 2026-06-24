import type { ItemPF2e } from 'foundry-pf2e';
import { OFFER_ITEM_IDS } from './constants';

/** A transient presentation command sent over the module socket. */
export interface OfferSignal {
  scope: 'offer';
  action: 'show' | 'tab' | 'close';
  /** An offered item's id — the tab the GM is on. */
  tab?: string;
  // Sent with show/tab so a player can render the offer from the GM's enriched cards — the source
  // items are GM-only, so a player can't build them locally.
  cards?: OfferCard[];
}

export type OfferBlockKind = 'lede' | 'boon' | 'cost' | 'action' | 'finale' | 'note';

export interface OfferBlock {
  kind: OfferBlockKind;
  html: string;
  /** Ability title shown left of the kind tag; absent on the lede and legacy hr-split blocks. */
  name?: string;
  /** Action-cost glyph (1–3) shown by the name for an activated ability. */
  actions?: number;
}

export interface OfferCard {
  id: string;
  name: string;
  img: string;
  level: number | null;
  rarity: string | null;
  traits: string[];
  blocks: OfferBlock[];
}

/** A single named ability on a card; `kind` becomes the tag shown at the right of the name. */
export interface OfferAbility {
  name: string;
  /** boon = a gift, cost = a price, finale = applies only in the final battle against Veyrin. */
  kind: 'boon' | 'cost' | 'finale';
  /** HTML effect text. */
  effect: string;
  /** Action-cost glyph (1–3) for an activity; omit for a passive boon/cost. */
  actions?: number;
}

/** A card authored as a lede plus named abilities, rather than one `<hr>`-split blob. */
export interface OfferParts {
  /** Flavor lede, shown large at the top of the card; carries no name or tag. */
  description: string;
  abilities: OfferAbility[];
}

/** PF2e equipment surfaces we read for the card; typed narrowly to dodge the ItemPF2e union. */
interface OfferItemSystem {
  description?: { value?: string };
  level?: { value?: number };
  traits?: { value?: string[]; rarity?: string };
}

/** The offered items as live documents, in presentation order, skipping any absent. Resolved by id. */
export function resolveOfferItems(): ItemPF2e[] {
  const found: ItemPF2e[] = [];
  for (const id of OFFER_ITEM_IDS) {
    const item = game.items.get(id);
    if (item) found.push(item);
  }
  return found;
}

const enricher = (item: ItemPF2e) => (html: string) =>
  foundry.applications.ux.TextEditor.implementation.enrichHTML(html, {
    rollData: item.getRollData(),
    relativeTo: item,
  });

function cardFrom(item: ItemPF2e, system: OfferItemSystem, blocks: OfferBlock[]): OfferCard {
  return {
    id: item.id,
    name: item.name,
    img: item.img ?? 'icons/svg/item-bag.svg',
    level: system.level?.value ?? null,
    rarity: system.traits?.rarity ?? null,
    traits: system.traits?.value ?? [],
    blocks,
  };
}

// Block roles are read from authored "(the gift)" / "(the cost)" / "(the finale)" markers in the
// <hr>-delimited description — no rule parsing; an unmarked block stays neutral.
function classify(html: string, index: number): OfferBlockKind {
  if (index === 0) return 'lede';
  const text = html.toLowerCase();
  if (text.includes('(the finale)')) return 'finale';
  if (text.includes('(the gift)')) return 'boon';
  if (text.includes('(the cost)')) return 'cost';
  if (text.includes('action-glyph')) return 'action';
  return 'note';
}

/** Shipped path: enrich the item description and split it on `<hr>` into classified blocks. */
export async function buildOfferCard(item: ItemPF2e): Promise<OfferCard> {
  const system = item.system as OfferItemSystem;
  const enriched = await enricher(item)(system.description?.value ?? '');
  const blocks: OfferBlock[] = enriched
    .split(/<hr\s*\/?>/i)
    .map((html) => html.trim())
    .filter(Boolean)
    .map((html, index) => ({ kind: classify(html, index), html }));
  return cardFrom(item, system, blocks);
}

/** Structured path: a lede block from the description, then one block per named ability. */
export async function buildOfferCardFromParts(item: ItemPF2e, parts: OfferParts): Promise<OfferCard> {
  const system = item.system as OfferItemSystem;
  const enrich = enricher(item);
  const blocks: OfferBlock[] = [];
  if (parts.description.trim()) blocks.push({ kind: 'lede', html: await enrich(parts.description) });
  for (const ability of parts.abilities) {
    blocks.push({
      kind: ability.kind,
      name: ability.name,
      actions: ability.actions,
      html: await enrich(ability.effect),
    });
  }
  return cardFrom(item, system, blocks);
}
