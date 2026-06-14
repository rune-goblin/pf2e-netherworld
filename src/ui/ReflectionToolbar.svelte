<script lang="ts">
  import { MODULE_ID } from '../constants';
  import { makeShadow } from '../shadow';
  import type { FloatingToolbarApp } from './FloatingToolbarApp';
  import { toolbarDrag } from './toolbarDrag.svelte';

  let { app }: { app: FloatingToolbarApp } = $props();
  const drag = toolbarDrag(() => app);

  const t = (key: string): string => game.i18n.localize(`${MODULE_ID}.${key}`);

  let busy = $state(false);

  // Selected PC tokens, else the whole party — so the GM can reflect a chosen few or all at once.
  function targets() {
    const selected = canvas.tokens.controlled
      .map((tk) => tk.actor)
      .filter((a): a is NonNullable<typeof a> => a?.type === 'character');
    return selected.length
      ? selected
      : game.actors.filter((a) => a.type === 'character' && a.hasPlayerOwner);
  }

  async function create(): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      const pcs = targets();
      if (!pcs.length) {
        ui.notifications.warn(t('reflection.noPcs'));
        return;
      }
      let made = 0;
      for (const pc of pcs) {
        if (await makeShadow(pc)) made += 1;
      }
      if (made) ui.notifications.info(game.i18n.format(`${MODULE_ID}.reflection.created`, { count: made }));
    } finally {
      busy = false;
    }
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
  <button type="button" title={t('reflection.hint')} disabled={busy} onclick={create}>
    <i class="fa-solid fa-clone"></i>
    <span>{t('reflection.create')}</span>
  </button>
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
  button:hover:not(:disabled) {
    background: #ffffff1f;
  }
  button:disabled {
    opacity: 0.6;
    cursor: progress;
  }
  button i {
    font-size: 0.85em;
    opacity: 0.85;
  }
</style>
