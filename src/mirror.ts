import { MODULE_ID } from './constants';

// Two independent scene-overlay groups, each a set of placed tiles toggled by visibility. 'intact'
// is the bare scene (every overlay in the group hidden); a damaged state shows its one matching tile,
// identified by the shipped art it carries. Toggling that visibility is the whole feature.
type Tile = Scene['tiles']['contents'][number];

function tileGroupState<S extends string>(tile: Tile, files: Record<S, string>): S | null {
  const src = tile.texture?.src ?? '';
  for (const [state, file] of Object.entries(files) as [S, string][]) {
    if (src.endsWith(file)) return state;
  }
  return null;
}

function groupTiles<S extends string>(scene: Scene, files: Record<S, string>): Tile[] {
  return scene.tiles.filter((t) => tileGroupState(t, files) !== null);
}

/** The state shown right now: the one visible overlay, or `intact` when all of the group's are hidden. */
function currentGroupState<S extends string>(scene: Scene, files: Record<S, string>): S | 'intact' {
  const shown = groupTiles(scene, files).find((t) => !t.hidden);
  return shown ? tileGroupState(shown, files)! : 'intact';
}

/** Show the overlay for `state` and hide the others (intact hides all). World write — GM only. */
async function setGroupState<S extends string>(
  scene: Scene,
  files: Record<S, string>,
  state: S | 'intact',
): Promise<void> {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.notifications.gmOnly`));
    return;
  }
  const updates = groupTiles(scene, files).map((t) => ({ _id: t.id, hidden: tileGroupState(t, files) !== state }));
  if (updates.length) await scene.updateEmbeddedDocuments('Tile', updates);
}

export type MirrorState = 'intact' | 'cracked' | 'broken';
export const MIRROR_STATES: readonly MirrorState[] = ['intact', 'cracked', 'broken'];
const MIRROR_FILES = { cracked: 'icy-hall-cracked.webp', broken: 'icy-hall-broken.webp' } as const;

export const currentState = (scene: Scene): MirrorState => currentGroupState(scene, MIRROR_FILES);
export const setMirrorState = (scene: Scene, state: MirrorState): Promise<void> =>
  setGroupState(scene, MIRROR_FILES, state);

// The Warded Sarcophagus tracks the hazard's HP thresholds: cracked at its Broken Threshold, smashed
// once Destroyed.
export type CoffinState = 'intact' | 'cracked' | 'smashed';
export const COFFIN_STATES: readonly CoffinState[] = ['intact', 'cracked', 'smashed'];
const COFFIN_FILES = { cracked: 'coffin-cracked.webp', smashed: 'coffin-smashed.webp' } as const;

export const currentCoffinState = (scene: Scene): CoffinState => currentGroupState(scene, COFFIN_FILES);
export const setCoffinState = (scene: Scene, state: CoffinState): Promise<void> =>
  setGroupState(scene, COFFIN_FILES, state);
