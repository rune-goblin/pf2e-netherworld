import './styles.css';
import { MODULE_ID, ENABLED_FLAG, TOOLBAR_POSITION_SETTING } from './constants';
import { installLightPatch, registerSceneSync, setNetherworld } from './lightPatch';
import { NetherWorldApp } from './ui/NetherWorldApp';
import { MirrorToolbarApp } from './ui/MirrorToolbarApp';
import { setMirrorState, type MirrorState } from './mirror';

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

  // One scene-load hook gates the toolbar: it mounts on a dark-mirror scene and unmounts on leave.
  Hooks.on('canvasReady', () => MirrorToolbarApp.sync());

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
  };
  // `api` is the Foundry convention for a public API, but isn't a typed field on Module.
  if (module) (module as { api?: ModuleApi }).api = api;

  // canvasReady usually fires before this, but covers a code reload while a scene is already up.
  MirrorToolbarApp.sync();
  console.log(`${MODULE_ID} | ready (v${version})`);
});
