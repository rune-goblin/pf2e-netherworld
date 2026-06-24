export const MODULE_ID = 'pf2e-netherworld';

// Transient cross-client signals (e.g. the GM presenting an offer) ride this channel — they live on
// the wire, never in a flag (persist-state-in-flags / socket-for-transient).
export const SOCKET_EVENT = `module.${MODULE_ID}`;

export const ENABLED_FLAG = 'enabled';

export const TOOLBAR_POSITION_SETTING = 'mirrorToolbarPosition';
export const REFLECTION_TOOLBAR_POSITION_SETTING = 'reflectionToolbarPosition';
export const REFLECT_ACTIONS_TOOLBAR_POSITION_SETTING = 'reflectActionsToolbarPosition';
export const OFFER_TOOLBAR_POSITION_SETTING = 'offerToolbarPosition';

// These ids are hardcoded against the bundled Adventure, which imports with keepId — so every `_id`
// (scenes, journal, actors, items, folders) survives a fresh import and the `@UUID` cross-links hold.
// Loose pack import would mint new ids and break them (the original fresh-install bug).
export const THRESHOLD_OF_PAIN_SCENE_ID = 'QGFC0kT0Ts93Ag67'; // where the Interlocutor offers the gifts
export const HALL_OF_REFLECTIONS_SCENE_ID = '9tRQ2QuatnZeFEQy';
export const DARK_MIRROR_SCENE_ID = 'yx63y21u1f3Ola0w';

// The three offered items, in presentation order; resolved by id after the import.
export const OFFER_ITEM_IDS = ['nwStolenSight001', 'nwShroudOfName01', 'nwSurgeonsGraft1'] as const;

export const ADVENTURE_PACK = 'netherworld';
export const ADVENTURE_ID = 'nwNetherworldAdv';
export const ADVENTURE_UUID = `Compendium.${MODULE_ID}.${ADVENTURE_PACK}.Adventure.${ADVENTURE_ID}`;

export const EFFECTS_PACK = 'effects';

// The Sacrament of Pain's Impaling Chain costs the wielder 1d8 piercing per Strike and recharges over
// 1d4 rounds. PF2e can't gate a weapon Strike, so the strike hook posts the self-damage card and lands
// this duration effect the table honors (src/sacrament.ts).
export const SACRAMENT_IMG = 'modules/pf2e-netherworld/assets/threshold-of-pain/sacrement-of-pain.webp';
export const CHAIN_COILS_EFFECT_ID = 'nwChainCoils0001';
export const CHAIN_COILS_EFFECT_UUID = `Compendium.${MODULE_ID}.${EFFECTS_PACK}.Item.${CHAIN_COILS_EFFECT_ID}`;

export const INTRO_JOURNAL_ID = 'nwThroughGlassJE';

// makeShadow nests recreated reflection folders under the NetherWorld root so they never land loose.
export const NETHERWORLD_ACTOR_FOLDER_ID = 'tPzW5eubmMnK6wMU';
export const SHADOW_REFLECTIONS_FOLDER_ID = 'LhHwLWCUztAvLTXN';
