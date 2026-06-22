import type { OfferCard } from '../offer';

/**
 * Shared reactive state for the offer dialog, written from outside the component (GM clicks, the socket
 * handler) — a runed singleton so a mutation from plain TS still propagates into the Svelte view.
 */
function createOfferStore() {
  let activeId = $state('');
  let sharing = $state(false);
  let cards = $state<OfferCard[]>([]);

  return {
    get activeId(): string {
      return activeId;
    },
    set activeId(value: string) {
      activeId = value;
    },
    /** True only on the presenting GM's client — gates tab broadcasts and the "live" indicator. */
    get sharing(): boolean {
      return sharing;
    },
    set sharing(value: boolean) {
      sharing = value;
    },
    /** The built offer cards — resolved on the GM's preview, injected from the broadcast on a player. */
    get cards(): OfferCard[] {
      return cards;
    },
    set cards(value: OfferCard[]) {
      cards = value;
    },
  };
}

export const offerStore = createOfferStore();
