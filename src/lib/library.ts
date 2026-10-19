import { useMemo, useSyncExternalStore } from 'react';
import { isVideo, MediaLibrary, subscribeLibrary, type Asset } from './media';
import { useVault } from './vault';

// A single in-memory catalogue of every photo and video, newest first.
// It loads the first screenful immediately, then the rest in the background,
// and powers Library, Search, Memories, media types and Recent Days.
type Snapshot = {
  assets: Asset[];
  albumTitles: Record<string, string>;
  ready: boolean;
};

let snap: Snapshot = { assets: [], albumTitles: {}, ready: false };
const listeners = new Set<() => void>();
const emit = (next: Partial<Snapshot>) => {
  snap = { ...snap, ...next };
  listeners.forEach((l) => l());
};

let generation = 0;
let started = false;

async function load() {
  const gen = ++generation;
  const media = [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video];
  const sortBy: MediaLibrary.SortByValue[] = [[MediaLibrary.SortBy.creationTime, false]];
  try {
    const first = await MediaLibrary.getAssetsAsync({ first: 120, mediaType: media, sortBy });
    if (gen !== generation) return;
    let all = first.assets;
    // Keep the old list visible during a refresh until the new one is complete.
    if (!snap.assets.length || !first.hasNextPage) emit({ assets: all, ready: !first.hasNextPage });
    let cursor = first.endCursor;
    let more = first.hasNextPage;
    while (more) {
      // Yield between pages so the UI stays responsive while big libraries load.
      await new Promise((r) => setTimeout(r, 30));
      const page = await MediaLibrary.getAssetsAsync({ first: 2000, after: cursor, mediaType: media, sortBy });
      if (gen !== generation) return;
      all = all.concat(page.assets);
      cursor = page.endCursor;
      more = page.hasNextPage;
      if (!snap.ready) emit({ assets: all });
    }
    emit({ assets: all, ready: true });
  } catch (e) {
    console.warn('library load failed', e);
    emit({ ready: true });
  }
  MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true })
    .then((albums) => {
      if (gen === generation) emit({ albumTitles: Object.fromEntries(albums.map((a) => [a.id, a.title])) });
    })
    .catch(() => {});
}

let refreshTimer: ReturnType<typeof setTimeout> | undefined;
export function startLibrary() {
  if (started) return;
  started = true;
  load();
  subscribeLibrary(() => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(load, 400);
  });
}

export function useLibrary() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snap,
  );
}

export const getLibrary = () => snap;

/** Everything the user should see: hidden items removed, videos optional. */
export function useVisibleAssets(showVideos = true) {
  const { assets, ready } = useLibrary();
  const { hidden } = useVault();
  const visible = useMemo(
    () => assets.filter((a) => !hidden.has(a.id) && (showVideos || !isVideo(a))),
    [assets, hidden, showVideos],
  );
  return { assets: visible, ready };
}

// ---- derived groupings (pure, unit-tested in utils.ts) ------------------------------
export {
  dayKey,
  findDuplicates,
  groupBy,
  isGif,
  isPanorama,
  isScreenRecording,
  isScreenshot,
  isSelfie,
  mediaTypes,
  type MediaType,
} from './utils';
