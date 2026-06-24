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

const ROLE_MARKER = /\(the (?:gift|cost|finale)\)/i;

// Each ability block is authored as `<p><strong>Name (the gift).</strong> body…</p>`, with an
// optional action-glyph span before the marker. Pull the title and action cost back out of that
// header — and drop it from the body — so the card renders titled-and-tagged rather than repeating
// the bold "Name (the gift)." inline beside its kind tag.
function parseAbilityBlock(html: string): { name?: string; actions?: number; html: string } {
  const actions = Number(html.match(/action-glyph">(\d+)</)?.[1]) || undefined;
  const split = html.match(/^<p>([\s\S]*?\(the (?:gift|cost|finale)\)\.?)<\/strong>\s*([\s\S]*)<\/p>\s*$/i);
  if (!split) return { actions, html };
  const name = split[1]
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(ROLE_MARKER, '')
    .replace(/[\s\d.]+$/, '')
    .trim();
  return { name: name || undefined, actions, html: `<p>${split[2].trim()}</p>` };
}

/** Enrich the description, split on `<hr>`, and rebuild one titled block per ability. */
export async function buildOfferCard(item: ItemPF2e): Promise<OfferCard> {
  const system = item.system as OfferItemSystem;
  const enriched = await enricher(item)(system.description?.value ?? '');
  const blocks: OfferBlock[] = enriched
    .split(/<hr\s*\/?>/i)
    .map((html) => html.trim())
    .filter(Boolean)
    .map((html, index) => {
      const kind = classify(html, index);
      return kind === 'lede' ? { kind, html } : { kind, ...parseAbilityBlock(html) };
    });
  return cardFrom(item, system, blocks);
}
