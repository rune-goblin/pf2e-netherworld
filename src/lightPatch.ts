import { MODULE_ID, ENABLED_FLAG } from './constants';

/** The already-merged `this.data` slice the patch reads and rewrites. */
interface LightSourceInit {
  data: { disabled?: boolean; bright?: number; dim?: number; radius?: number };
}

type InitFn = (this: LightSourceInit, data: Record<string, unknown>) => void;

let patched = false;

/**
 * Patch `PointLightSource._initialize` once per client (at `init`, before any light initializes) so a
 * nether-world scene dims every light one step. Token and ambient lights are `PointLightSource`;
 * negative (darkness) lights are `PointDarknessSource`, so they're excluded for free.
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

    // Step each light down one level: old bright → dim, old dim → dark. A dim-only light (oldBright 0)
    // zeroes out and is removed. Rewriting this.data before _createShapes builds the sweep polygon
    // feeds the shift into vision/detection geometry (PF2e RBV inherits it), not just the shaders.
    const oldBright = this.data.bright ?? 0;
    this.data.bright = 0;
    this.data.dim = oldBright;
    this.data.radius = oldBright;
  };
}

/**
 * Re-derive every light on the active scene so the patch re-reads the flag, without a reload.
 * `canvas.perception.update({ initializeLightSources: true })` won't do: it re-runs `initialize()` with
 * no data, skipping `_initialize` (where the patch lives). Re-initializing each placeable feeds full
 * document data back through `_initialize`, and each source then schedules its own perception refresh.
 */
function refreshLights(): void {
  for (const light of canvas.lighting.placeables) light.initializeLightSource();
  for (const token of canvas.tokens.placeables) token.initializeLightSource();
}

/**
 * Refresh the active scene's lighting when its flag changes. The GM's flag write fans out as an
 * `updateScene` to every client, so each re-runs this independently — no raw socket. Only the rendered
 * scene has live light sources; other scenes apply the flag when next navigated to.
 */
export function registerSceneSync(): void {
  Hooks.on('updateScene', (scene: Scene, changed: Record<string, unknown>) => {
    if (scene.id !== canvas.scene?.id) return;
    if (!foundry.utils.hasProperty(changed, `flags.${MODULE_ID}`)) return;
    refreshLights();
  });
}

/**
 * Mark or clear a scene as nether world (world write, GM only). The `updateScene` refreshes the active
 * scene's lighting live (see {@link registerSceneSync}), so a mid-scene change takes hold without a reload.
 */
export async function setNetherworld(scene: Scene, enabled: boolean): Promise<void> {
  if (enabled) await scene.setFlag(MODULE_ID, ENABLED_FLAG, true);
  else await scene.unsetFlag(MODULE_ID, ENABLED_FLAG);
}
