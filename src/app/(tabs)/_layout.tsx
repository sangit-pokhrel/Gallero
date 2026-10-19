import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurTargetView } from 'expo-blur';
import { router, Tabs, usePathname } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Easing, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glass, GlassTarget } from '../../components/Glass';
import { Txt, type IconName } from '../../components/ui';
import { perf } from '../../lib/perf';
import { useSettings, type Settings } from '../../lib/settings';

const SPRING = { damping: 22, stiffness: 260, mass: 0.7 };

const TABS: { name: string; path: string; label: string; icon: IconName; active: IconName }[] = [
  { name: 'index', path: '/', label: 'Library', icon: 'images-outline', active: 'images' },
  { name: 'collections', path: '/collections', label: 'Collections', icon: 'albums-outline', active: 'albums' },
];

export default function TabsLayout() {
  const { colors } = useSettings();
  const target = useRef<ComponentRef<typeof View>>(null);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <BlurTargetView ref={target} style={{ flex: 1, backgroundColor: colors.bg }}>
        <Tabs
          tabBar={() => null}
          screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: colors.bg },
            freezeOnBlur: true,
            animation: 'fade',
            transitionSpec: {
              animation: 'timing',
              config: { duration: perf.tier === 'high' ? 200 : 140, easing: Easing.out(Easing.cubic) },
            },
          }}
        >
          <Tabs.Screen name="index" />
          <Tabs.Screen name="collections" />
        </Tabs>
      </BlurTargetView>
      <GlassTarget.Provider value={target}>
        <BottomBar />
      </GlassTarget.Provider>
    </View>
  );
}

function BottomBar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const onLibrary = pathname === '/' || pathname === '/index';
  const active = onLibrary ? 0 : 1;

  return (
    <View pointerEvents="box-none" style={[styles.bottom, { bottom: insets.bottom + 12 }]}>
      {onLibrary && <LibrarySwitcher />}
      <View style={styles.row} pointerEvents="box-none">
        <TabPill active={active} />
        <Pressable
          onPress={() => router.push('/search')}
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.93 : 1 }] })}
        >
          <Glass style={styles.search}>
            <SearchIcon />
          </Glass>
        </Pressable>
      </View>
    </View>
  );
}

function SearchIcon() {
  const { colors } = useSettings();
  return <Ionicons name="search" size={25} color={colors.accent} />;
}

/** Library / Collections, with a lighter glass capsule that slides between them. */
function TabPill({ active }: { active: number }) {
  const { colors } = useSettings();
  const pos = useSharedValue(active);
  useEffect(() => {
    pos.value = withSpring(active, SPRING);
  }, [active]);
  const capsule = useAnimatedStyle(() => ({ transform: [{ translateX: pos.value * ITEM_W }] }));

  return (
    <Glass style={styles.pill}>
      <Animated.View style={[styles.capsule, { backgroundColor: colors.accent + '2E' }, capsule]} />
      {TABS.map((t, i) => (
        <Pressable key={t.name} style={styles.tab} onPress={() => i !== active && router.navigate(t.path as '/')}>
          <TabContent pos={pos} i={i} tab={t} />
        </Pressable>
      ))}
    </Glass>
  );
}

function TabContent({ pos, i, tab }: { pos: SharedValue<number>; i: number; tab: (typeof TABS)[number] }) {
  const { colors } = useSettings();
  const on = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - Math.abs(pos.value - i)) }));
  const off = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.abs(pos.value - i)) }));
  const body = (icon: IconName, color: string) => (
    <>
      <Ionicons name={icon} size={24} color={color} />
      <Txt size={11} weight="600" color={color} style={{ marginTop: 2 }}>
        {tab.label}
      </Txt>
    </>
  );
  return (
    <>
      <Animated.View style={[styles.layer, off]}>{body(tab.icon, colors.text)}</Animated.View>
      <Animated.View style={[styles.layer, on]}>{body(tab.active, colors.accent)}</Animated.View>
    </>
  );
}

const VIEWS: { key: Settings['libraryView']; label: string }[] = [
  { key: 'years', label: 'Years' },
  { key: 'months', label: 'Months' },
  { key: 'all', label: 'All' },
];

/** Years · Months · All, floating above the tab bar on Library. */
function LibrarySwitcher() {
  const { settings, update, colors } = useSettings();
  const [w, setW] = useState(0);
  const index = VIEWS.findIndex((v) => v.key === settings.libraryView);
  const pos = useSharedValue(index);
  useEffect(() => {
    pos.value = withSpring(index, SPRING);
  }, [index]);
  const seg = w / VIEWS.length;
  const capsule = useAnimatedStyle(() => ({ width: seg - 4, transform: [{ translateX: 2 + pos.value * seg }] }));

  return (
    <Glass style={styles.switcher}>
      <View style={{ flexDirection: 'row' }} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
        {w > 0 && <Animated.View style={[styles.segCapsule, { backgroundColor: colors.accent }, capsule]} />}
        {VIEWS.map((v, i) => (
          <Pressable key={v.key} style={styles.seg} onPress={() => update({ libraryView: v.key })}>
            <Txt size={13} weight="600" color={i === index ? '#fff' : colors.text}>
              {v.label}
            </Txt>
          </Pressable>
        ))}
      </View>
    </Glass>
  );
}

const ITEM_W = 104;

const styles = StyleSheet.create({
  bottom: { position: 'absolute', left: 16, right: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { flexDirection: 'row', padding: 5, borderRadius: 36 },
  capsule: { position: 'absolute', left: 5, top: 5, width: ITEM_W, height: 58, borderRadius: 29 },
  tab: { width: ITEM_W, height: 58, alignItems: 'center', justifyContent: 'center' },
  layer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  search: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  switcher: { alignSelf: 'center', borderRadius: 22, padding: 3, width: 240 },
  seg: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center' },
  segCapsule: { position: 'absolute', top: 0, height: 36, borderRadius: 18 },
});
