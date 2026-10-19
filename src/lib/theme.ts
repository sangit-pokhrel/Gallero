import { Platform } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark' | 'amoled' | 'paper';
export type FontStyle = 'sans' | 'serif' | 'mono' | 'rounded';

export type Palette = {
  dark: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textDim: string;
  textFaint: string;
  border: string;
  placeholder: string;
};

export const palettes: Record<Exclude<ThemeMode, 'system'>, Palette> = {
  light: {
    dark: false,
    bg: '#F7F5F0',
    surface: '#FFFFFF',
    surfaceAlt: '#EFECE6',
    text: '#17161A',
    textDim: '#6B6870',
    textFaint: '#A3A0A8',
    border: '#E4E0D9',
    placeholder: '#E9E6E0',
  },
  dark: {
    dark: true,
    bg: '#0F0F12',
    surface: '#18181C',
    surfaceAlt: '#212126',
    text: '#F4EFE6',
    textDim: '#9C99A3',
    textFaint: '#5E5C64',
    border: '#26262C',
    placeholder: '#1C1C21',
  },
  amoled: {
    dark: true,
    bg: '#000000',
    surface: '#0B0B0D',
    surfaceAlt: '#151518',
    text: '#FFFFFF',
    textDim: '#8F8D96',
    textFaint: '#4F4D55',
    border: '#1A1A1E',
    placeholder: '#0E0E10',
  },
  paper: {
    dark: false,
    bg: '#F1E9DA',
    surface: '#F8F2E6',
    surfaceAlt: '#E8DECB',
    text: '#2B2620',
    textDim: '#7A6F60',
    textFaint: '#AFA390',
    border: '#DED2BD',
    placeholder: '#E6DBC7',
  },
};

export const accents = [
  { name: 'Violet', color: '#7C5CFF' },
  { name: 'Sunset', color: '#FF7A45' },
  { name: 'Orchid', color: '#E4508F' },
  { name: 'Rose', color: '#F2668B' },
  { name: 'Lilac', color: '#A78BFA' },
  { name: 'Ocean', color: '#4F9DF7' },
  { name: 'Mint', color: '#3DD6A3' },
  { name: 'Lime', color: '#B5D33D' },
  { name: 'Honey', color: '#F5B83D' },
  { name: 'Mono', color: '#8E8C94' },
];

export const fontFamilies: Record<FontStyle, string | undefined> = Platform.select({
  ios: { sans: undefined, serif: 'Georgia', mono: 'Menlo', rounded: 'Avenir Next' },
  default: { sans: undefined, serif: 'serif', mono: 'monospace', rounded: 'sans-serif-light' },
});
