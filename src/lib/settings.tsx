import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { perf } from './perf';
import { fontFamilies, palettes, type FontStyle, type Palette, type ThemeMode } from './theme';

export type Grouping = 'month' | 'day' | 'none';

export type Settings = {
  theme: ThemeMode;
  accent: string;
  font: FontStyle;
  columns: number;
  gap: number;
  radius: number;
  grouping: Grouping;
  newestFirst: boolean;
  showVideos: boolean;
  videoBadges: boolean;
  albumColumns: number;
  albumSort: 'count' | 'name';
  hiddenAlbums: string[];
  viewerBlack: boolean;
  tabLabels: boolean;
  haptics: boolean;
  largeTitles: boolean;
  glass: 'auto' | 'on' | 'off';
  libraryView: 'years' | 'months' | 'all';
  collapsed: string[];
  pinnedAlbums: string[];
  peopleScan: boolean;
};

export const defaultSettings: Settings = {
  theme: 'system',
  accent: '#7C5CFF',
  font: 'sans',
  columns: 3,
  gap: 2,
  radius: 6,
  grouping: 'month',
  newestFirst: true,
  showVideos: true,
  videoBadges: true,
  albumColumns: 2,
  albumSort: 'count',
  hiddenAlbums: [],
  viewerBlack: true,
  tabLabels: false,
  haptics: true,
  largeTitles: true,
  glass: 'auto',
  libraryView: 'all',
  collapsed: [],
  pinnedAlbums: [],
  peopleScan: true,
};

const KEY = 'gallero.settings.v1';

type Ctx = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
  colors: Palette & { accent: string; glass: string; glassSolid: string; glassBorder: string };
  glass: boolean;
  font: string | undefined;
  tick: () => void;
  ready: boolean;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [ready, setReady] = useState(false);
  const scheme = useColorScheme();

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw);
        // The old default orange became the new brand violet.
        if (saved.accent === '#FF8A5B') saved.accent = defaultSettings.accent;
        setSettings({ ...defaultSettings, ...saved });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const persist = (next: Settings) => {
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    return next;
  };

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => persist({ ...s, ...patch }));
  }, []);

  const reset = useCallback(() => setSettings(persist(defaultSettings)), []);

  const value = useMemo<Ctx>(() => {
    const mode = settings.theme === 'system' ? (scheme === 'light' ? 'light' : 'dark') : settings.theme;
    return {
      settings,
      update,
      reset,
      ready,
      colors: {
        ...palettes[mode],
        accent: settings.accent,
        glass: palettes[mode].dark ? 'rgba(38,38,44,0.42)' : 'rgba(255,255,255,0.5)',
        glassSolid: palettes[mode].dark ? 'rgba(30,30,35,0.94)' : 'rgba(250,249,246,0.95)',
        glassBorder: palettes[mode].dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)',
      },
      glass: settings.glass === 'on' || (settings.glass === 'auto' && perf.blur),
      font: fontFamilies[settings.font],
      tick: () => {
        if (settings.haptics) Haptics.selectionAsync().catch(() => {});
      },
    };
  }, [settings, scheme, ready, update, reset]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
