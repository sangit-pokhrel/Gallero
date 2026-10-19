import { useMemo } from 'react';
import { useFavorites } from './favorites';
import { dayKey, groupBy, useVisibleAssets } from './library';
import type { Asset } from './media';
import { coverOf, seeded } from './utils';
import { usePeople } from './people';

export type Memory = { id: string; title: string; subtitle: string; cover: Asset; assets: Asset[] };

const MONTH = new Intl.DateTimeFormat(undefined, { month: 'long' });
const MONTH_YEAR = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const DAY = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export function useMemories() {
  const { assets } = useVisibleAssets(true);
  const { people } = usePeople();
  const { favorites } = useFavorites();

  return useMemo(() => {
    const out: Memory[] = [];
    const now = new Date();

    // On this day, in earlier years.
    const md = `${now.getMonth()}-${now.getDate()}`;
    const onThisDay = assets.filter((a) => {
      const d = new Date(a.creationTime);
      return `${d.getMonth()}-${d.getDate()}` === md && d.getFullYear() < now.getFullYear();
    });
    if (onThisDay.length >= 3) {
      out.push({ id: 'on-this-day', title: 'On This Day', subtitle: DAY.format(now).replace(/\s\d{4}$/, ''), cover: coverOf(onThisDay), assets: onThisDay });
    }

    // Named people.
    for (const p of people.filter((p) => p.name).slice(0, 3)) {
      const set = new Set(p.assetIds);
      const list = assets.filter((a) => set.has(a.id));
      if (list.length >= 6) out.push({ id: `person-${p.id}`, title: p.name!, subtitle: 'Over the years', cover: coverOf(list), assets: list });
    }

    // Busy months make the best stories.
    const months = groupBy(assets, (a) => {
      const d = new Date(a.creationTime);
      return `${d.getFullYear()}-${d.getMonth()}`;
    });
    const busy = [...months.entries()].filter(([, l]) => l.length >= 12).slice(0, 8);
    for (const [key, list] of busy.slice(0, 5)) {
      const d = new Date(list[0].creationTime);
      out.push({ id: `month-${key}`, title: `${MONTH.format(d)} Moments`, subtitle: MONTH_YEAR.format(d), cover: coverOf(list), assets: list });
    }

    // Year in review for past years.
    const years = groupBy(assets, (a) => String(new Date(a.creationTime).getFullYear()));
    for (const [year, list] of years) {
      if (Number(year) < now.getFullYear() && list.length >= 30) {
        out.push({ id: `year-${year}`, title: `${year} in Review`, subtitle: `${list.length.toLocaleString()} photos & videos`, cover: coverOf(list), assets: list });
      }
    }
    return out.slice(0, 12);
  }, [assets, people, favorites.length]);
}

export function useFeatured() {
  const { assets } = useVisibleAssets(false);
  const { favorites } = useFavorites();
  const { people } = usePeople();
  return useMemo(() => {
    const today = new Date();
    const rand = seeded(today.getFullYear() * 1000 + today.getMonth() * 40 + today.getDate());
    const withFaces = new Set(people.flatMap((p) => p.assetIds));
    const favIds = new Set(favorites.map((f) => f.id));
    const pool = assets.filter((a) => favIds.has(a.id) || withFaces.has(a.id));
    const source = pool.length >= 12 ? pool : assets;
    const picked: Asset[] = [];
    const seen = new Set<number>();
    for (let tries = 0; picked.length < Math.min(24, source.length) && tries < 200; tries++) {
      const i = Math.floor(rand() * source.length);
      if (!seen.has(i)) {
        seen.add(i);
        picked.push(source[i]);
      }
    }
    return picked;
  }, [assets, favorites, people]);
}

export function useRecentDays(limit = 14) {
  const { assets } = useVisibleAssets(true);
  return useMemo(() => {
    const days = groupBy(assets, (a) => dayKey(a.creationTime));
    return [...days.entries()].slice(0, limit).map(([key, list]) => ({ key, assets: list, cover: coverOf(list) }));
  }, [assets, limit]);
}

export { dayLabel } from './utils';
