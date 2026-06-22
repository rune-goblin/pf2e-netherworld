import { mount, unmount } from 'svelte';
import { MODULE_ID } from '../constants';
import NetherWorld from './NetherWorld.svelte';

const { ApplicationV2 } = foundry.applications.api;

export class NetherWorldApp extends ApplicationV2 {
  static override DEFAULT_OPTIONS = {
    id: 'pf2e-netherworld-picker',
    tag: 'section',
    classes: ['pf2e-netherworld'],
    window: { title: 'pf2e-netherworld.app.title', icon: 'fa-solid fa-moon', resizable: false },
    position: { width: 460, height: 'auto' as const },
  };

  #component?: ReturnType<typeof mount>;
  #root?: HTMLElement;

  /** Open the picker. Managing scene flags is a world-document write, so it's GM-only. */
  static open(): NetherWorldApp | null {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.notifications.gmOnly`));
      return null;
    }
    const app = new NetherWorldApp();
    app.render({ force: true });
    return app;
  }

  // AppV2 calls _renderHTML on every render; mount once and reuse the node so a re-render neither leaks
  // a second component nor discards Svelte's reactive state.
  protected override async _renderHTML(): Promise<HTMLElement> {
    if (!this.#component) {
      this.#root = document.createElement('div');
      this.#component = mount(NetherWorld, { target: this.#root, props: { app: this } });
    }
    return this.#root!;
  }

  protected override _replaceHTML(result: HTMLElement, content: HTMLElement): void {
    content.replaceChildren(result);
  }

  protected override async _preClose(): Promise<void> {
    if (this.#component) {
      unmount(this.#component);
      this.#component = undefined;
      this.#root = undefined;
    }
  }
}
