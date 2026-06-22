<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import type { ActorPF2e } from 'foundry-pf2e';
  import { MODULE_ID } from '../constants';
  import {
    reflectionCombatants, mirroredActions, castMirroredSpell, rollMirroredStrike, postMirroredAction,
    type MirroredAction,
  } from '../reflection';
  import type { FloatingToolbarApp } from './FloatingToolbarApp';
  import { toolbarDrag } from './toolbarDrag.svelte';

  let { app }: { app: FloatingToolbarApp } = $props();
  const drag = toolbarDrag(() => app);

  const t = (key: string): string => game.i18n.localize(`${MODULE_ID}.${key}`);

  // Foundry documents aren't reactive to Svelte; combat hooks bump this to recompute the roster.
  let version = $state(0);
  let expandedId = $state<string | null>(null);
  // The expanded reflection's captured actions, re-read on expand and whenever the combat updates.
  let actions = $state<MirroredAction[]>([]);
  const done = new SvelteSet<string>();
  let busy = $state(false);

  const reflections = $derived.by<ActorPF2e[]>(() => {
    void version;
    return reflectionCombatants();
  });

  function snapshot(): void {
    const reflection = expandedId ? reflections.find((a) => a.id === expandedId) : null;
    actions = reflection ? mirroredActions(reflection) : [];
  }

  function toggle(reflection: ActorPF2e): void {
    if (expandedId === reflection.id) {
      expandedId = null;
      actions = [];
      return;
    }
    expandedId = reflection.id;
    done.clear();
    snapshot();
  }

  function refresh(): void {
    done.clear();
    snapshot();
  }

  onMount(() => {
    const roster = (): void => {
      version += 1;
    };
    // Combat updates cover turn changes and a capture being written (a combat-flag update), so re-read
    // the panel. Ticks persist — `done` is keyed by message id, and a new round's actions are new ids.
    const sync = (): void => {
      version += 1;
      snapshot();
    };
    Hooks.on('createCombatant', roster);
    Hooks.on('deleteCombatant', roster);
    Hooks.on('updateCombat', sync);
    return () => {
      Hooks.off('createCombatant', roster);
      Hooks.off('deleteCombatant', roster);
      Hooks.off('updateCombat', sync);
    };
  });

  function detail(a: MirroredAction): string {
    if (a.kind === 'spell') return a.rank ? game.i18n.format(`${MODULE_ID}.reflectActions.rank`, { rank: a.rank }) : '';
    return a.map === 1 ? t('reflectActions.map1') : a.map === 2 ? t('reflectActions.map2') : '';
  }

  async function run(reflection: ActorPF2e, a: MirroredAction): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      const ok = a.kind === 'spell'
        ? await castMirroredSpell(reflection, a.message)
        : a.kind === 'strike'
          ? await rollMirroredStrike(reflection, a.message)
          : await postMirroredAction(reflection, a.message);
      if (ok) done.add(a.message.id);
    } finally {
      busy = false;
    }
  }
</script>

<div class="panel" class:dragging={drag.dragging}>
  <header>
    <i
      class="grip fa-solid fa-grip-vertical"
      role="presentation"
      title={t('mirror.drag')}
      onpointerdown={drag.start}
      onpointermove={drag.move}
      onpointerup={drag.end}
    ></i>
    <span class="title">{t('reflectActions.title')}</span>
  </header>

  {#if reflections.length === 0}
    <p class="empty">{t('reflectActions.empty')}</p>
  {:else}
    <ul class="reflections">
      {#each reflections as reflection (reflection.id)}
        {@const open = expandedId === reflection.id}
        <li>
          <div class="row">
            <button type="button" class="name" class:open onclick={() => toggle(reflection)}>
              <i class="fa-solid {open ? 'fa-caret-down' : 'fa-caret-right'}"></i>
              <span>{reflection.name}</span>
            </button>
            {#if open}
              <button type="button" class="refresh" title={t('reflectActions.refresh')} onclick={refresh}>
                <i class="fa-solid fa-rotate-right"></i>
              </button>
            {/if}
          </div>

          {#if open}
            {#if actions.length === 0}
              <p class="empty nested">{t('reflectActions.noActions')}</p>
            {:else}
              <ul class="actions">
                {#each actions as a (a.message.id)}
                  <li>
                    <button
                      type="button"
                      class="action"
                      class:done={done.has(a.message.id)}
                      disabled={busy}
                      title={t(`reflectActions.${a.kind}Hint`)}
                      onclick={() => run(reflection, a)}
                    >
                      <i class="fa-solid {done.has(a.message.id) ? 'fa-check' : a.kind === 'spell' ? 'fa-wand-sparkles' : a.kind === 'strike' ? 'fa-gavel' : 'fa-bolt'}"></i>
                      <span class="label">{a.name}</span>
                      {#if detail(a)}<span class="meta">{detail(a)}</span>{/if}
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 200px;
    max-width: 280px;
    padding: 0.3rem;
    border-radius: 6px;
    background: color-mix(in srgb, #0b0b14 90%, transparent);
    border: 1px solid color-mix(in srgb, var(--pf2e-netherworld-accent) 55%, #000);
    box-shadow: 0 2px 10px #000a;
    backdrop-filter: blur(3px);
    user-select: none;
    color: #e8e8f0;
  }
  header {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .grip {
    padding: 0 0.2rem;
    color: #ffffff80;
    cursor: grab;
    touch-action: none;
  }
  .panel.dragging .grip {
    cursor: grabbing;
  }
  .grip:hover {
    color: #fff;
  }
  .title {
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .reflections > li + li {
    margin-top: 0.15rem;
  }
  .row {
    display: flex;
    gap: 0.15rem;
  }
  /* Scoped under .panel to outrank Foundry's core `.application button` rule, which otherwise
     centers our left-aligned rows (same specificity → core wins on source order). */
  .panel button {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.4rem;
    border: 1px solid transparent;
    border-radius: 4px;
    background: #ffffff10;
    color: inherit;
    font-size: 0.78rem;
    line-height: 1.1;
    text-align: left;
    justify-content: flex-start;
    cursor: pointer;
  }
  .panel button:hover:not(:disabled) {
    background: #ffffff1f;
  }
  .panel button:disabled {
    opacity: 0.6;
    cursor: progress;
  }
  .name {
    flex: 1;
  }
  .name.open {
    border-color: color-mix(in srgb, var(--pf2e-netherworld-accent) 60%, #000);
    background: color-mix(in srgb, var(--pf2e-netherworld-accent) 28%, transparent);
    color: #fff;
  }
  .refresh {
    flex: none;
  }
  .actions {
    margin: 0.15rem 0 0.1rem 0.6rem;
    padding-left: 0.4rem;
    border-left: 1px solid #ffffff1f;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .action {
    width: 100%;
  }
  .action.done {
    opacity: 0.55;
  }
  .action.done .label {
    text-decoration: line-through;
  }
  .action .label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .action .meta {
    flex: none;
    opacity: 0.6;
    font-size: 0.72rem;
  }
  button i {
    flex: none;
    width: 0.9em;
    text-align: center;
    opacity: 0.85;
  }
  .empty {
    margin: 0.1rem 0.2rem;
    font-size: 0.74rem;
    font-style: italic;
    opacity: 0.7;
  }
  .empty.nested {
    margin-left: 0.7rem;
  }
</style>
