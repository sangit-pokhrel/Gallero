import { useSyncExternalStore } from 'react';
import type { Asset } from './media';

// Hand-off from a grid to the full-screen viewer. Routes can't carry an
// array of thousands of assets, so the grid parks it here before navigating
// and keeps it in sync as more pages load.
export type Measurable = { measureInWindow(cb: (x: number, y: number, w: number, h: number) => void): void };
export type Rect = { x: number; y: number; width: number; height: number; radius: number };
type ViewerSession = {
  source: string;
  assets: Asset[];
  index: number;
  origin?: Rect;
  loadMore?: () => void;
  /** Start as a slideshow (Play Memory). */
  autoplay?: boolean;
};

let session: ViewerSession = { source: '', assets: [], index: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openViewer(s: ViewerSession) {
  session = s;
  emit();
}

export function syncViewer(source: string, assets: Asset[], loadMore?: () => void) {
  if (session.source !== source || session.assets === assets) return;
  session = { ...session, assets, loadMore };
  emit();
}

export function useViewerSession() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => session,
  );
}

// ---- tile registry -----------------------------------------------------------
// Mounted grid tiles register themselves so the viewer can fly a photo back
// to its exact thumbnail when closing, even after swiping to another photo.
const tiles = new Map<string, { view: Measurable; radius: number }>();

export function registerTile(id: string, view: Measurable | null, radius: number) {
  if (view) tiles.set(id, { view, radius });
  else tiles.delete(id);
}

export function measureTile(id: string): Promise<Rect | undefined> {
  const tile = tiles.get(id);
  if (!tile) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    tile.view.measureInWindow((x, y, width, height) =>
      resolve(width > 0 ? { x, y, width, height, radius: tile.radius } : undefined),
    );
  });
}

// ---- hidden tile ----------------------------------------------------------------
// While a photo is open, its grid tile hides so the flying image never doubles up.
let hiddenKey: string | null = null;
const hiddenListeners = new Set<() => void>();

export function setHiddenTile(key: string | null) {
  hiddenKey = key;
  hiddenListeners.forEach((l) => l());
}

export function useTileHidden(key: string) {
  return useSyncExternalStore(
    (l) => {
      hiddenListeners.add(l);
      return () => hiddenListeners.delete(l);
    },
    () => hiddenKey === key,
  );
}
