<script lang="ts">
  import { tick } from 'svelte';
  import { MODULE_ID, ENABLED_FLAG } from '../constants';
  import type { NetherWorldApp } from './NetherWorldApp';

  let { app }: { app: NetherWorldApp } = $props();

  const t = (key: string): string => game.i18n.localize(`${MODULE_ID}.${key}`);

  type Row = { id: string; name: string; enabled: boolean; baseline: boolean };
  type Tab = 'scene' | 'all';

  const activeScene = canvas.scene ?? null;
  const activeId = activeScene?.id ?? null;

  const toRow = (s: Scene): Row => {
    const enabled = Boolean(s.getFlag(MODULE_ID, ENABLED_FLAG));
    return { id: s.id, name: s.name, enabled, baseline: enabled };
  };

  // Navigable scenes are the pickable set; the active scene joins them even if it's off-nav, so the
  // This Scene tab can always toggle wherever you're standing.
  const scenes = game.scenes.filter((s) => s.navigation);
  if (activeScene && !scenes.some((s) => s.id === activeScene.id)) scenes.push(activeScene);

  // Snapshot each scene's saved flag; `baseline` lets the footer and save apply only the diff. Both
  // tabs bind to these same rows, so a This Scene toggle stages straight into the All Scenes list.
  let rows = $state<Row[]>(scenes.map(toRow).sort((a, b) => a.name.localeCompare(b.name)));

  let tab = $state<Tab>('scene');
  let search = $state('');
  let saving = $state(false);

  const activeRow = $derived(rows.find((r) => r.id === activeId) ?? null);
  const needle = $derived(search.trim().toLowerCase());
  // Checked scenes bypass the filter so the current selection stays visible while searching.
  const filtered = $derived(
    needle ? rows.filter((r) => r.enabled || r.name.toLowerCase().includes(needle)) : rows,
  );
  const dirty = $derived(rows.some((r) => r.enabled !== r.baseline));

  // The window is height:'auto'; tabs differ in height, so re-fit the frame once the DOM has swapped.
  async function selectTab(next: Tab): Promise<void> {
    if (next === tab) return;
    tab = next;
    await tick();
    app.setPosition({ height: 'auto' });
  }

  async function save(): Promise<void> {
    if (saving) return;
    saving = true;
    try {
      for (const row of rows) {
        if (row.enabled === row.baseline) continue;
        const scene = game.scenes.get(row.id);
        if (!scene) continue;
        if (row.enabled) await scene.setFlag(MODULE_ID, ENABLED_FLAG, true);
        else await scene.unsetFlag(MODULE_ID, ENABLED_FLAG);
        row.baseline = row.enabled;
      }
      ui.notifications.info(t('notifications.saved'));
    } finally {
      saving = false;
    }
    // Reached only on success — a thrown write skips this and leaves the dialog open to retry.
    await app.close();
  }
</script>

<div class="netherworld">
  <nav class="tabs">
    <button type="button" class:active={tab === 'scene'} onclick={() => selectTab('scene')}>
      {t('app.tabs.scene')}
    </button>
    <button type="button" class:active={tab === 'all'} onclick={() => selectTab('all')}>
      {t('app.tabs.all')}
    </button>
  </nav>

  {#if tab === 'scene'}
    <div class="this-scene">
      {#if activeRow}
        <label class="toggle" class:on={activeRow.enabled}>
          <input type="checkbox" bind:checked={activeRow.enabled} />
          <span class="meta">
            <strong class="name">{activeRow.name}</strong>
            <span class="state">{activeRow.enabled ? t('app.thisScene.on') : t('app.thisScene.off')}</span>
          </span>
        </label>
      {:else}
        <p class="empty">{t('app.thisScene.none')}</p>
      {/if}
    </div>
  {:else}
    <input
      class="filter"
      type="search"
      bind:value={search}
      placeholder={t('app.search')}
      aria-label={t('app.search')}
    />
    <ul class="scenes">
      {#each filtered as row (row.id)}
        <li class:active={row.id === activeId}>
          <label>
            <input type="checkbox" bind:checked={row.enabled} />
            <span class="name">{row.name}</span>
          </label>
          {#if row.id === activeId}<span class="badge">{t('app.active')}</span>{/if}
        </li>
      {:else}
        <li class="empty">{rows.length ? t('app.noMatches') : t('app.empty')}</li>
      {/each}
    </ul>
  {/if}

  <footer>
    <button type="button" onclick={() => app.close()}>{t('app.cancel')}</button>
    <button type="button" class="save" disabled={!dirty || saving} onclick={save}>
      {t('app.save')}
    </button>
  </footer>
</div>

<style>
  .netherworld {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem;
  }
  .tabs {
    flex: 0 0 auto;
    display: flex;
    gap: 0.25rem;
  }
  .tabs button {
    flex: 1 1 0;
    padding: 0.3rem 0.5rem;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    opacity: 0.7;
  }
  .tabs button.active {
    opacity: 1;
    font-weight: 600;
    border-bottom-color: var(--pf2e-netherworld-accent);
  }
  .this-scene {
    flex: 0 1 auto;
    display: flex;
    justify-content: center;
    padding: 1rem 0.5rem;
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 1rem;
    border: 1px solid var(--color-border-light-tertiary, #00000033);
    border-radius: 6px;
    cursor: pointer;
  }
  .toggle.on {
    border-color: var(--pf2e-netherworld-accent);
    background: color-mix(in srgb, var(--pf2e-netherworld-accent) 12%, transparent);
  }
  .toggle input {
    width: 1.25rem;
    height: 1.25rem;
  }
  .toggle .meta {
    display: flex;
    flex-direction: column;
  }
  .toggle .state {
    font-size: 0.8rem;
    opacity: 0.75;
  }
  .filter {
    flex: 0 0 auto;
  }
  .scenes {
    --row-height: 2rem;
    box-sizing: border-box;
    flex: 0 1 auto;
    /* Show at most 8 rows (+2px for the container's own border), then scroll. */
    max-height: calc(8 * var(--row-height) + 2px);
    overflow-y: auto;
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid var(--color-border-light-tertiary, #00000033);
    border-radius: 4px;
  }
  .scenes li {
    box-sizing: border-box;
    height: var(--row-height);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0 0.5rem;
    border-bottom: 1px solid var(--color-border-light-tertiary, #00000022);
  }
  .scenes li:last-child {
    border-bottom: none;
  }
  .scenes li.active {
    background: color-mix(in srgb, var(--pf2e-netherworld-accent) 12%, transparent);
  }
  .scenes label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1 1 auto;
    cursor: pointer;
  }
  .scenes .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .empty {
    justify-content: center;
    opacity: 0.7;
    font-style: italic;
  }
  .badge {
    flex: 0 0 auto;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    color: #fff;
    background: var(--pf2e-netherworld-accent);
  }
  footer {
    flex: 0 0 auto;
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  .save {
    font-weight: 600;
  }
</style>
