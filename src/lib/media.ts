import * as MediaLibrary from 'expo-media-library/legacy';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

export type Asset = MediaLibrary.Asset;
export type Album = MediaLibrary.Album;
export { MediaLibrary };

// ---- library change signal -------------------------------------------------
// Bumped whenever the library changes (system event, or we deleted something),
// so every open list can refresh itself.
let version = 0;
const versionListeners = new Set<() => void>();
export function bumpLibrary() {
  version++;
  versionListeners.forEach((l) => l());
}
export function useLibraryVersion() {
  return useSyncExternalStore(
    (l) => {
      versionListeners.add(l);
      return () => versionListeners.delete(l);
    },
    () => version,
  );
}
let systemListener: { remove(): void } | null = null;
export function watchLibrary() {
  if (systemListener) return;
  try {
    systemListener = MediaLibrary.addListener(() => bumpLibrary());
  } catch {}
}

// ---- paged assets ----------------------------------------------------------
const PAGE = 240;

type AssetQuery = { albumId?: string; showVideos: boolean; newestFirst: boolean; pageSize?: number };

export function useAssets({ albumId, showVideos, newestFirst, pageSize = PAGE }: AssetQuery) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const cursor = useRef<{ after?: string; hasNext: boolean; busy: boolean; gen: number }>({
    hasNext: true,
    busy: false,
    gen: 0,
  });
  const libVersion = useLibraryVersion();

  const fetchPage = useCallback(
    async (reset: boolean) => {
      const c = cursor.current;
      if (!reset && (c.busy || !c.hasNext)) return;
      const gen = reset ? ++c.gen : c.gen;
      c.busy = true;
      try {
        const page = await MediaLibrary.getAssetsAsync({
          first: pageSize,
          after: reset ? undefined : c.after,
          album: albumId,
          mediaType: showVideos
            ? [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video]
            : [MediaLibrary.MediaType.photo],
          sortBy: [[MediaLibrary.SortBy.creationTime, !newestFirst]],
        });
        if (gen !== c.gen) return; // a newer reset superseded this request
        c.after = page.endCursor;
        c.hasNext = page.hasNextPage;
        setTotal(page.totalCount);
        setAssets((prev) => (reset ? page.assets : [...prev, ...page.assets]));
      } catch (e) {
        console.warn('getAssetsAsync failed', e);
      } finally {
        if (gen === c.gen) c.busy = false;
        setLoading(false);
      }
    },
    [albumId, showVideos, newestFirst, pageSize],
  );

  useEffect(() => {
    cursor.current.busy = false;
    fetchPage(true);
  }, [fetchPage, libVersion]);

  const loadMore = useCallback(() => fetchPage(false), [fetchPage]);
  const refresh = useCallback(() => fetchPage(true), [fetchPage]);

  return { assets, total, loading, loadMore, refresh };
}

// ---- albums ----------------------------------------------------------------
export type AlbumWithCover = Album & { cover?: string };

// One shared album list (with covers) for every screen, refreshed when the library changes.
let albumCache: { version: number; albums: AlbumWithCover[]; loading: boolean } = { version: -1, albums: [], loading: true };
const albumListeners = new Set<() => void>();
let albumFetch: number | null = null;

async function fetchAlbums(v: number) {
  if (albumFetch === v) return;
  albumFetch = v;
  try {
    const list = (await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true })).filter((a) => a.assetCount > 0);
    const withCovers = await Promise.all(
      list.map(async (a) => {
        try {
          const p = await MediaLibrary.getAssetsAsync({
            album: a.id,
            first: 1,
            mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
            sortBy: [[MediaLibrary.SortBy.creationTime, false]],
          });
          return { ...a, cover: p.assets[0]?.uri };
        } catch {
          return { ...a };
        }
      }),
    );
    albumCache = { version: v, albums: withCovers, loading: false };
  } catch (e) {
    console.warn('getAlbumsAsync failed', e);
    albumCache = { ...albumCache, version: v, loading: false };
  }
  albumListeners.forEach((l) => l());
}

export function useAlbums() {
  const libVersion = useLibraryVersion();
  const cache = useSyncExternalStore(
    (l) => {
      albumListeners.add(l);
      return () => albumListeners.delete(l);
    },
    () => albumCache,
  );
  useEffect(() => {
    if (albumCache.version !== libVersion) fetchAlbums(libVersion);
  }, [libVersion]);
  return { albums: cache.albums, loading: cache.loading };
}

// ---- helpers ---------------------------------------------------------------
export { formatDuration, isVideo } from './utils';

export async function deleteAssets(ids: string[]) {
  const ok = await MediaLibrary.deleteAssetsAsync(ids);
  if (ok) bumpLibrary();
  return ok;
}

export async function shareableUri(asset: Asset) {
  if (asset.uri.startsWith('file://')) return asset.uri;
  const info = await MediaLibrary.getAssetInfoAsync(asset);
  return info.localUri ?? asset.uri;
}

// ---- albums: copy / move -----------------------------------------------------
export async function addToAlbum(assets: Asset[], target: { albumId?: string; newName?: string }, copy: boolean) {
  if (!assets.length) return;
  if (target.newName) {
    // Creating an album needs one seed asset; the rest are added after.
    const [first, ...rest] = assets;
    const album = await MediaLibrary.createAlbumAsync(target.newName, first, copy);
    if (rest.length) await MediaLibrary.addAssetsToAlbumAsync(rest, album, copy);
  } else if (target.albumId) {
    await MediaLibrary.addAssetsToAlbumAsync(assets, target.albumId, copy);
  }
  bumpLibrary();
}

// ---- clipboard -----------------------------------------------------------------
export async function copyImageToClipboard(asset: Asset) {
  const uri = await shareableUri(asset);
  const base64 = await new File(uri).base64();
  await Clipboard.setImageAsync(base64);
}

export async function pasteImageFromClipboard() {
  const img = await Clipboard.getImageAsync({ format: 'png' });
  if (!img) return false;
  const file = new File(Paths.cache, `gallero-paste-${Date.now()}.png`);
  await file.write(img.data.replace(/^data:image\/\w+;base64,/, ''), { encoding: 'base64' });
  await MediaLibrary.createAssetAsync(file.uri);
  file.delete();
  bumpLibrary();
  return true;
}

export function subscribeLibrary(fn: () => void) {
  versionListeners.add(fn);
  return () => versionListeners.delete(fn);
}
