<script lang="ts">
  import { MODULE_ID } from '../constants';
  import type { FloatingToolbarApp } from './FloatingToolbarApp';
  import { OfferDialogApp } from './OfferDialogApp';
  import { toolbarDrag } from './toolbarDrag.svelte';

  let { app }: { app: FloatingToolbarApp } = $props();
  const drag = toolbarDrag(() => app);

  const t = (key: string): string => game.i18n.localize(`${MODULE_ID}.${key}`);
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
  <button type="button" title={t('offer.buttonHint')} onclick={() => OfferDialogApp.open()}>
    <i class="fa-solid fa-scroll"></i>
    <span>{t('offer.button')}</span>
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
    gap: 0.4rem;
    padding: 0.25rem 0.6rem;
    border: 1px solid transparent;
    border-radius: 4px;
    background: #ffffff10;
    color: #e8e8f0;
    font-size: 0.8rem;
    line-height: 1;
    cursor: pointer;
    white-space: nowrap;
  }
  button:hover {
    background: color-mix(in srgb, var(--pf2e-netherworld-accent) 30%, transparent);
    border-color: var(--pf2e-netherworld-accent);
    color: #fff;
  }
  button i {
    font-size: 0.9em;
    opacity: 0.9;
  }
</style>
