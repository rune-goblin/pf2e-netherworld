<script lang="ts">
  import { onMount } from 'svelte';
  import { MODULE_ID } from '../constants';
  import {
    MIRROR_STATES, currentState, setMirrorState, type MirrorState,
    COFFIN_STATES, currentCoffinState, setCoffinState, type CoffinState,
  } from '../mirror';
  import type { FloatingToolbarApp } from './FloatingToolbarApp';
  import { toolbarDrag } from './toolbarDrag.svelte';

  let { app }: { app: FloatingToolbarApp } = $props();
  const drag = toolbarDrag(() => app);

  const t = (key: string): string => game.i18n.localize(`${MODULE_ID}.${key}`);

  const MIRROR_ICON: Record<MirrorState, string> = {
    intact: 'fa-gem',
    cracked: 'fa-bolt',
    broken: 'fa-burst',
  };
  const COFFIN_ICON: Record<CoffinState, string> = {
    intact: 'fa-box-archive',
    cracked: 'fa-bolt',
    smashed: 'fa-skull-crossbones',
  };

  const scene = canvas.scene as Scene;
  let mirror = $state<MirrorState>(currentState(scene));
  let coffin = $state<CoffinState>(currentCoffinState(scene));

  // A tile's visibility can flip from elsewhere (another GM, undo); keep both highlights honest.
  onMount(() => {
    const refresh = (doc: TileDocument<Scene>): void => {
      if (doc.parent?.id !== scene.id) return;
      mirror = currentState(scene);
      coffin = currentCoffinState(scene);
    };
    Hooks.on('updateTile', refresh);
    return () => Hooks.off('updateTile', refresh);
  });

  async function chooseMirror(next: MirrorState): Promise<void> {
    mirror = next;
    await setMirrorState(scene, next);
  }
  async function chooseCoffin(next: CoffinState): Promise<void> {
    coffin = next;
    await setCoffinState(scene, next);
  }
</script>

<div class="bar" class:dragging={drag.dragging}>
  <i
    class="grip fa-solid fa-grip-vertical"
    role="presentation"
    title={t('mirror.drag')}
    onpointerdown={drag.start}
    onpointermove={drag.move}
    onpointerup={drag.end}
  ></i>
  <div class="rows">
    <div class="row">
      <span class="label">{t('mirror.title')}</span>
      {#each MIRROR_STATES as s (s)}
        <button
          type="button"
          class:active={mirror === s}
          title={t(`mirror.${s}.hint`)}
          onclick={() => chooseMirror(s)}
        >
          <i class="fa-solid {MIRROR_ICON[s]}"></i>
          <span>{t(`mirror.${s}.label`)}</span>
        </button>
      {/each}
    </div>
    <div class="row">
      <span class="label">{t('coffin.title')}</span>
      {#each COFFIN_STATES as s (s)}
        <button
          type="button"
          class:active={coffin === s}
          title={t(`coffin.${s}.hint`)}
          onclick={() => chooseCoffin(s)}
        >
          <i class="fa-solid {COFFIN_ICON[s]}"></i>
          <span>{t(`coffin.${s}.label`)}</span>
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .bar {
    display: flex;
    align-items: stretch;
    gap: 0.25rem;
    padding: 0.25rem;
    border-radius: 6px;
    background: color-mix(in srgb, #0b0b14 88%, transparent);
    border: 1px solid color-mix(in srgb, var(--pf2e-netherworld-accent) 55%, #000);
    box-shadow: 0 2px 10px #000a;
    backdrop-filter: blur(3px);
    user-select: none;
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .row {
    display: flex;
    align-items: stretch;
    gap: 0.25rem;
  }
  .label {
    display: flex;
    align-items: center;
    min-width: 3.25rem;
    padding: 0 0.15rem;
    font-size: 0.68rem;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: #ffffffa0;
  }
  .grip {
    display: flex;
    align-items: center;
    padding: 0 0.3rem;
    color: #ffffff80;
    cursor: grab;
    touch-action: none;
  }
  .bar.dragging .grip {
    cursor: grabbing;
  }
  .grip:hover {
    color: #fff;
  }
  button {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid transparent;
    border-radius: 4px;
    background: #ffffff10;
    color: #e8e8f0;
    font-size: 0.78rem;
    line-height: 1;
    cursor: pointer;
    white-space: nowrap;
  }
  button:hover {
    background: #ffffff1f;
  }
  button.active {
    border-color: var(--pf2e-netherworld-accent);
    background: color-mix(in srgb, var(--pf2e-netherworld-accent) 30%, transparent);
    color: #fff;
  }
  button i {
    font-size: 0.85em;
    opacity: 0.85;
  }
</style>
