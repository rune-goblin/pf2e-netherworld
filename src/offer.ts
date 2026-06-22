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

export type OfferBlockKind = 'lede' | 'boon' | 'cost' | 'action' | 'note';

export interface OfferBlock {
  kind: OfferBlockKind;
  html: string;
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

// Block roles are read from authored "(the gift)" / "(the cost)" / "(the finale)" markers in the
// <hr>-delimited description — no rule parsing; an unmarked block stays neutral.
function classify(html: string, index: number): OfferBlockKind {
  if (index === 0) return 'lede';
  const text = html.toLowerCase();
  if (text.includes('(the gift)') || text.includes('(the finale)')) return 'boon';
  if (text.includes('(the cost)')) return 'cost';
  if (text.includes('action-glyph')) return 'action';
  return 'note';
}

/** Enrich an item's description through the PF2e text enricher and split it on `<hr>` into classified blocks. */
export async function buildOfferCard(item: ItemPF2e): Promise<OfferCard> {
  const system = item.system as OfferItemSystem;
  const enriched = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
    system.description?.value ?? '',
    { rollData: item.getRollData(), relativeTo: item },
  );
  const blocks: OfferBlock[] = enriched
    .split(/<hr\s*\/?>/i)
    .map((html) => html.trim())
    .filter(Boolean)
    .map((html, index) => ({ kind: classify(html, index), html }));

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
