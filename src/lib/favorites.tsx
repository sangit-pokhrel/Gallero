import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Asset } from './media';

const KEY = 'gallero.favorites.v1';

type Ctx = {
  favorites: Asset[];
  isFavorite: (id: string) => boolean;
  toggle: (asset: Asset) => void;
  remove: (ids: string[]) => void;
};

const FavoritesContext = createContext<Ctx | null>(null);

// Favorites are stored as asset snapshots (newest first) so the Favorites
// screen renders instantly without re-querying the library.
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<Asset[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setFavorites(JSON.parse(raw)))
      .catch(() => {});
  }, []);

  const save = (next: Asset[]) => {
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    return next;
  };

  const toggle = useCallback((asset: Asset) => {
    setFavorites((prev) =>
      save(prev.some((a) => a.id === asset.id) ? prev.filter((a) => a.id !== asset.id) : [asset, ...prev]),
    );
  }, []);

  const remove = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setFavorites((prev) => save(prev.filter((a) => !set.has(a.id))));
  }, []);

  const value = useMemo(() => {
    const ids = new Set(favorites.map((a) => a.id));
    return { favorites, isFavorite: (id: string) => ids.has(id), toggle, remove };
  }, [favorites, toggle, remove]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used inside FavoritesProvider');
  return ctx;
}
