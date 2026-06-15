import './styles.css';
import type { ChatMessagePF2e } from 'foundry-pf2e';
import {
  MODULE_ID, ENABLED_FLAG, TOOLBAR_POSITION_SETTING, REFLECTION_TOOLBAR_POSITION_SETTING,
  REFLECT_ACTIONS_TOOLBAR_POSITION_SETTING, ADVENTURE_UUID, INTRO_JOURNAL_ID,
} from './constants';
import { installLightPatch, registerSceneSync, setNetherworld } from './lightPatch';
import { NetherWorldApp } from './ui/NetherWorldApp';
import { MirrorToolbarApp } from './ui/MirrorToolbarApp';
import { ReflectionToolbarApp } from './ui/ReflectionToolbarApp';
import { ReflectActionsToolbarApp } from './ui/ReflectActionsToolbarApp';
import { setMirrorState, type MirrorState } from './mirror';
import { makeShadow } from './shadow';
import { captureSourceAction, clearCaptures } from './reflection';

/** Mount/unmount the floating toolbars for the current canvas and combat state. */
function syncToolbars(): void {
  MirrorToolbarApp.sync();
  ReflectionToolbarApp.sync();
  ReflectActionsToolbarApp.sync();
}

interface ModuleApi {
  version: string;
  open: () => void;
  /** Dim a scene's lights (defaults to the active scene); resolves to the resulting state. GM-only. */
  enable: (scene?: Scene | null) => Promise<boolean>;
  /** Restore a scene's lights (defaults to the active scene); resolves to the resulting state. GM-only. */
  disable: (scene?: Scene | null) => Promise<boolean>;
  /** Flip a scene's state (defaults to the active scene); resolves to the resulting state. GM-only. */
  toggle: (scene?: Scene | null) => Promise<boolean>;
  /** Set the dark-mirror overlay on the active scene (intact/cracked/broken). GM-only. */
  mirror: (state: MirrorState) => Promise<void>;
  /** Clone a PC into a hostile, level-2-weaker glass Reflection and drop its token on the active scene. GM-only. */
  makeShadow: (pc: Actor) => Promise<Actor | null>;
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
 * On a world that hasn't imported the bundled adventure, open the stock Adventure importer so the
 * GM can populate the world in one click. `core.adventureImports` is Foundry's own per-adventure
 * record (keyed by UUID), so this prompts exactly once and never re-nags after import.
 */
async function promptAdventureImport(): Promise<void> {
  if (!game.user.isGM) return;
  const done = game.settings.get('core', 'adventureImports') as Record<string, boolean> | undefined;
  if (done?.[ADVENTURE_UUID]) return;
  const adventure = await fromUuid(ADVENTURE_UUID);
  void (adventure as { sheet?: { render: (options: object) => unknown } } | null)?.sheet?.render({ force: true });
}

// At init so the light-source patch is in place on every client before any scene's
// lights initialize, and the scene-flag listener is live for the first update.
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

  // One scene-load hook gates the toolbars: each mounts on its scene and unmounts on leave.
  Hooks.on('canvasReady', () => syncToolbars());

  // The reflect-actions panel is combat-gated, so re-evaluate on combat lifecycle changes too.
  // updateCombat covers the start/round/turn transitions that combatStart alone misses (the panel
  // not appearing until a reload was a missing updateCombat).
  for (const event of ['combatStart', 'updateCombat', 'deleteCombat', 'createCombatant', 'deleteCombatant']) {
    Hooks.on(event, () => syncToolbars());
  }

  // Capture each original's actions onto the active combat as they happen, so its Reflection can
  // replay that round; wipe the captures when a new encounter begins.
  Hooks.on('createChatMessage', (message: ChatMessagePF2e) => captureSourceAction(message));
  Hooks.on('combatStart', (combat: Combat) => void clearCaptures(combat));

  // Open the intro journal the moment the adventure import creates it. Its id is preserved by the
  // import, so this fires once (re-import updates rather than creates) without an adventure-hook.
  Hooks.on('createJournalEntry', (entry: JournalEntry) => {
    if (game.user.isGM && entry.id === INTRO_JOURNAL_ID) void entry.sheet?.render(true);
  });

  // The picker is the menu's handler: clicking the button in module settings opens
  // NetherWorldApp directly. `restricted` keeps it GM-only (scene flags are world writes).
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
  };
  // `api` is the Foundry convention for a public API, but isn't a typed field on Module.
  if (module) (module as { api?: ModuleApi }).api = api;

  // canvasReady usually fires before this, but covers a code reload while a scene is already up.
  syncToolbars();
  void promptAdventureImport();
  console.log(`${MODULE_ID} | ready (v${version})`);
});
