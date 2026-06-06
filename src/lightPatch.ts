import { MODULE_ID, ENABLED_FLAG } from './constants';

/** The slice of a PointLightSource the patch reads and rewrites — its already-merged `this.data`. */
interface LightSourceInit {
  data: { disabled?: boolean; bright?: number; dim?: number; radius?: number };
}

type InitFn = (this: LightSourceInit, data: Record<string, unknown>) => void;

let patched = false;

/**
 * Wrap `PointLightSource._initialize` once, on every client, so a nether-world scene dims
 * every light by one step. Installed at `init` (before any light source initializes) rather
 * than from a macro, so it's session-wide and consistent across clients.
 *
 * Both ambient and token (non-negative) lights instantiate `PointLightSource`; negative lights
 * are `PointDarknessSource`, so darkness sources are excluded for free.
 */
export function installLightPatch(): void {
  if (patched) return;
  patched = true;

  const proto = foundry.canvas.sources.PointLightSource.prototype as unknown as { _initialize: InitFn };
  const original = proto._initialize;

  proto._initialize = function (data) {
    original.call(this, data);
    if (this.data.disabled) return;
    if (!canvas.scene?.getFlag(MODULE_ID, ENABLED_FLAG)) return;

    // Step every light down one level: the old bright zone becomes dim, the old dim ring
    // falls to dark. Bright never collapses straight to dark; a dim-only light (oldBright 0)
    // zeroes out and is removed entirely — correct. Rewriting this.data here, before
    // _createShapes builds the sweep polygon, feeds the shift into vision/detection geometry
    // (PF2e RBV inherits it), not just the shaders.
    const oldBright = this.data.bright ?? 0;
    this.data.bright = 0;
    this.data.dim = oldBright;
    this.data.radius = oldBright;
  };
}

/**
 * Re-derive every light on the active scene so the patch re-reads the flag, applying or removing the
 * dim **without a scene reload**.
 *
 * `canvas.perception.update({ initializeLightSources: true })` is not enough: it re-runs each source's
 * `initialize()` with no data, which skips `_initialize` (where the patch lives) and only rebuilds the
 * shape from the already-(un)dimmed `this.data`. Re-initializing each placeable instead feeds full
 * document data through `initialize()`, so `_initialize` runs again — and each source schedules its own
 * perception refresh.
 */
function refreshLights(): void {
  for (const light of canvas.lighting.placeables) light.initializeLightSource();
  for (const token of canvas.tokens.placeables) token.initializeLightSource();
}

/**
 * Refresh the active scene's lighting when its nether-world flag changes. The flag is written by a GM
 * and fans out as an `updateScene` hook to every client (the authoritative document-sync channel), so
 * each client re-runs this independently — no raw socket needed. Only the rendered scene refreshes
 * (light sources exist only for it); other scenes apply the flag when next navigated to, since the
 * patch reads it at light-source init.
 */
export function registerSceneSync(): void {
  Hooks.on('updateScene', (scene: Scene, changed: Record<string, unknown>) => {
    if (scene.id !== canvas.scene?.id) return;
    if (!foundry.utils.hasProperty(changed, `flags.${MODULE_ID}`)) return;
    refreshLights();
  });
}

/**
 * Mark or clear a scene as nether world. The `updateScene` this triggers refreshes the active scene's
 * lighting live (see {@link registerSceneSync}), so a mid-scene change — e.g. the party shatters the
 * mirror and light floods back — takes hold without a reload. Writing a scene flag is a world update:
 * GM clients only.
 */
export async function setNetherworld(scene: Scene, enabled: boolean): Promise<void> {
  if (enabled) await scene.setFlag(MODULE_ID, ENABLED_FLAG, true);
  else await scene.unsetFlag(MODULE_ID, ENABLED_FLAG);
}
