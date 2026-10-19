// Pure helpers with no native dependencies, so they can be unit tested in Node.
// Everything here works on plain asset-shaped objects.

export type AssetLike = {
  id: string;
  filename: string;
  mediaType: string; // 'photo' | 'video' | ...
  width: number;
  height: number;
  creationTime: number;
  duration: number;
  albumId?: string;
};

export type Grouping = 'month' | 'day' | 'none';
export type AlbumTitles = Record<string, string>;

// ---- media kinds ---------------------------------------------------------------------
export const isVideo = (a: Pick<AssetLike, 'mediaType'>) => a.mediaType === 'video';

const albumOf = (a: AssetLike, albums: AlbumTitles) => albums[a.albumId ?? ''] ?? '';

export const isScreenshot = (a: AssetLike, albums: AlbumTitles) =>
  /screenshot/i.test(a.filename) || /screenshot/i.test(albumOf(a, albums));

export const isPanorama = (a: AssetLike) =>
  !isVideo(a) &&
  a.width > 0 &&
  a.height > 0 &&
  Math.max(a.width / a.height, a.height / a.width) >= 2.3 &&
  !/screenshot/i.test(a.filename);

export const isGif = (a: AssetLike) => /\.gif$/i.test(a.filename);

export const isSelfie = (a: AssetLike, albums: AlbumTitles) =>
  /selfie/i.test(albumOf(a, albums)) || /selfie/i.test(a.filename);

export const isScreenRecording = (a: AssetLike, albums: AlbumTitles) =>
  isVideo(a) && (/screen.?record/i.test(a.filename) || /screen.?record/i.test(albumOf(a, albums)));

export type MediaType = 'videos' | 'selfies' | 'screenshots' | 'panoramas' | 'animated' | 'recordings';

export const mediaTypes: {
  key: MediaType;
  label: string;
  icon: string;
  test: (a: AssetLike, albums: AlbumTitles) => boolean;
}[] = [
  { key: 'videos', label: 'Videos', icon: 'videocam-outline', test: (a) => isVideo(a) },
  { key: 'selfies', label: 'Selfies', icon: 'person-circle-outline', test: isSelfie },
  { key: 'screenshots', label: 'Screenshots', icon: 'phone-portrait-outline', test: isScreenshot },
  { key: 'panoramas', label: 'Panoramas', icon: 'tablet-landscape-outline', test: (a) => isPanorama(a) },
  { key: 'animated', label: 'Animated', icon: 'sparkles-outline', test: (a) => isGif(a) },
  { key: 'recordings', label: 'Screen Recordings', icon: 'radio-button-on-outline', test: isScreenRecording },
];

// ---- time ----------------------------------------------------------------------------
export function formatDuration(sec: number) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m % 60)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** Local calendar day, e.g. "2026-10-19". */
export function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Whole days between `date` and `today` (0 = same day, 1 = yesterday). */
export function daysAgo(date: Date, today = new Date()) {
  return Math.round((startOfDay(today) - startOfDay(date)) / 86400000);
}

const DAY_FMT = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export function dayLabel(key: string, today = new Date()) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const diff = daysAgo(date, today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return DAY_FMT.format(date);
}

const MONTH_FMT = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const WEEKDAY_FMT = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/** Section title for a grid group. */
export function groupTitle(ts: number, grouping: Grouping, today = new Date()) {
  if (grouping === 'none') return '';
  const d = new Date(ts);
  if (grouping === 'month') return MONTH_FMT.format(d);
  const diff = daysAgo(d, today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const label = WEEKDAY_FMT.format(d);
  return d.getFullYear() === today.getFullYear() ? label : `${label} ${d.getFullYear()}`;
}

// ---- grouping ------------------------------------------------------------------------
export function groupBy<T, K extends string>(items: T[], key: (item: T) => K) {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/** Same pixel size and capture second: almost certainly the same shot saved twice. */
export function findDuplicates<T extends AssetLike>(assets: T[]) {
  const groups = groupBy(assets, (a) => `${a.width}x${a.height}@${Math.round(a.creationTime / 1000)}`);
  return [...groups.values()].filter((g) => g.length > 1).flat();
}

export type GridItem<T> = { asset: T; index: number };
export type GridRow<T> =
  | { type: 'header'; key: string; title: string; items: GridItem<T>[] }
  | { type: 'row'; key: string; items: GridItem<T>[] };

/** Turns a flat, sorted list into grid rows with optional date headers. */
export function buildRows<T extends AssetLike>(assets: T[], columns: number, grouping: Grouping, today = new Date()) {
  const rows: GridRow<T>[] = [];
  let group: { title: string; items: GridItem<T>[] } | null = null;

  const flush = () => {
    if (!group) return;
    if (grouping !== 'none') {
      rows.push({ type: 'header', key: `h-${group.title}-${rows.length}`, title: group.title, items: group.items });
    }
    for (let i = 0; i < group.items.length; i += columns) {
      const items = group.items.slice(i, i + columns);
      rows.push({ type: 'row', key: `r-${items[0].asset.id}`, items });
    }
  };

  assets.forEach((asset, index) => {
    const title = groupTitle(asset.creationTime, grouping, today);
    if (!group || group.title !== title) {
      flush();
      group = { title, items: [] };
    }
    group.items.push({ asset, index });
  });
  flush();
  return rows;
}

/** A still from the middle of a set makes a nicer cover than the first or last shot. */
export function coverOf<T extends AssetLike>(list: T[]) {
  const stills = list.filter((a) => !isVideo(a));
  const pool = stills.length ? stills : list;
  return pool[Math.floor(pool.length / 2)];
}

/** Deterministic pseudo-random sequence (Park–Miller), so "Featured" is stable within a day. */
export function seeded(seed: number) {
  let s = Math.max(1, Math.floor(seed) % 2147483647);
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

// ---- search ----------------------------------------------------------------------------
const MONTH_EN = new Intl.DateTimeFormat('en', { month: 'long' });
const WEEKDAY_EN = new Intl.DateTimeFormat('en', { weekday: 'long' });

/** Everything a person might type to find this item: what, when, where it lives, who's in it. */
export function searchText(a: AssetLike, albums: AlbumTitles, people: string[] = []) {
  const d = new Date(a.creationTime);
  return [
    a.filename,
    albumOf(a, albums),
    MONTH_EN.format(d),
    WEEKDAY_EN.format(d),
    String(d.getFullYear()),
    isVideo(a) ? 'video videos' : 'photo photos',
    isScreenshot(a, albums) ? 'screenshot screenshots' : '',
    isSelfie(a, albums) ? 'selfie selfies' : '',
    ...people,
  ]
    .join(' ')
    .toLowerCase();
}

/** Every word of the query must appear somewhere. */
export function matchesQuery(text: string, query: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.every((w) => text.includes(w));
}

// ---- faces -----------------------------------------------------------------------------
export function norm(v: ArrayLike<number>) {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s) || 1;
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += a[i] * b[i];
  return d / (norm(a) * norm(b));
}

/** Index of the most similar centroid above `threshold`, or -1 for "a new person". */
export function bestMatch(embedding: ArrayLike<number>, centroids: ArrayLike<number>[], threshold: number) {
  let best = -1;
  let bestSim = threshold;
  centroids.forEach((c, i) => {
    const sim = cosine(embedding, c);
    if (sim > bestSim) {
      bestSim = sim;
      best = i;
    }
  });
  return best;
}

// ---- trash -----------------------------------------------------------------------------
export const TRASH_DAYS = 30;

export function trashDaysLeft(deletedAt: number, now = Date.now(), keepDays = TRASH_DAYS) {
  return Math.max(0, keepDays - Math.floor((now - deletedAt) / 86400000));
}

export const isExpired = (deletedAt: number, now = Date.now(), keepDays = TRASH_DAYS) =>
  now - deletedAt > keepDays * 86400000;

// ---- viewer geometry -------------------------------------------------------------------
/** Size an image renders at with "contain" inside a W×H box. */
export function fitSize(a: Pick<AssetLike, 'width' | 'height'>, W: number, H: number) {
  const ratio = a.width && a.height ? a.width / a.height : W / H;
  return { w: Math.min(W, H * ratio), h: Math.min(H, W / ratio) };
}

/** How far a zoomed image may pan before its edge shows. */
export function panBounds(fit: { w: number; h: number }, scale: number, W: number, H: number) {
  return { x: Math.max(0, (fit.w * scale - W) / 2), y: Math.max(0, (fit.h * scale - H) / 2) };
}
