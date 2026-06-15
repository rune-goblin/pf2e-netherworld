import { MODULE_ID } from './constants';

export type MirrorState = 'intact' | 'cracked' | 'broken';

export const MIRROR_STATES: readonly MirrorState[] = ['intact', 'cracked', 'broken'];

// 'intact' is the scene background (no overlay); the damaged states are the placed tiles,
// matched by the art the module ships. Toggling these tiles' visibility is the whole feature.
const STATE_FILE: Partial<Record<MirrorState, string>> = {
  cracked: 'icy-hall-cracked.webp',
  broken: 'icy-hall-broken.webp',
};

type MirrorTile = Scene['tiles']['contents'][number];

function tileState(tile: MirrorTile): MirrorState | null {
  const src = tile.texture?.src ?? '';
  for (const [state, file] of Object.entries(STATE_FILE)) {
    if (src.endsWith(file)) return state as MirrorState;
  }
  return null;
}

export function mirrorTiles(scene: Scene): MirrorTile[] {
  return scene.tiles.filter((t) => tileState(t) !== null);
}

/** The state shown right now: the one visible overlay, or `intact` when both overlays are hidden. */
export function currentState(scene: Scene): MirrorState {
  const shown = mirrorTiles(scene).find((t) => !t.hidden);
  return shown ? tileState(shown)! : 'intact';
}

/** Show the overlay for `state` and hide the others (intact hides all). World write — GM only. */
export async function setMirrorState(scene: Scene, state: MirrorState): Promise<void> {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.notifications.gmOnly`));
    return;
  }
  const updates = mirrorTiles(scene).map((t) => ({ _id: t.id, hidden: tileState(t) !== state }));
  if (updates.length) await scene.updateEmbeddedDocuments('Tile', updates);
}
