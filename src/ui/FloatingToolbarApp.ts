import { mount, unmount, type Component } from 'svelte';
import { MODULE_ID } from '../constants';

const { ApplicationV2 } = foundry.applications.api;

interface SavedPosition {
  left: number;
  top: number;
}

// Live instances keyed by app id, so refresh() can find/close the one for a given toolbar.
const live = new Map<string, FloatingToolbarApp>();

/**
 * Base for the frameless, draggable palettes pinned over the canvas — GM-only and scene-bound.
 * A subclass supplies the Svelte component to mount and the client setting its dragged position
 * persists to; its static `sync()` calls {@link refresh} with the show condition. The component
 * receives `{ app }` and drives the actual behavior.
 */
export abstract class FloatingToolbarApp extends ApplicationV2 {
  protected abstract readonly component: Component<{ app: FloatingToolbarApp }>;
  protected abstract readonly positionSetting: string;

  #component?: ReturnType<typeof mount>;
  #root?: HTMLElement;
  sceneId?: string;

  /** Render `id`'s toolbar bound to `scene` when `show`, close it otherwise. Safe to call repeatedly. */
  protected static refresh(
    id: string,
    factory: () => FloatingToolbarApp,
    show: boolean,
    scene: Scene | null,
  ): void {
    let inst = live.get(id) ?? null;
    if (!show || !scene) {
      void inst?.close();
      live.delete(id);
      return;
    }
    // A different bound scene needs a fresh component.
    if (inst && inst.sceneId !== scene.id) {
      void inst.close();
      inst = null;
    }
    if (!inst) {
      inst = factory();
      live.set(id, inst);
    }
    inst.sceneId = scene.id;
    if (!inst.rendered) {
      const app = inst;
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

    const saved = game.settings.get(MODULE_ID, this.positionSetting) as Partial<SavedPosition>;
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
    void game.settings.set(MODULE_ID, this.positionSetting, { left, top });
  }

  protected override async _renderHTML(): Promise<HTMLElement> {
    if (!this.#component) {
      this.#root = document.createElement('div');
      this.#component = mount(this.component, { target: this.#root, props: { app: this } });
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
    live.delete(this.options.id);
  }
}
