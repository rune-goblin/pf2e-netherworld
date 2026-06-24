<script lang="ts">
  import { onMount } from 'svelte';
  import { MODULE_ID } from '../constants';
  import {
    resolveOfferItems,
    buildOfferCard,
    buildOfferCardFromParts,
    type OfferBlockKind,
    type OfferParts,
  } from '../offer';
  import { offerStore } from './offerStore.svelte';
  import type { OfferDialogApp } from './OfferDialogApp';

  let { app }: { app: OfferDialogApp } = $props();

  const t = (key: string): string => game.i18n.localize(`${MODULE_ID}.${key}`);
  const isGM = game.user.isGM;

  // TEMP draft-editing mode: while DRAFT_MODE is true the GM's cards render from OFFER_DRAFTS below
  // instead of the item descriptions, so edits here hot-swap into the open dialog (or show on reopen)
  // without rebuilding the pack or re-importing. Each card is named sections — description / gift /
  // cost / finale — and finale applies only in the final battle against Veyrin. When the copy is
  // final, the text moves back into packs/_source/items/*.json and this whole block is deleted.
  const DRAFT_MODE = true;
  const OFFER_DRAFTS: Record<string, OfferParts> = {
    nwStolenSight001: {
    description: `<p>The Shaper of Ecstasy embeds a nether-forged mechanical eye in place of one of your own.</p>`,
    abilities: [
      {
        name: 'The Dark Holds No Secrets',
        kind: 'boon',
        effect: `<p>You permanently gain Greater Darkvision and @UUID[Compendium.pf2e.spell-effects.Item.T5bk6UH7yuYog1Fp]{See the Unseen}: invisible creatures are merely concealed to you.</p>`,
      },
      {
        name: 'Revealing Gaze',
        kind: 'finale',
        actions: 1,
        effect: `<p>During the final battle, Veyrin cannot be concealed from you by shadows. You can cast @UUID[Compendium.pf2e.spells-srd.Item.0qaqksrGGDj74HXE]{Revealing Light}; once you do, you cannot do so again for 1d4 rounds.</p>`,
      },
      {
        name: 'Wither in the Light',
        kind: 'cost',
        effect: `<p>While in natural sunlight you are <strong>@UUID[Compendium.pf2e.conditionitems.Item.4D2KBtexWXa6oUMR]{Drained 1}</strong> and <strong>@UUID[Compendium.pf2e.conditionitems.Item.3uh1r86TzbQvosxv]{Doomed 1}</strong>.</p>`,
      },
    ],
  },
  nwShroudOfName01: {
    description: `<p>Your soul is interwoven with the cold of the void. The Shaper of Ecstasy took your name in exchange.</p>`,
    abilities: [
      {
        name: 'Bound by Cold',
        kind: 'boon',
        effect: `<p>You gain permanent resistance 10 to cold.</p>`,
      },
      {
        name: 'The Name Given to the Dark',
        kind: 'cost',
        effect: `<p>The world forgets you: you take a permanent &minus;2 status penalty to Diplomacy. Those who were closest to you have the feeling they know you from somewhere. You may take a new name.</p>`,
      },
      {
        name: 'The Cold Does Not Bite Its Own',
        kind: 'finale',
        effect: `<p>You and your party ignore the Queen of Shadows' bone-chilling rime.</p>`,
      },
    ],
  },
  nwSurgeonsGraft1: {
    description: `<p>The shaper of ecstasy buries a serpentine spiked chain into your chest cavity. You may call upon it to strike your foes.</p>`,
    abilities: [
      {
        name: 'Impaling Chain',
        kind: 'boon',
        actions: 1,
        effect: `<p>A <strong>+2 greater striking wounding cold iron</strong> bursts out of your body to strike.</p>
<p>When you strike with the chain you take 1d8 piercing damage as it tears free. Then you cannot use it again for 1d4 rounds. A critical with the chain applies
  @UUID[Compendium.pf2e-netherworld.effects.Item.nwImpalingChain1]{Effect: Impaled} to your victim.</p>`,
      },
      {
        name: 'The Wound Never Closes',
        kind: 'cost',
        effect: `<p>When you roll initiative it tears — you take @Damage[1d8[persistent,bleed]] damage (flat DC 15 to end).</p>`,
      },
      {
        name: 'Last Embrace',
        kind: 'finale',
        effect: `<p>Your Strikes ignore Veyrin's physical resistances, and once you draw his blood his fast healing never returns.</p>`,
      },
    ],
  },
  };

  let loading = $state(true);

  const cards = $derived(offerStore.cards);
  const active = $derived(cards.find((c) => c.id === offerStore.activeId) ?? cards[0] ?? null);

  const TAG: Record<OfferBlockKind, { label: string; icon: string } | null> = {
    lede: null,
    note: null,
    boon: { label: 'offer.tag.boon', icon: 'fa-gift' },
    cost: { label: 'offer.tag.cost', icon: 'fa-droplet' },
    action: { label: 'offer.tag.action', icon: 'fa-bolt' },
    finale: { label: 'offer.tag.finale', icon: 'fa-skull' },
  };

  const TRAIT_CLASS: Record<string, string> = {
    cold: 'cold',
    cursed: 'cursed',
    unholy: 'cursed',
    magical: 'magical',
  };

  // Halo tint follows the gift's dominant element.
  const auraTrait = $derived(active?.traits.map((tr) => TRAIT_CLASS[tr]).find(Boolean) ?? 'cursed');

  const lede = $derived(active?.blocks.find((b) => b.kind === 'lede') ?? null);
  // Group by role so the bargain reads gift-before-price regardless of description order. Sort is
  // stable, so two boons keep their authored order.
  const ORDER: Record<OfferBlockKind, number> = {
    lede: 0,
    boon: 1,
    action: 2,
    cost: 3,
    finale: 4,
    note: 5,
  };
  const gifts = $derived(
    [...(active?.blocks ?? [])]
      .filter((b) => b.kind !== 'lede')
      .sort((a, b) => ORDER[a.kind] - ORDER[b.kind]),
  );

  onMount(async () => {
    if (DRAFT_MODE && isGM) {
      // Rebuild from OFFER_DRAFTS on every mount so a hot-swap (or close/reopen) shows the new copy.
      offerStore.cards = await Promise.all(
        resolveOfferItems().map((item) => {
          const parts = OFFER_DRAFTS[item.id];
          return parts ? buildOfferCardFromParts(item, parts) : buildOfferCard(item);
        }),
      );
    } else if (offerStore.cards.length === 0) {
      // The GM's preview starts empty, so build the cards here; a player's client already has them
      // injected from the broadcast (see OfferDialogApp.#receive).
      offerStore.cards = await Promise.all(resolveOfferItems().map((item) => buildOfferCard(item)));
    }
    if (!offerStore.activeId && offerStore.cards[0]) offerStore.activeId = offerStore.cards[0].id;
    loading = false;
  });
</script>

<div class="offer">
  {#if loading}
    <p class="state">{t('offer.loading')}</p>
  {:else if cards.length === 0}
    <p class="state">{t('offer.empty')}</p>
  {:else}
    <nav class="tabs" aria-label={t('offer.title')}>
      {#each cards as card (card.id)}
        <button
          type="button"
          class="tab"
          class:active={active?.id === card.id}
          onclick={() => app.selectTab(card.id)}
        >
          {card.name}
        </button>
      {/each}
    </nav>

    {#if active}
      {#key active.id}
        <article class="card">
          <header class="header">
            <div class="frame" data-aura={auraTrait}>
              <img src={active.img} alt={active.name} />
            </div>
            <div class="info">
              <h2 class="name">{active.name}</h2>
              {#if lede}
                <!-- Trusted: PF2e-enriched item description, not user input. -->
                <div class="lede body">{@html lede.html}</div>
              {/if}
            </div>
          </header>

          <div class="scroll">
            {#each gifts as block, i (i)}
              <section class="block {block.kind}" style="--i: {i}">
                {#if block.name || TAG[block.kind]}
                  <header class="block-head">
                    {#if block.name}
                      <h3 class="ability">
                        {#if block.actions}<span class="action-glyph">{block.actions}</span>{/if}
                        {block.name}
                      </h3>
                    {/if}
                    {#if TAG[block.kind]}
                      <span class="tag">
                        <i class="fa-solid {TAG[block.kind]?.icon}"></i>{t(TAG[block.kind]?.label ?? '')}
                      </span>
                    {/if}
                  </header>
                {/if}
                <!-- Trusted: PF2e-enriched item description, not user input. -->
                <div class="body">{@html block.html}</div>
              </section>
            {/each}
          </div>
        </article>
      {/key}
    {/if}
  {/if}

  <footer>
    <div class="status">
      {#if isGM && offerStore.sharing}
        <span class="live" title={t('offer.liveHint')}><span class="pulse"></span>{t('offer.live')}</span>
      {:else if !isGM}
        <span class="presented">{t('offer.presented')}</span>
      {/if}
    </div>
    <div class="actions">
      <button type="button" class="ghost" onclick={() => app.close()}>{t('offer.close')}</button>
      {#if isGM}
        <button type="button" class="primary" disabled={!active} onclick={() => app.share()}>
          <i class="fa-solid fa-share-from-square"></i>
          {offerStore.sharing ? t('offer.update') : t('offer.send')}
        </button>
      {/if}
    </div>
  </footer>
</div>

<style>
  .offer {
    --gold: #cbb173;
    --blood: #c0413f;
    --ice: #8fcfe0;
    --bone: #e9e3d4;
    --bone-dim: #a9a294;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.85rem 0.95rem 0.95rem;
    color: var(--bone);
    font-family: var(--font-primary, 'Signika', sans-serif);
    background:
      radial-gradient(120% 75% at 50% -10%, color-mix(in srgb, var(--pf2e-netherworld-accent) 22%, transparent), transparent 60%),
      linear-gradient(180deg, #0c0a12, #07060a 70%);
  }
  /* Faint grain so the void reads as aged vellum. */
  .offer::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.5;
    mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E");
  }
  .offer > * {
    position: relative;
  }

  .state {
    padding: 2.5rem 1rem;
    text-align: center;
    font-style: italic;
    color: var(--bone-dim);
  }

  .live,
  .presented {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    letter-spacing: 0.02em;
  }
  .live {
    color: #f0c9c9;
  }
  .presented {
    color: var(--bone-dim);
    font-style: italic;
    font-size: 0.85rem;
  }
  .pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--blood);
    box-shadow: 0 0 8px var(--blood);
    animation: throb 1.6s ease-in-out infinite;
  }
  @keyframes throb {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.7); }
  }

  .tabs {
    display: flex;
    gap: 0.3rem;
    padding-bottom: 0.55rem;
    border-bottom: 1px solid color-mix(in srgb, var(--pf2e-netherworld-accent) 45%, #000);
  }
  .tab {
    flex: 1 1 0;
    min-width: 0;
    padding: 0.55rem 0.85rem;
    border: 1px solid transparent;
    border-radius: 5px 5px 0 0;
    background: #ffffff08;
    color: var(--bone-dim);
    font-family: var(--font-primary, 'Signika', sans-serif);
    font-size: 1.05rem;
    font-weight: 600;
    line-height: 1.2;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    transition: color 0.15s, background 0.15s, box-shadow 0.2s;
  }
  .tab:hover {
    color: var(--bone);
    background: #ffffff12;
  }
  .tab.active {
    color: #fff;
    background: color-mix(in srgb, var(--pf2e-netherworld-accent) 30%, transparent);
    border-color: color-mix(in srgb, var(--pf2e-netherworld-accent) 65%, #000);
    border-bottom-color: transparent;
    box-shadow: 0 -2px 14px color-mix(in srgb, var(--pf2e-netherworld-accent) 45%, transparent);
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .header {
    display: grid;
    grid-template-columns: 188px 1fr;
    gap: 1.3rem;
    align-items: start;
    animation: plate-in 0.5s ease both;
  }
  .info {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
  }

  /* Slow halo (::before) tinted to the gift's element; no border frame. */
  .frame {
    --aura: color-mix(in srgb, var(--blood) 42%, transparent);
    position: relative;
    width: 100%;
    aspect-ratio: 1;
  }
  .frame[data-aura='cold'] {
    --aura: color-mix(in srgb, var(--ice) 40%, transparent);
  }
  .frame[data-aura='magical'] {
    --aura: color-mix(in srgb, var(--pf2e-netherworld-accent) 55%, transparent);
  }
  .frame::before {
    content: '';
    position: absolute;
    inset: 2%;
    z-index: 0;
    pointer-events: none;
    border-radius: 50%;
    background: radial-gradient(58% 58% at 50% 48%, var(--aura), transparent 72%);
    animation: breathe 5.5s ease-in-out infinite;
  }
  .frame img {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 6px 14px #000d);
  }
  .name {
    margin: 0;
    font-family: var(--font-primary, 'Signika', sans-serif);
    font-size: 1.85rem;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: 0;
    color: var(--gold);
    text-shadow: 0 1px 0 #000, 0 0 18px color-mix(in srgb, var(--pf2e-netherworld-accent) 40%, transparent);
  }
  .scroll {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    max-height: min(58vh, 540px);
    overflow-y: auto;
    padding-right: 0.4rem;
  }
  .scroll::-webkit-scrollbar {
    width: 8px;
  }
  .scroll::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--pf2e-netherworld-accent) 50%, #000);
    border-radius: 4px;
  }

  .block {
    position: relative;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    background: #ffffff07;
    border: 1px solid #ffffff12;
    /* Blocks rise in turn (--i is the block's index) so a gift assembles itself when shown. */
    animation: rise 0.5s ease both;
    animation-delay: calc(var(--i, 0) * 70ms + 0.12s);
  }
  /* The lede: large display size, set apart from the body blocks. */
  .lede.body {
    font-family: var(--font-primary, 'Signika', sans-serif);
    font-size: 1.35rem;
    line-height: 1.25;
    color: #ddd6c6;
  }
  .block.boon {
    background: color-mix(in srgb, var(--gold) 9%, #ffffff05);
    border-color: color-mix(in srgb, var(--gold) 30%, transparent);
  }
  .block.cost {
    background: color-mix(in srgb, var(--blood) 10%, #ffffff05);
    border-color: color-mix(in srgb, var(--blood) 32%, transparent);
  }
  .block.action {
    background: color-mix(in srgb, var(--pf2e-netherworld-accent) 13%, #ffffff05);
    border-color: color-mix(in srgb, var(--pf2e-netherworld-accent) 42%, transparent);
  }
  /* The finale: a deeper accent tint and gold-touched border mark it as the climax. */
  .block.finale {
    background: linear-gradient(180deg, color-mix(in srgb, var(--pf2e-netherworld-accent) 16%, transparent), #ffffff05);
    border-color: color-mix(in srgb, var(--gold) 38%, var(--pf2e-netherworld-accent));
  }
  .block-head {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    margin-bottom: 0.4rem;
  }
  .ability {
    margin: 0;
    font-family: var(--font-primary, 'Signika', sans-serif);
    font-size: 1.18rem;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: 0.01em;
    /* Gold title (the divider/tag hue) sets the ability name apart from the white body text. */
    color: var(--gold);
  }
  .ability .action-glyph {
    margin-right: 0.15rem;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    /* Push to the right edge of the head row, and stay on one line beside the ability name. */
    margin-left: auto;
    flex: none;
    align-self: center;
    white-space: nowrap;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.01em;
  }
  .block.boon .tag {
    color: var(--gold);
  }
  .block.cost .tag {
    color: #e88c8c;
  }
  .block.action .tag {
    color: #cdaef0;
  }
  .block.finale .tag {
    color: #e9d8a6;
  }

  .body {
    font-size: 1rem;
    line-height: 1.55;
  }
  .body :global(p) {
    margin: 0 0 0.5rem;
  }
  .body :global(p:last-child) {
    margin-bottom: 0;
  }
  .body :global(strong) {
    color: #fff;
  }
  .body :global(em) {
    color: var(--bone-dim);
  }
  /* PF2e links default to a pale pill; keep them legible on the dark bg. */
  .body :global(a.content-link),
  .body :global(a.inline-roll) {
    background: #00000055;
    border-color: color-mix(in srgb, var(--pf2e-netherworld-accent) 55%, #000);
    color: #ecd9ff;
  }
  .body :global(a.content-link:hover),
  .body :global(a.inline-roll:hover) {
    text-shadow: 0 0 8px color-mix(in srgb, var(--pf2e-netherworld-accent) 80%, transparent);
  }

  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding-top: 0.7rem;
    border-top: 1px solid #ffffff14;
  }
  .status {
    min-height: 1.4rem;
    display: flex;
    align-items: center;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
  }
  footer button {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.45rem 1rem;
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 600;
    letter-spacing: 0;
    cursor: pointer;
  }
  footer .ghost {
    background: #ffffff10;
    border: 1px solid #ffffff20;
    color: var(--bone);
  }
  footer .ghost:hover {
    background: #ffffff1f;
  }
  footer .primary {
    background: linear-gradient(180deg, color-mix(in srgb, var(--pf2e-netherworld-accent) 70%, #fff 8%), var(--pf2e-netherworld-accent));
    border: 1px solid #000;
    color: #fff;
    box-shadow:
      0 0 16px color-mix(in srgb, var(--pf2e-netherworld-accent) 55%, transparent),
      inset 0 1px 0 color-mix(in srgb, var(--gold) 45%, transparent);
    transition: filter 0.15s, box-shadow 0.2s;
  }
  footer .primary:hover:not(:disabled) {
    filter: brightness(1.12);
  }
  footer .primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }

  @keyframes plate-in {
    from { opacity: 0; transform: scale(0.96); filter: blur(5px); }
    to { opacity: 1; transform: none; filter: none; }
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: none; }
  }
  @keyframes breathe {
    0%, 100% { opacity: 0.32; }
    50% { opacity: 0.62; }
  }

  @media (prefers-reduced-motion: reduce) {
    .header,
    .block {
      animation: none;
    }
    .frame::before {
      animation: none;
      opacity: 0.45;
    }
    .pulse {
      animation: none;
    }
  }
</style>
