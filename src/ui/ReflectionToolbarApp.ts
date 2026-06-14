import type { Component } from 'svelte';
import { HALL_OF_REFLECTIONS_SCENE_ID, REFLECTION_TOOLBAR_POSITION_SETTING } from '../constants';
import { FloatingToolbarApp } from './FloatingToolbarApp';
import ReflectionToolbar from './ReflectionToolbar.svelte';

/** A GM-only Create-Reflection button, shown only on the Hall of Reflections scene. */
export class ReflectionToolbarApp extends FloatingToolbarApp {
  static override DEFAULT_OPTIONS = {
    id: 'pf2e-netherworld-reflection-toolbar',
    tag: 'div',
    classes: ['pf2e-netherworld', 'reflection-toolbar'],
    window: { frame: false, positioned: true },
    position: { width: 'auto' as const, height: 'auto' as const },
  };

  protected readonly component = ReflectionToolbar as Component<{ app: FloatingToolbarApp }>;
  protected readonly positionSetting = REFLECTION_TOOLBAR_POSITION_SETTING;

  static sync(): void {
    const scene = canvas.scene;
    this.refresh(
      this.DEFAULT_OPTIONS.id,
      () => new ReflectionToolbarApp(),
      game.user.isGM && scene?.id === HALL_OF_REFLECTIONS_SCENE_ID,
      scene,
    );
  }
}
