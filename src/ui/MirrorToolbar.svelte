<script lang="ts">
  import { onMount } from 'svelte';
  import { MODULE_ID } from '../constants';
  import { MIRROR_STATES, currentState, setMirrorState, type MirrorState } from '../mirror';
  import type { MirrorToolbarApp } from './MirrorToolbarApp';

  let { app }: { app: MirrorToolbarApp } = $props();

  const t = (key: string): string => game.i18n.localize(`${MODULE_ID}.${key}`);

  const ICON: Record<MirrorState, string> = {
    intact: 'fa-gem',
    cracked: 'fa-bolt',
    broken: 'fa-burst',
  };

  const scene = canvas.scene as Scene;
  let current = $state<MirrorState>(currentState(scene));

  // A tile's visibility can flip from elsewhere (another GM, undo); keep the highlight honest.
  onMount(() => {
    const refresh = (doc: TileDocument<Scene>): void => {
      if (doc.parent?.id === scene.id) current = currentState(scene);
    };
    Hooks.on('updateTile', refresh);
    return () => Hooks.off('updateTile', refresh);
  });

  async function choose(next: MirrorState): Promise<void> {
    current = next;
    await setMirrorState(scene, next);
  }

  let dragging = $state(false);
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  function dragStart(e: PointerEvent): void {
    dragging = true;
    const rect = app.element.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function dragMove(e: PointerEvent): void {
    if (!dragging) return;
    app.setPosition({ left: startLeft + (e.clientX - startX), top: startTop + (e.clientY - startY) });
  }

  function dragEnd(e: PointerEvent): void {
    if (!dragging) return;
    dragging = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    app.savePosition();
  }
</script>

<div class="bar" class:dragging>
  <i
    class="grip fa-solid fa-grip-vertical"
    role="presentation"
    title={t('mirror.drag')}
    onpointerdown={dragStart}
    onpointermove={dragMove}
    onpointerup={dragEnd}
  ></i>
  {#each MIRROR_STATES as s (s)}
    <button
      type="button"
      class:active={current === s}
      title={t(`mirror.${s}.hint`)}
      onclick={() => choose(s)}
    >
      <i class="fa-solid {ICON[s]}"></i>
      <span>{t(`mirror.${s}.label`)}</span>
    </button>
  {/each}
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
