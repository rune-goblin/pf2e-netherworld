import type { Component } from 'svelte';
import { OFFER_TOOLBAR_POSITION_SETTING, THRESHOLD_OF_PAIN_SCENE_ID } from '../constants';
import { FloatingToolbarApp } from './FloatingToolbarApp';
import OfferToolbar from './OfferToolbar.svelte';

/** The GM-only "Show Offer" button on the Threshold of Pain scene. Opens the dialog locally; sharing happens inside it. */
export class OfferToolbarApp extends FloatingToolbarApp {
  static override DEFAULT_OPTIONS = {
    id: 'pf2e-netherworld-offer-toolbar',
    tag: 'div',
    classes: ['pf2e-netherworld', 'offer-toolbar'],
    window: { frame: false, positioned: true },
    position: { width: 'auto' as const, height: 'auto' as const },
  };

  protected readonly component = OfferToolbar as Component<{ app: FloatingToolbarApp }>;
  protected readonly positionSetting = OFFER_TOOLBAR_POSITION_SETTING;
  protected static override readonly sceneIds = [THRESHOLD_OF_PAIN_SCENE_ID];

  static sync(): void {
    const scene = canvas.scene;
    this.refresh(this.DEFAULT_OPTIONS.id, () => new OfferToolbarApp(), this.visibleOn(scene), scene);
  }
}
