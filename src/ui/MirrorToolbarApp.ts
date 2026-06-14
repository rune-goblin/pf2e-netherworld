import type { Component } from 'svelte';
import { TOOLBAR_POSITION_SETTING } from '../constants';
import { isMirrorScene } from '../mirror';
import { FloatingToolbarApp } from './FloatingToolbarApp';
import MirrorToolbar from './MirrorToolbar.svelte';

/**
 * The dark-mirror overlay palette (intact/cracked/broken), shown to the GM only on a mirror scene.
 * It drives nothing itself — the Svelte component reads/writes tile state.
 */
export class MirrorToolbarApp extends FloatingToolbarApp {
  static override DEFAULT_OPTIONS = {
    id: 'pf2e-netherworld-mirror-toolbar',
    tag: 'div',
    classes: ['pf2e-netherworld', 'mirror-toolbar'],
    window: { frame: false, positioned: true },
    position: { width: 'auto' as const, height: 'auto' as const },
  };

  protected readonly component = MirrorToolbar as Component<{ app: FloatingToolbarApp }>;
  protected readonly positionSetting = TOOLBAR_POSITION_SETTING;

  static sync(): void {
    const scene = canvas.scene;
    this.refresh(
      this.DEFAULT_OPTIONS.id,
      () => new MirrorToolbarApp(),
      game.user.isGM && isMirrorScene(scene),
      scene,
    );
  }
}
