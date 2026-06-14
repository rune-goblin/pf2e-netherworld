import type { FloatingToolbarApp } from './FloatingToolbarApp';

/** Pointer-drag handlers for a toolbar's grip: moves the app and persists where it lands. */
export function toolbarDrag(getApp: () => FloatingToolbarApp) {
  let dragging = $state(false);
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  return {
    get dragging(): boolean {
      return dragging;
    },
    start(e: PointerEvent): void {
      dragging = true;
      const rect = getApp().element.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    move(e: PointerEvent): void {
      if (!dragging) return;
      getApp().setPosition({ left: startLeft + (e.clientX - startX), top: startTop + (e.clientY - startY) });
    },
    end(e: PointerEvent): void {
      if (!dragging) return;
      dragging = false;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      getApp().savePosition();
    },
  };
}
