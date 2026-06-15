import type { Component } from 'svelte';
import { HALL_OF_REFLECTIONS_SCENE_ID, REFLECT_ACTIONS_TOOLBAR_POSITION_SETTING } from '../constants';
import { reflectionCombatants } from '../reflection';
import { FloatingToolbarApp } from './FloatingToolbarApp';
import ReflectActionsToolbar from './ReflectActionsToolbar.svelte';

/**
 * GM-only panel for running Reflection turns: while an encounter is live and at least one
 * Reflection is fighting in it, lists those Reflections and replays each one's source PC's
 * previous-round actions from its own stat block.
 */
export class ReflectActionsToolbarApp extends FloatingToolbarApp {
  static override DEFAULT_OPTIONS = {
    id: 'pf2e-netherworld-reflect-actions-toolbar',
    tag: 'div',
    classes: ['pf2e-netherworld', 'reflect-actions-toolbar'],
    window: { frame: false, positioned: true },
    position: { width: 'auto' as const, height: 'auto' as const },
  };

  protected readonly component = ReflectActionsToolbar as Component<{ app: FloatingToolbarApp }>;
  protected readonly positionSetting = REFLECT_ACTIONS_TOOLBAR_POSITION_SETTING;
  protected static override readonly sceneIds = [HALL_OF_REFLECTIONS_SCENE_ID];

  static sync(): void {
    const scene = canvas.scene;
    this.refresh(
      this.DEFAULT_OPTIONS.id,
      () => new ReflectActionsToolbarApp(),
      this.visibleOn(scene) && Boolean(game.combat?.started) && reflectionCombatants().length > 0,
      scene,
    );
  }
}
