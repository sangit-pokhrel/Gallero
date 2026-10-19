import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextProps, type ViewStyle } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useSettings } from '../lib/settings';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type TxtProps = TextProps & {
  size?: number;
  weight?: '400' | '500' | '600' | '700' | '800';
  dim?: boolean;
  faint?: boolean;
  color?: string;
};

export function Txt({ size = 15, weight = '400', dim, faint, color, style, ...rest }: TxtProps) {
  const { colors, font } = useSettings();
  return (
    <Text
      {...rest}
      style={[
        {
          fontSize: size,
          fontWeight: weight,
          fontFamily: font,
          color: color ?? (faint ? colors.textFaint : dim ? colors.textDim : colors.text),
        },
        style,
      ]}
    />
  );
}

/** The Gallero mark, drawn natively so it stays crisp at any size. */
export function Logo({ size = 64, tile = true, accent }: { size?: number; tile?: boolean; accent?: string }) {
  const sun = '#FFD66B';
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      {tile && (
        <>
          <Defs>
            <LinearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#7C5CFF" />
              <Stop offset="0.55" stopColor="#E4508F" />
              <Stop offset="1" stopColor="#FF7A45" />
            </LinearGradient>
          </Defs>
          <Rect width={1024} height={1024} rx={232} fill="url(#g)" />
        </>
      )}
      <Path
        d="M672.7 320.5 A250 250 0 1 0 762 512 L 572 512"
        fill="none"
        stroke={tile ? '#FFFFFF' : accent ?? '#7C5CFF'}
        strokeWidth={92}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={752} cy={396} r={42} fill={sun} />
    </Svg>
  );
}

export function IconButton({
  name,
  onPress,
  color,
  size = 22,
  style,
  bg,
  haptic,
}: {
  haptic?: boolean;
  name: IconName;
  onPress?: () => void;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  bg?: string;
}) {
  const { colors, tick } = useSettings();
  return (
    <Pressable
      hitSlop={8}
      onPress={() => {
        if (haptic) tick();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.iconBtn,
        { backgroundColor: bg ?? 'transparent', opacity: pressed ? 0.55 : 1 },
        style,
      ]}
    >
      <Ionicons name={name} size={size} color={color ?? colors.text} />
    </Pressable>
  );
}

export function Header({
  title,
  subtitle,
  left,
  right,
  back,
}: {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  /** Show a back button (for pages pushed on top of the tabs). */
  back?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { settings, colors } = useSettings();
  const large = settings.largeTitles;
  return (
    <View style={[styles.header, { paddingTop: insets.top + (large ? 14 : 6) }]}>
      {back && (
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.accent} />
          <Txt size={16} weight="500" color={colors.accent}>
            Back
          </Txt>
        </Pressable>
      )}
      <View style={styles.headerRow}>
        {left}
        <View style={{ flex: 1 }}>
          <Txt size={large ? 32 : 20} weight="700" style={{ letterSpacing: large ? -0.8 : -0.3 }} numberOfLines={1}>
            {title}
          </Txt>
          {!!subtitle && (
            <Txt size={13} dim style={{ marginTop: 2 }}>
              {subtitle}
            </Txt>
          )}
        </View>
        <View style={styles.headerRight}>{right}</View>
      </View>
    </View>
  );
}

export function EmptyState({ icon, title, body }: { icon: IconName; title: string; body?: string }) {
  const { colors } = useSettings();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name={icon} size={28} color={colors.accent} />
      </View>
      <Txt size={17} weight="600" style={{ marginTop: 16 }}>
        {title}
      </Txt>
      {!!body && (
        <Txt dim style={{ marginTop: 6, textAlign: 'center', lineHeight: 21 }}>
          {body}
        </Txt>
      )}
    </View>
  );
}

export function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useSettings();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.primary, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}
    >
      <Txt weight="700" color="#fff">
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  back: { flexDirection: 'row', alignItems: 'center', marginLeft: -6, marginBottom: 6, alignSelf: 'flex-start' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingVertical: 80 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  primary: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
});

// ---- toast ------------------------------------------------------------------------
let showToast: ((msg: string) => void) | null = null;
export const toast = (msg: string) => showToast?.(msg);

/** A small pill that slides in to confirm actions (copied, moved, …). */
export function ToastHost() {
  const { colors } = useSettings();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<{ text: string; id: number } | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    showToast = (text) => {
      clearTimeout(timer);
      setMsg({ text, id: Date.now() });
      timer = setTimeout(() => setMsg(null), 1800);
    };
    return () => {
      showToast = null;
      clearTimeout(timer);
    };
  }, []);

  if (!msg) return null;
  return (
    <Animated.View
      key={msg.id}
      entering={FadeInUp.springify().damping(18)}
      exiting={FadeOutUp.duration(180)}
      pointerEvents="none"
      style={[styles.toast, { top: insets.top + 10, backgroundColor: colors.text }]}
    >
      <Txt size={14} weight="600" color={colors.bg}>
        {msg.text}
      </Txt>
    </Animated.View>
  );
}
