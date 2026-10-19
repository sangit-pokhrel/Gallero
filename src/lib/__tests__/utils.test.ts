import { describe, expect, it } from '@jest/globals';
import {
  bestMatch,
  buildRows,
  cosine,
  coverOf,
  dayKey,
  dayLabel,
  daysAgo,
  findDuplicates,
  fitSize,
  formatDuration,
  groupBy,
  groupTitle,
  isExpired,
  isGif,
  isPanorama,
  isScreenRecording,
  isScreenshot,
  isSelfie,
  matchesQuery,
  mediaTypes,
  panBounds,
  searchText,
  seeded,
  trashDaysLeft,
  type AssetLike,
} from '../utils';

const DAY = 86400000;
const TODAY = new Date(2026, 9, 19, 12, 0, 0); // 19 Oct 2026, local noon

let n = 0;
function asset(over: Partial<AssetLike> = {}): AssetLike {
  n++;
  return {
    id: `a${n}`,
    filename: `IMG_${n}.jpg`,
    mediaType: 'photo',
    width: 4000,
    height: 3000,
    creationTime: TODAY.getTime(),
    duration: 0,
    ...over,
  };
}

describe('formatDuration', () => {
  it('formats short clips as m:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(9.4)).toBe('0:09');
    expect(formatDuration(65)).toBe('1:05');
  });
  it('adds hours for long videos', () => {
    expect(formatDuration(3725)).toBe('1:02:05');
  });
  it('never shows negative time', () => {
    expect(formatDuration(-3)).toBe('0:00');
  });
});

describe('dates', () => {
  it('dayKey uses the local calendar day', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05');
  });
  it('daysAgo counts calendar days, not 24h windows', () => {
    const lateYesterday = new Date(2026, 9, 18, 23, 50);
    expect(daysAgo(lateYesterday, TODAY)).toBe(1);
    expect(daysAgo(TODAY, TODAY)).toBe(0);
  });
  it('dayLabel says Today / Yesterday, otherwise a date', () => {
    expect(dayLabel('2026-10-19', TODAY)).toBe('Today');
    expect(dayLabel('2026-10-18', TODAY)).toBe('Yesterday');
    expect(dayLabel('2026-10-01', TODAY)).not.toMatch(/Today|Yesterday/);
  });
  it('groupTitle by day adds the year only for other years', () => {
    const lastYear = new Date(2025, 4, 3).getTime();
    const thisYear = new Date(2026, 4, 3).getTime();
    expect(groupTitle(lastYear, 'day', TODAY)).toMatch(/2025/);
    expect(groupTitle(thisYear, 'day', TODAY)).not.toMatch(/2026/);
    expect(groupTitle(thisYear, 'none', TODAY)).toBe('');
  });
});

describe('media types', () => {
  it('spots screenshots by file name or album', () => {
    expect(isScreenshot(asset({ filename: 'Screenshot_2026.png' }), {})).toBe(true);
    expect(isScreenshot(asset({ albumId: 'x' }), { x: 'Screenshots' })).toBe(true);
    expect(isScreenshot(asset(), {})).toBe(false);
  });
  it('treats very wide or tall photos as panoramas, but not screenshots or videos', () => {
    expect(isPanorama(asset({ width: 9000, height: 2000 }))).toBe(true);
    expect(isPanorama(asset({ width: 1080, height: 2400, filename: 'Screenshot_1.png' }))).toBe(false);
    expect(isPanorama(asset({ width: 9000, height: 2000, mediaType: 'video' }))).toBe(false);
    expect(isPanorama(asset({ width: 0, height: 0 }))).toBe(false);
  });
  it('recognises GIFs, selfies and screen recordings', () => {
    expect(isGif(asset({ filename: 'fun.GIF' }))).toBe(true);
    expect(isSelfie(asset({ albumId: 's' }), { s: 'Selfies' })).toBe(true);
    expect(isScreenRecording(asset({ mediaType: 'video', filename: 'Screen_Recording_1.mp4' }), {})).toBe(true);
    expect(isScreenRecording(asset({ filename: 'Screen_Recording_1.jpg' }), {})).toBe(false);
  });
  it('has a unique key for every media type', () => {
    const keys = mediaTypes.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('grouping', () => {
  it('groupBy keeps insertion order', () => {
    const map = groupBy([1, 2, 3, 4, 5], (x) => (x % 2 ? 'odd' : 'even'));
    expect([...map.keys()]).toEqual(['odd', 'even']);
    expect(map.get('odd')).toEqual([1, 3, 5]);
  });

  it('findDuplicates returns every copy of a shot saved twice', () => {
    const t = TODAY.getTime();
    const a = asset({ creationTime: t });
    const b = asset({ creationTime: t + 200 }); // same second, same size
    const c = asset({ creationTime: t + 60000 });
    const d = asset({ creationTime: t, width: 100, height: 100 });
    expect(findDuplicates([a, b, c, d]).map((x) => x.id)).toEqual([a.id, b.id]);
  });

  it('buildRows splits groups into rows of N with headers', () => {
    const today = Array.from({ length: 5 }, () => asset());
    const lastMonth = Array.from({ length: 2 }, () => asset({ creationTime: TODAY.getTime() - 40 * DAY }));
    const rows = buildRows([...today, ...lastMonth], 3, 'month', TODAY);
    expect(rows.map((r) => r.type)).toEqual(['header', 'row', 'row', 'header', 'row']);
    expect(rows[1].items).toHaveLength(3);
    expect(rows[2].items).toHaveLength(2);
    // Indexes point back into the flat list so the viewer opens the right photo.
    expect(rows[4].items.map((i) => i.index)).toEqual([5, 6]);
  });

  it('buildRows without grouping has no headers', () => {
    const rows = buildRows([asset(), asset(), asset(), asset()], 2, 'none', TODAY);
    expect(rows.every((r) => r.type === 'row')).toBe(true);
    expect(rows).toHaveLength(2);
  });

  it('buildRows gives every row a unique key', () => {
    const list = Array.from({ length: 50 }, (_, i) => asset({ creationTime: TODAY.getTime() - i * DAY }));
    const rows = buildRows(list, 4, 'day', TODAY);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
  });

  it('coverOf prefers a still from the middle', () => {
    const v = asset({ mediaType: 'video' });
    const p1 = asset();
    const p2 = asset();
    const p3 = asset();
    expect(coverOf([v, p1, p2, p3]).id).toBe(p2.id);
    expect(coverOf([v]).id).toBe(v.id);
  });

  it('seeded is deterministic and in [0, 1)', () => {
    const a = seeded(42);
    const b = seeded(42);
    const xs = Array.from({ length: 20 }, () => a());
    expect(xs).toEqual(Array.from({ length: 20 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});

describe('search', () => {
  const albums = { cam: 'Camera', wa: 'WhatsApp Images' };
  const october = asset({ albumId: 'wa', creationTime: new Date(2025, 9, 4).getTime() });

  it('matches by month, year, album and type together', () => {
    const text = searchText(october, albums);
    expect(matchesQuery(text, 'october 2025')).toBe(true);
    expect(matchesQuery(text, 'whatsapp photo')).toBe(true);
    expect(matchesQuery(text, 'video')).toBe(false);
  });

  it('finds people by name and is case-insensitive', () => {
    const text = searchText(october, albums, ['maya']);
    expect(matchesQuery(text, 'MAYA')).toBe(true);
  });

  it('an empty query matches nothing', () => {
    expect(matchesQuery(searchText(october, albums), '   ')).toBe(false);
  });
});

describe('face matching', () => {
  it('cosine similarity is 1 for the same direction and 0 for orthogonal', () => {
    expect(cosine([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('assigns a face to the closest person above the threshold', () => {
    const people = [
      [1, 0, 0],
      [0, 1, 0],
    ];
    expect(bestMatch([0.9, 0.1, 0], people, 0.5)).toBe(0);
    expect(bestMatch([0.1, 0.95, 0], people, 0.5)).toBe(1);
  });

  it('starts a new person when nobody is similar enough', () => {
    expect(bestMatch([0, 0, 1], [[1, 0, 0]], 0.5)).toBe(-1);
    expect(bestMatch([1, 0, 0], [], 0.5)).toBe(-1);
  });
});

describe('Recently Deleted retention', () => {
  const now = TODAY.getTime();
  it('counts down 30 days', () => {
    expect(trashDaysLeft(now, now)).toBe(30);
    expect(trashDaysLeft(now - 10 * DAY, now)).toBe(20);
    expect(trashDaysLeft(now - 45 * DAY, now)).toBe(0);
  });
  it('expires only after the full 30 days', () => {
    expect(isExpired(now - 29 * DAY, now)).toBe(false);
    expect(isExpired(now - 30 * DAY - 1, now)).toBe(true);
  });
});

describe('viewer geometry', () => {
  it('fitSize letterboxes landscape photos on a portrait screen', () => {
    expect(fitSize({ width: 4000, height: 3000 }, 400, 800)).toEqual({ w: 400, h: 300 });
  });
  it('fitSize pillarboxes tall images', () => {
    const { w, h } = fitSize({ width: 1000, height: 4000 }, 400, 800);
    expect(h).toBe(800);
    expect(w).toBe(200);
  });
  it('fitSize falls back to the screen when dimensions are unknown', () => {
    expect(fitSize({ width: 0, height: 0 }, 400, 800)).toEqual({ w: 400, h: 800 });
  });
  it('panBounds is zero until the image is bigger than the screen', () => {
    expect(panBounds({ w: 400, h: 300 }, 1, 400, 800)).toEqual({ x: 0, y: 0 });
    expect(panBounds({ w: 400, h: 300 }, 3, 400, 800)).toEqual({ x: 400, y: 50 });
  });
});
