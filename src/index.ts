import './styles.css';
import type { ChatMessagePF2e } from 'foundry-pf2e';
import {
  MODULE_ID, ENABLED_FLAG, TOOLBAR_POSITION_SETTING, REFLECTION_TOOLBAR_POSITION_SETTING,
  REFLECT_ACTIONS_TOOLBAR_POSITION_SETTING, OFFER_TOOLBAR_POSITION_SETTING, ADVENTURE_UUID,
  INTRO_JOURNAL_ID,
} from './constants';
import { installLightPatch, registerSceneSync, setNetherworld } from './lightPatch';
import { NetherWorldApp } from './ui/NetherWorldApp';
import { MirrorToolbarApp } from './ui/MirrorToolbarApp';
import { ReflectionToolbarApp } from './ui/ReflectionToolbarApp';
import { ReflectActionsToolbarApp } from './ui/ReflectActionsToolbarApp';
import { OfferToolbarApp } from './ui/OfferToolbarApp';
import { OfferDialogApp } from './ui/OfferDialogApp';
import { setMirrorState, type MirrorState } from './mirror';
import { makeShadow } from './shadow';
import { impalingChain, onSacramentStrike, tearWoundOnInitiative } from './sacrament';
import { captureSourceAction, clearCaptures } from './reflection';

/** Mount/unmount the floating toolbars for the current canvas and combat state. */
function syncToolbars(): void {
  MirrorToolbarApp.sync();
  ReflectionToolbarApp.sync();
  ReflectActionsToolbarApp.sync();
  OfferToolbarApp.sync();
}

interface ModuleApi {
  version: string;
  open: () => void;
  /** Dim a scene's lights (default: active scene). GM-only. */
  enable: (scene?: Scene | null) => Promise<boolean>;
  /** Restore a scene's lights (default: active scene). GM-only. */
  disable: (scene?: Scene | null) => Promise<boolean>;
  /** Flip a scene's state (default: active scene). GM-only. */
  toggle: (scene?: Scene | null) => Promise<boolean>;
  /** Set the dark-mirror overlay on the active scene. GM-only. */
  mirror: (state: MirrorState) => Promise<void>;
  /** Clone a PC into a hostile Reflection and drop its token on the active scene. GM-only. */
  makeShadow: (pc: Actor) => Promise<Actor | null>;
  /** Open the Interlocutor's offer dialog on this client. */
  offer: () => void;
  /** Fire the Sacrament of Pain's Impaling Chain on an actor: self-damage card + rolled cooldown. */
  impalingChain: (actor: Actor | null | undefined) => Promise<void>;
}

/** GM-gate a scene-flag write, then resolve to the scene's resulting state. Warns and no-ops for players. */
async function setActive(scene: Scene | null, enabled: boolean): Promise<boolean> {
  if (!scene) return false;
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.notifications.gmOnly`));
    return Boolean(scene.getFlag(MODULE_ID, ENABLED_FLAG));
  }
  await setNetherworld(scene, enabled);
  return enabled;
}

/**
 * Open the stock Adventure importer when the bundled adventure hasn't been imported. `core.adventureImports`
 * (Foundry's own per-UUID record) makes this prompt once and never re-nag after import.
 */
async function promptAdventureImport(): Promise<void> {
  if (!game.user.isGM) return;
  const done = game.settings.get('core', 'adventureImports') as Record<string, boolean> | undefined;
  if (done?.[ADVENTURE_UUID]) return;
  const adventure = await fromUuid(ADVENTURE_UUID);
  void (adventure as { sheet?: { render: (options: object) => unknown } } | null)?.sheet?.render({ force: true });
}

// At init so the patch is installed before any scene's lights initialize and the flag listener is
// live for the first update.
Hooks.once('init', () => {
  installLightPatch();
  registerSceneSync();

  game.settings.register(MODULE_ID, TOOLBAR_POSITION_SETTING, {
    name: 'Dark Mirror toolbar position',
    scope: 'client',
    config: false,
    type: Object,
    default: {},
  });

  game.settings.register(MODULE_ID, REFLECTION_TOOLBAR_POSITION_SETTING, {
    name: 'Reflection toolbar position',
    scope: 'client',
    config: false,
    type: Object,
    default: {},
  });

  game.settings.register(MODULE_ID, REFLECT_ACTIONS_TOOLBAR_POSITION_SETTING, {
    name: 'Reflect-actions panel position',
    scope: 'client',
    config: false,
    type: Object,
    default: {},
  });

  game.settings.register(MODULE_ID, OFFER_TOOLBAR_POSITION_SETTING, {
    name: 'Show-offer toolbar position',
    scope: 'client',
    config: false,
    type: Object,
    default: {},
  });

  // One scene-load hook gates the toolbars: each mounts on its scene and unmounts on leave.
  Hooks.on('canvasReady', () => syncToolbars());

  // The panel is combat-gated; updateCombat covers the start/round/turn transitions combatStart misses
  // (without it the panel didn't appear until a reload).
  for (const event of ['combatStart', 'updateCombat', 'deleteCombat', 'createCombatant', 'deleteCombatant']) {
    Hooks.on(event, () => syncToolbars());
  }

  // Capture each original's actions onto the active combat as they happen; wipe on a new encounter.
  Hooks.on('createChatMessage', (message: ChatMessagePF2e) => captureSourceAction(message));

  // The Sacrament of Pain's recoil rides its own Strike: striking posts the self-damage card and rolls
  // the recharge, so the bearer never reaches for a separate macro.
  Hooks.on('createChatMessage', (message: ChatMessagePF2e) => onSacramentStrike(message));
  Hooks.on('combatStart', (combat: Combat) => void clearCaptures(combat));

  // The Sacrament's wound reopens the instant its bearer rolls initiative.
  Hooks.on('updateCombatant', (combatant: Combatant, changed: Record<string, unknown>) =>
    void tearWoundOnInitiative(combatant, changed));

  // Open the intro journal the moment the import creates it. keepId preserves its id, so this fires once.
  Hooks.on('createJournalEntry', (entry: JournalEntry) => {
    if (game.user.isGM && entry.id === INTRO_JOURNAL_ID) void entry.sheet?.render(true);
  });

  // The settings menu button opens NetherWorldApp directly; `restricted` keeps it GM-only.
  game.settings.registerMenu(MODULE_ID, 'picker', {
    name: `${MODULE_ID}.settings.picker.name`,
    label: `${MODULE_ID}.settings.picker.label`,
    hint: `${MODULE_ID}.settings.picker.hint`,
    icon: 'fa-solid fa-moon',
    type: NetherWorldApp,
    restricted: true,
  });

  console.log(`${MODULE_ID} | init`);
});

Hooks.once('ready', () => {
  const module = game.modules.get(MODULE_ID);
  const version = module?.version ?? '0.0.0';
  const api: ModuleApi = {
    version,
    open: () => void NetherWorldApp.open(),
    enable: (scene = canvas.scene) => setActive(scene, true),
    disable: (scene = canvas.scene) => setActive(scene, false),
    toggle: (scene = canvas.scene) => setActive(scene, !scene?.getFlag(MODULE_ID, ENABLED_FLAG)),
    mirror: (state) => canvas.scene ? setMirrorState(canvas.scene, state) : Promise.resolve(),
    makeShadow,
    offer: () => void OfferDialogApp.open(),
    impalingChain,
  };
  // `api` is Foundry's public-API convention but isn't typed on Module.
  if (module) (module as { api?: ModuleApi }).api = api;

  // Every client listens so the GM's "Send to Players" can drive the offer card remotely.
  OfferDialogApp.register();

  // canvasReady usually fires before this, but covers a code reload while a scene is already up.
  syncToolbars();
  void promptAdventureImport();
  console.log(`${MODULE_ID} | ready (v${version})`);
});
