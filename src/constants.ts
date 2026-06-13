export const MODULE_ID = 'pf2e-netherworld';

/** Per-scene flag (`scene.flags['pf2e-netherworld'].enabled`) marking a scene as nether world. */
export const ENABLED_FLAG = 'enabled';

/** Client setting holding the mirror toolbar's dragged `{left, top}` (null until first moved). */
export const TOOLBAR_POSITION_SETTING = 'mirrorToolbarPosition';

/**
 * The Dark Mirror scene the toolbar is bound to. This id is only stable because the scene ships
 * inside the bundled Adventure, which imports with keepId — loose pack import would mint a new id
 * and the toolbar would never find the scene (the original fresh-install bug).
 */
export const DARK_MIRROR_SCENE_ID = 'yx63y21u1f3Ola0w';

/** The one Adventure document that bundles all world content; importing it preserves every id. */
export const ADVENTURE_PACK = 'netherworld';
export const ADVENTURE_ID = 'nwNetherworldAdv';
export const ADVENTURE_UUID = `Compendium.${MODULE_ID}.${ADVENTURE_PACK}.Adventure.${ADVENTURE_ID}`;

/** The "Through the Glass" intro journal, opened once the adventure import finishes. */
export const INTRO_JOURNAL_ID = 'nwThroughGlassJE';
