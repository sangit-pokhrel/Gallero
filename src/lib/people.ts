import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset as ExpoAsset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import jpeg from 'jpeg-js';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';
import { GalleroFaces } from '../../modules/gallero-faces';
import { getLibrary } from './library';
import { isVideo, type Asset } from './media';
import { perf } from './perf';
import { cosine, norm } from './utils';

// On-device People: ML Kit finds faces, MobileFaceNet turns each face into a
// 192-number "fingerprint", and faces whose fingerprints are close enough are
// grouped as one person. Nothing leaves the phone.

const MATCH = 0.5; // cosine similarity needed to join an existing person
const MERGE = 0.58; // two people this similar are merged after a scan pass
const MIN_FACES = 3; // a person shows up once they appear in this many photos
const INPUT = 112;
const DB_FILE = 'people.json';
const NAMES_KEY = 'gallero.people.names.v1';

type Face = { assetId: string; box: [number, number, number, number]; w: number; h: number };
type Cluster = { id: string; sum: number[]; count: number; faces: Face[] };
type Db = { scanned: string[]; clusters: Cluster[]; noFace: number };

export type Person = {
  id: string;
  name?: string;
  assetIds: string[];
  cover: Face;
};

type State = {
  status: 'idle' | 'scanning' | 'paused' | 'done' | 'unavailable';
  scanned: number;
  total: number;
  people: Person[];
  names: Record<string, string>;
};

let state: State = { status: 'idle', scanned: 0, total: 0, people: [], names: {} };
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export function usePeople() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export function renamePerson(id: string, name: string) {
  const names = { ...state.names, [id]: name.trim() };
  if (!name.trim()) delete names[id];
  AsyncStorage.setItem(NAMES_KEY, JSON.stringify(names)).catch(() => {});
  set({ names, people: state.people.map((p) => (p.id === id ? { ...p, name: names[id] } : p)) });
}

/** Folds person `from` into person `into` (for when one person was split in two). */
export function mergePeople(into: string, from: string) {
  const a = db.clusters.find((c) => c.id === into);
  const b = db.clusters.find((c) => c.id === from);
  if (!a || !b || a === b) return;
  a.sum = a.sum.map((v, i) => v + b.sum[i]);
  a.count += b.count;
  a.faces.push(...b.faces);
  db.clusters = db.clusters.filter((c) => c !== b);
  publish();
  persist();
}

// ---- persistence -----------------------------------------------------------------------
let db: Db = { scanned: [], clusters: [], noFace: 0 };
let scannedSet = new Set<string>();

async function restore() {
  try {
    const f = new File(Paths.document, DB_FILE);
    if (f.exists) db = JSON.parse(await f.text());
  } catch {}
  scannedSet = new Set(db.scanned);
  const names = await AsyncStorage.getItem(NAMES_KEY).catch(() => null);
  set({ names: names ? JSON.parse(names) : {} });
  publish();
}

function persist() {
  try {
    db.scanned = [...scannedSet];
    const f = new File(Paths.document, DB_FILE);
    if (!f.exists) f.create();
    f.write(JSON.stringify(db));
  } catch (e) {
    console.warn('people save failed', e);
  }
}

function publish() {
  const library = getLibrary().assets;
  const alive = new Set(library.map((a) => a.id));
  const people = db.clusters
    .map((c) => {
      const ids = [...new Set(c.faces.map((f) => f.assetId))].filter((id) => alive.has(id));
      // The biggest, most frontal face makes the nicest portrait.
      const cover = c.faces.filter((f) => alive.has(f.assetId)).sort((x, y) => y.box[2] - x.box[2])[0];
      return { id: c.id, name: state.names[c.id], assetIds: ids, cover };
    })
    .filter((p) => p.cover && p.assetIds.length >= MIN_FACES)
    .sort((a, b) => Number(!!b.name) - Number(!!a.name) || b.assetIds.length - a.assetIds.length);
  set({ people, scanned: scannedSet.size });
}

// ---- pipeline --------------------------------------------------------------------------
let model: TensorflowModel | null = null;

class DetectorNotReady extends Error {}

async function prepare() {
  if (!GalleroFaces) throw new Error('Face detection is not built into this app');
  if (!model) {
    // Release builds pack assets as resources; copy the model to a real file first.
    const asset = ExpoAsset.fromModule(require('../../assets/models/mobilefacenet.tflite'));
    await asset.downloadAsync();
    model = await loadTensorflowModel({ url: asset.localUri ?? asset.uri }, []);
  }
}

async function embed(uri: string): Promise<Float32Array> {
  const bytes = await new File(uri).bytes();
  const { data } = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: false });
  const input = new Float32Array(INPUT * INPUT * 3);
  for (let i = 0; i < input.length; i++) input[i] = (data[i] - 127.5) / 128;
  const [out] = await model!.run([input.buffer]);
  const v = new Float32Array(out);
  const n = norm(v);
  return v.map((x) => x / n);
}

async function scanAsset(asset: Asset) {
  // Work on a small copy: detection and cropping are far faster, and it is plenty for faces.
  const small = await (await ImageManipulator.manipulate(asset.uri).resize(asset.width >= asset.height ? { width: 720 } : { height: 720 }).renderAsync()).saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.85,
  });
  const cleanup: string[] = [small.uri];
  try {
    const found = await GalleroFaces!.detect(small.uri).catch((e: unknown) => {
      // ML Kit reports a missing (still downloading) model as an "unavailable" error.
      if (/download|unavailable|not.*(ready|available)/i.test(String(e))) throw new DetectorNotReady();
      throw e;
    });
    const faces = found.filter((f) => f.width >= 48 && Math.abs(f.yaw) < 40);
    if (!faces.length) db.noFace++;
    for (const f of faces) {
      // Square crop with a little margin, the framing the model was trained on.
      const side = Math.min(Math.max(f.width, f.height) * 1.15, small.width, small.height);
      const cx = f.x + f.width / 2;
      const cy = f.y + f.height / 2;
      const x = Math.max(0, Math.min(small.width - side, cx - side / 2));
      const y = Math.max(0, Math.min(small.height - side, cy - side / 2));
      const crop = await (
        await ImageManipulator.manipulate(small.uri)
          .crop({ originX: x, originY: y, width: side, height: side })
          .resize({ width: INPUT, height: INPUT })
          .renderAsync()
      ).saveAsync({ format: SaveFormat.JPEG, compress: 0.95 });
      cleanup.push(crop.uri);
      const e = await embed(crop.uri);
      const face: Face = {
        assetId: asset.id,
        box: [x / small.width, y / small.height, side / small.width, side / small.height],
        w: small.width,
        h: small.height,
      };
      let best: Cluster | null = null;
      let bestSim = MATCH;
      for (const c of db.clusters) {
        const sim = cosine(e, c.sum);
        if (sim > bestSim) {
          bestSim = sim;
          best = c;
        }
      }
      if (best) {
        for (let i = 0; i < e.length; i++) best.sum[i] += e[i];
        best.count++;
        best.faces.push(face);
      } else {
        db.clusters.push({ id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, sum: Array.from(e), count: 1, faces: [face] });
      }
    }
  } finally {
    cleanup.forEach((u) => {
      try {
        new File(u).delete();
      } catch {}
    });
  }
}

function mergeSimilar() {
  for (let i = 0; i < db.clusters.length; i++) {
    for (let j = i + 1; j < db.clusters.length; j++) {
      const a = db.clusters[i];
      const b = db.clusters[j];
      if (cosine(a.sum, b.sum) > MERGE) {
        // Keep the user's name if one side was named.
        const [keep, drop] = state.names[b.id] && !state.names[a.id] ? [b, a] : [a, b];
        keep.sum = keep.sum.map((v, k) => v + drop.sum[k]);
        keep.count += drop.count;
        keep.faces.push(...drop.faces);
        db.clusters = db.clusters.filter((c) => c !== drop);
        j = i; // re-check against the grown cluster
      }
    }
  }
}

let running = false;
let stopRequested = false;

AppState.addEventListener('change', (s) => {
  if (s !== 'active') stopRequested = true;
  else if (state.status === 'paused') startPeopleScan();
});

export async function startPeopleScan() {
  if (running) return;
  running = true;
  stopRequested = false;
  try {
    if (!db.clusters.length && !scannedSet.size) await restore();
    await prepare();
  } catch (e) {
    console.warn('people unavailable', e);
    set({ status: 'unavailable' });
    running = false;
    return;
  }
  const todo = () => getLibrary().assets.filter((a) => !isVideo(a) && !scannedSet.has(a.id));
  let queue = todo();
  set({ status: queue.length ? 'scanning' : 'done', total: scannedSet.size + queue.length });
  let sinceSave = 0;
  let detectorWaiting = false;
  while (queue.length && !stopRequested) {
    const asset = queue.shift()!;
    try {
      await scanAsset(asset);
    } catch (e) {
      if (e instanceof DetectorNotReady) {
        // Play services is still fetching the face model: try again shortly,
        // without marking this photo as scanned.
        detectorWaiting = true;
        break;
      }
    }
    scannedSet.add(asset.id);
    if (++sinceSave >= 25) {
      sinceSave = 0;
      mergeSimilar();
      persist();
      publish();
    }
    // Breathe between photos so scrolling and animations stay smooth.
    await new Promise((r) => setTimeout(r, perf.scanDelay));
    if (!queue.length) queue = todo();
  }
  mergeSimilar();
  persist();
  publish();
  set({ status: stopRequested || detectorWaiting ? 'paused' : 'done' });
  running = false;
  if (detectorWaiting && !stopRequested) setTimeout(startPeopleScan, 60000);
}

export function stopPeopleScan() {
  stopRequested = true;
}

export async function initPeople(enabled: boolean) {
  await restore();
  if (enabled) setTimeout(startPeopleScan, 5000);
}

export function scanLabel(status: State['status'], scanned: number, total: number) {
  if (status === 'scanning') return `Finding people… ${Math.round((scanned / Math.max(total, 1)) * 100)}%`;
  if (status === 'paused') return 'Paused — continues when you come back';
  if (status === 'unavailable') return 'Face detection isn’t available on this phone';
  return undefined;
}
