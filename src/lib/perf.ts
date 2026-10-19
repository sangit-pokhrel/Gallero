import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Decide once, at startup, how much visual work this phone can take.
// Real-time blur needs Android 12's RenderNode API to be cheap, and enough RAM
// to keep full-size photos decoded while swiping. Everything else adapts to it.
const api = Platform.OS === 'android' ? (Device.platformApiLevel ?? 0) : 99;
const memory = Device.totalMemory ?? 0;
const year = Device.deviceYearClass ?? 2020;

export const perf = {
  tier: Platform.OS === 'ios' || (api >= 31 && memory >= 3.5e9 && year >= 2018) ? 'high' : 'low',
  /** Real backdrop blur is affordable. */
  blur: Platform.OS === 'ios' || api >= 31,
  /** Pages kept alive around the current photo in the viewer. */
  viewerWindow: memory >= 5e9 ? 2 : 1,
  /** Pause between photos while scanning for faces. */
  scanDelay: memory >= 5e9 ? 30 : memory >= 3e9 ? 90 : 220,
} as const;
