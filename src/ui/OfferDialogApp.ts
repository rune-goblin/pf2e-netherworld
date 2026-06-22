import { mount, unmount } from 'svelte';
import { SOCKET_EVENT } from '../constants';
import { resolveOfferItems, type OfferSignal } from '../offer';
import { offerStore } from './offerStore.svelte';
import OfferDialog from './OfferDialog.svelte';

const { ApplicationV2 } = foundry.applications.api;

/**
 * The Interlocutor's offer as a tabbed card (one tab per cursed gift), one instance per client. The GM
 * previews locally, then "Send to Players" broadcasts it and pushes tab clicks so the table follows
 * along — all transient signals on the module socket (see {@link SOCKET_EVENT}); nothing persists.
 */
export class OfferDialogApp extends ApplicationV2 {
  static override DEFAULT_OPTIONS = {
    id: 'pf2e-netherworld-offer',
    tag: 'section',
    classes: ['pf2e-netherworld', 'pf2e-netherworld-offer'],
    window: { title: 'pf2e-netherworld.offer.title', icon: 'fa-solid fa-scroll', resizable: false },
    position: { width: 760, height: 'auto' as const },
  };

  static #instance: OfferDialogApp | null = null;

  #component?: ReturnType<typeof mount>;
  #root?: HTMLElement;

  /** Register the socket listener once, on every client, so players can receive a shared offer. */
  static register(): void {
    game.socket?.on(SOCKET_EVENT, (data: OfferSignal) => {
      if (data?.scope !== 'offer') return;
      if (data.action === 'close') this.#instance?.close();
      else this.#receive(data);
    });
  }

  /** Open (or surface) the dialog on this client, defaulting to the first offered item. */
  static open(): OfferDialogApp {
    if (!offerStore.activeId) offerStore.activeId = resolveOfferItems()[0]?.id ?? '';
    const app = (this.#instance ??= new OfferDialogApp());
    void app.render({ force: true });
    return app;
  }

  // A player receiving the broadcast: adopt the pushed cards and tab, then open if not already up. A
  // tab push re-opens, so a player who closed their copy is snapped back when the GM moves on.
  static #receive(data: OfferSignal): void {
    if (data.cards) offerStore.cards = data.cards;
    if (data.tab) offerStore.activeId = data.tab;
    const app = (this.#instance ??= new OfferDialogApp());
    void app.render({ force: true });
  }

  #emit(action: OfferSignal['action'], tab?: string): void {
    // Carry the built cards on every show/tab push so a player can render without read access to the
    // source items; a close needs no payload.
    const cards = action === 'close' ? undefined : offerStore.cards;
    game.socket?.emit(SOCKET_EVENT, { scope: 'offer', action, tab, cards } satisfies OfferSignal);
  }

  /** Switch tabs locally; when this GM is presenting, push the change to everyone else. */
  selectTab(id: string): void {
    offerStore.activeId = id;
    if (game.user.isGM && offerStore.sharing) this.#emit('tab', id);
  }

  /** GM: begin presenting — open the offer on every other client at the current tab. */
  share(): void {
    if (!game.user.isGM) return;
    offerStore.sharing = true;
    this.#emit('show', offerStore.activeId);
  }

  get sharing(): boolean {
    return offerStore.sharing;
  }

  protected override async _renderHTML(): Promise<HTMLElement> {
    if (!this.#component) {
      this.#root = document.createElement('div');
      this.#component = mount(OfferDialog, { target: this.#root, props: { app: this } });
    }
    return this.#root!;
  }

  protected override _replaceHTML(result: HTMLElement, content: HTMLElement): void {
    content.replaceChildren(result);
  }

  protected override _onClose(): void {
    // A presenting GM closing tears the card down for the table too; emit before clearing `sharing` so
    // the broadcast still fires, and only on the GM (a player closing their own must not dismiss others).
    if (game.user.isGM && offerStore.sharing) this.#emit('close');
    offerStore.sharing = false;
    // Drop the cards so a reopen rebuilds from current item state.
    offerStore.cards = [];
    if (this.#component) {
      unmount(this.#component);
      this.#component = undefined;
      this.#root = undefined;
    }
    OfferDialogApp.#instance = null;
  }
}
