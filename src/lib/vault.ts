import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { bumpLibrary, MediaLibrary, shareableUri, type Asset } from './media';
import { isExpired, TRASH_DAYS, trashDaysLeft } from './utils';

// ---- state ---------------------------------------------------------------------------
// Hidden: ids of library items kept out of Library, Albums, Search and Memories.
// Trash: items deleted from the device but kept privately for 30 days so they
// can be restored, like Recently Deleted on iPhone.
export type TrashEntry = { id: string; file: string; asset: Asset; deletedAt: number };

type State = { hidden: Set<string>; trash: TrashEntry[]; unlocked: boolean; loaded: boolean };

const HIDDEN_KEY = 'gallero.hidden.v1';
const TRASH_KEY = 'gallero.trash.v1';
const KEEP_DAYS = TRASH_DAYS;

let state: State = { hidden: new Set(), trash: [], unlocked: false, loaded: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

const trashDir = () => {
  const dir = new Directory(Paths.document, 'trash');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
};

const saveHidden = () => AsyncStorage.setItem(HIDDEN_KEY, JSON.stringify([...state.hidden])).catch(() => {});
const saveTrash = () => AsyncStorage.setItem(TRASH_KEY, JSON.stringify(state.trash)).catch(() => {});

export async function loadVault() {
  const [h, t] = await Promise.all([AsyncStorage.getItem(HIDDEN_KEY), AsyncStorage.getItem(TRASH_KEY)]).catch(
    () => [null, null] as const,
  );
  const now = Date.now();
  const trash: TrashEntry[] = t ? JSON.parse(t) : [];
  // Items older than 30 days are gone for good.
  const keep = trash.filter((e) => {
    const expired = isExpired(e.deletedAt, now, KEEP_DAYS);
    if (expired) safeDelete(e.file);
    return !expired;
  });
  set({ hidden: new Set(h ? JSON.parse(h) : []), trash: keep, loaded: true });
  if (keep.length !== trash.length) saveTrash();
}

// Re-lock whenever the app leaves the foreground.
AppState.addEventListener('change', (s) => {
  if (s !== 'active' && state.unlocked) set({ unlocked: false });
});

export function useVault() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

// ---- hidden ----------------------------------------------------------------------------
export function hideAssets(ids: string[]) {
  const next = new Set(state.hidden);
  ids.forEach((id) => next.add(id));
  set({ hidden: next });
  saveHidden();
}

export function unhideAssets(ids: string[]) {
  const next = new Set(state.hidden);
  ids.forEach((id) => next.delete(id));
  set({ hidden: next });
  saveHidden();
}

// ---- trash -------------------------------------------------------------------------------
function safeDelete(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {}
}

/** Keeps a private copy, then deletes from the device (Android asks to confirm). */
export async function moveToTrash(assets: Asset[]) {
  const dir = trashDir();
  const entries: TrashEntry[] = [];
  for (const asset of assets) {
    try {
      const src = new File(await shareableUri(asset));
      const dest = new File(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${asset.filename}`);
      await src.copy(dest);
      entries.push({
        id: `trash:${dest.name}`,
        file: dest.uri,
        asset: { ...asset, uri: dest.uri },
        deletedAt: Date.now(),
      });
    } catch (e) {
      console.warn('could not keep a copy of', asset.filename, e);
    }
  }
  const ok = await MediaLibrary.deleteAssetsAsync(assets.map((a) => a.id)).catch(() => false);
  if (!ok) {
    entries.forEach((e) => safeDelete(e.file));
    return false;
  }
  set({ trash: [...entries, ...state.trash] });
  saveTrash();
  bumpLibrary();
  return true;
}

export async function restoreFromTrash(ids: string[]) {
  const pick = new Set(ids);
  const restored: string[] = [];
  for (const e of state.trash.filter((t) => pick.has(t.id))) {
    try {
      await MediaLibrary.createAssetAsync(e.file, e.asset.albumId);
    } catch {
      try {
        await MediaLibrary.createAssetAsync(e.file);
      } catch {
        continue;
      }
    }
    safeDelete(e.file);
    restored.push(e.id);
  }
  const done = new Set(restored);
  set({ trash: state.trash.filter((t) => !done.has(t.id)) });
  saveTrash();
  bumpLibrary();
  return restored.length;
}

export function deleteForever(ids: string[]) {
  const pick = new Set(ids);
  state.trash.filter((t) => pick.has(t.id)).forEach((t) => safeDelete(t.file));
  set({ trash: state.trash.filter((t) => !pick.has(t.id)) });
  saveTrash();
}

export const daysLeft = (e: TrashEntry) => trashDaysLeft(e.deletedAt, Date.now(), KEEP_DAYS);

// ---- lock ----------------------------------------------------------------------------------
/**
 * Unlocks with whatever the phone has: fingerprint, face, or the screen-lock
 * PIN / pattern / password as fallback. Stays unlocked until the app is left.
 */
export async function unlockVault(reason: string): Promise<boolean> {
  if (state.unlocked) return true;
  const level = await LocalAuthentication.getEnrolledLevelAsync().catch(() => LocalAuthentication.SecurityLevel.NONE);
  if (level === LocalAuthentication.SecurityLevel.NONE) {
    // No screen lock on this phone, so there's nothing to verify against.
    set({ unlocked: true });
    return true;
  }
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    promptSubtitle: 'Use your fingerprint, face or screen lock',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  }).catch(() => ({ success: false }));
  if (res.success) set({ unlocked: true });
  return res.success;
}

export const lockVault = () => set({ unlocked: false });
