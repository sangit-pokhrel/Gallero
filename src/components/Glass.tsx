import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { createContext, useContext, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSettings } from '../lib/settings';
import type { IconName } from './ui';

/** The view whose pixels glass surfaces blur (Android needs to be told explicitly). */
export type GlassRef = RefObject<ComponentRef<typeof View> | null>;
export const GlassTarget = createContext<GlassRef | null>(null);

type Props = { style?: StyleProp<ViewStyle>; children?: ReactNode; intensity?: number; strong?: boolean };

/**
 * Frosted glass. Real backdrop blur when the phone can afford it, otherwise a
 * near-opaque tint that reads the same at a glance and costs nothing.
 */
export function Glass({ style, children, intensity = 70, strong }: Props) {
  const { colors, glass } = useSettings();
  const target = useContext(GlassTarget);
  const border = { borderColor: colors.glassBorder, borderWidth: StyleSheet.hairlineWidth };

  if (!glass || (Platform.OS === 'android' && !target)) {
    return <View style={[styles.base, border, { backgroundColor: colors.glassSolid }, style]}>{children}</View>;
  }
  return (
    <BlurView
      blurTarget={target ?? undefined}
      blurMethod="dimezisBlurViewSdk31Plus"
      intensity={intensity}
      blurReductionFactor={3}
      tint={colors.dark ? 'dark' : 'light'}
      style={[styles.base, border, { backgroundColor: strong ? colors.glassSolid : colors.glass }, style]}
    >
      {children}
    </BlurView>
  );
}

/** Round glass button, like the ones floating over Apple Photos. */
export function GlassButton({
  icon,
  onPress,
  size = 44,
  color,
  label,
}: {
  icon: IconName;
  onPress?: () => void;
  size?: number;
  color?: string;
  label?: string;
}) {
  const { colors } = useSettings();
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
      <Glass style={{ height: size, minWidth: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: label ? 16 : 0, flexDirection: 'row', gap: 6 }}>
        <Ionicons name={icon} size={size * 0.46} color={color ?? colors.accent} />
        {label ? <GlassLabel text={label} color={color ?? colors.accent} /> : null}
      </Glass>
    </Pressable>
  );
}

function GlassLabel({ text, color }: { text: string; color: string }) {
  const { font } = useSettings();
  return <Text style={{ color, fontSize: 15, fontWeight: '600', fontFamily: font }}>{text}</Text>;
}

/** Soft fade under the status bar so content dissolves as it scrolls up. */
export function TopFade({ height }: { height: number }) {
  const { colors } = useSettings();
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[colors.bg, colors.bg + 'CC', colors.bg + '00']}
      locations={[0, 0.55, 1]}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height }}
    />
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
});
