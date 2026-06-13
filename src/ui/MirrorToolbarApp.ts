import { mount, unmount } from 'svelte';
import { MODULE_ID, TOOLBAR_POSITION_SETTING } from '../constants';
import { isMirrorScene } from '../mirror';
import MirrorToolbar from './MirrorToolbar.svelte';

const { ApplicationV2 } = foundry.applications.api;

interface SavedPosition {
  left: number;
  top: number;
}

/**
 * A frameless, draggable palette pinned over the canvas, shown only to the GM and only on a
 * dark-mirror scene. It drives nothing itself — the Svelte component reads/writes tile state.
 */
export class MirrorToolbarApp extends ApplicationV2 {
  static override DEFAULT_OPTIONS = {
    id: 'pf2e-netherworld-mirror-toolbar',
    tag: 'div',
    classes: ['pf2e-netherworld', 'mirror-toolbar'],
    window: { frame: false, positioned: true },
    position: { width: 'auto' as const, height: 'auto' as const },
  };

  static #instance: MirrorToolbarApp | null = null;

  #component?: ReturnType<typeof mount>;
  #root?: HTMLElement;
  #sceneId?: string;

  /** Render the toolbar for the GM on a mirror scene; close it otherwise. Safe to call repeatedly. */
  static sync(): void {
    const scene = canvas.scene;
    const show = game.user.isGM && isMirrorScene(scene);

    console.log(`${MODULE_ID} | toolbar.sync`, { scene: scene?.name, id: scene?.id, gm: game.user.isGM, show });

    if (!show) {
      void this.#instance?.close();
      this.#instance = null;
      return;
    }
    // A different mirror scene needs a fresh component bound to it.
    if (this.#instance && this.#instance.#sceneId !== scene.id) {
      void this.#instance.close();
      this.#instance = null;
    }
    this.#instance ??= new MirrorToolbarApp();
    this.#instance.#sceneId = scene.id;
    if (!this.#instance.rendered) {
      const app = this.#instance;
      void app.render({ force: true }).then(() => app.#placeInitial());
    }
  }

  // Restore the dragged position, or default to the top-right of the canvas (clear of the sidebar).
  #placeInitial(): void {
    // A frameless AppV2 doesn't reliably get layout/stacking on its own; pin it explicitly.
    const el = this.element;
    el.style.position = 'fixed';
    el.style.zIndex = '100';
    el.style.width = 'max-content';
    el.style.height = 'max-content';

    const saved = game.settings.get(MODULE_ID, TOOLBAR_POSITION_SETTING) as Partial<SavedPosition>;
    if (Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
      this.setPosition({ left: saved.left, top: saved.top });
      return;
    }
    const width = el.getBoundingClientRect().width || 220;
    const sidebar = document.getElementById('sidebar')?.getBoundingClientRect().width ?? 320;
    this.setPosition({ left: window.innerWidth - sidebar - width - 16, top: 12 });
  }

  savePosition(): void {
    const { left, top } = this.position;
    void game.settings.set(MODULE_ID, TOOLBAR_POSITION_SETTING, { left, top });
  }

  protected override async _renderHTML(): Promise<HTMLElement> {
    if (!this.#component) {
      this.#root = document.createElement('div');
      this.#component = mount(MirrorToolbar, { target: this.#root, props: { app: this } });
    }
    return this.#root!;
  }

  protected override _replaceHTML(result: HTMLElement, content: HTMLElement): void {
    content.replaceChildren(result);
  }

  protected override _onClose(): void {
    if (this.#component) {
      unmount(this.#component);
      this.#component = undefined;
      this.#root = undefined;
    }
  }
}
