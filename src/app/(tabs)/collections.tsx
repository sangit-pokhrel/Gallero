import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Switch, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FaceAvatar } from '../../components/FaceAvatar';
import { GlassButton, TopFade } from '../../components/Glass';
import { Sheet } from '../../components/Sheet';
import { Header, Txt, type IconName } from '../../components/ui';
import { useFavorites } from '../../lib/favorites';
import { findDuplicates, mediaTypes, useLibrary, useVisibleAssets } from '../../lib/library';
import { isVideo, useAlbums, type Asset } from '../../lib/media';
import { dayLabel, useFeatured, useMemories, useRecentDays } from '../../lib/memories';
import { scanLabel, usePeople } from '../../lib/people';
import { perf } from '../../lib/perf';
import { useSettings } from '../../lib/settings';
import { openViewer } from '../../lib/viewer';
import { useVault } from '../../lib/vault';

const layout = perf.tier === 'high' ? LinearTransition.springify().damping(22).stiffness(200) : undefined;

export default function CollectionsScreen() {
  const insets = useSafeAreaInsets();
  const { assets } = useVisibleAssets(true);
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <Header
          title="Collections"
          subtitle={`${assets.length.toLocaleString()} items`}
          right={<GlassButton icon="ellipsis-horizontal" onPress={() => router.push('/settings')} />}
        />
        <MemoriesSection />
        <PinnedSection />
        <AlbumsSection />
        <PeopleSection />
        <FeaturedSection />
        <RecentDaysSection />
        <MediaTypesSection />
        <UtilitiesSection />
      </ScrollView>
      <TopFade height={insets.top + 8} />
    </View>
  );
}

// ---- building blocks -------------------------------------------------------------------

function Section({
  id,
  title,
  onTitle,
  action,
  children,
}: {
  id: string;
  title: string;
  onTitle?: () => void;
  action?: ReactNode;
  children: ReactNode;
}) {
  const { settings, update, colors } = useSettings();
  const collapsed = settings.collapsed.includes(id);
  const turn = useSharedValue(collapsed ? -90 : 0);
  useEffect(() => {
    turn.value = withSpring(collapsed ? -90 : 0, { damping: 18, stiffness: 220 });
  }, [collapsed]);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));

  return (
    <Animated.View layout={layout} style={{ marginTop: 26 }}>
      <View style={styles.sectionHead}>
        <Pressable onPress={onTitle} disabled={!onTitle} style={styles.sectionTitle} hitSlop={6}>
          <Txt size={24} weight="800" style={{ letterSpacing: -0.6 }}>
            {title}
          </Txt>
          {onTitle && <Ionicons name="chevron-forward" size={22} color={colors.textDim} style={{ marginTop: 2 }} />}
        </Pressable>
        {action}
        <Pressable
          hitSlop={8}
          onPress={() =>
            update({ collapsed: collapsed ? settings.collapsed.filter((c) => c !== id) : [...settings.collapsed, id] })
          }
          style={[styles.collapse, { backgroundColor: colors.surfaceAlt }]}
        >
          <Animated.View style={chevron}>
            <Ionicons name="chevron-down" size={18} color={colors.accent} />
          </Animated.View>
        </Pressable>
      </View>
      {!collapsed && (
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)}>
          {children}
        </Animated.View>
      )}
    </Animated.View>
  );
}

function Row<T>({ data, render, keyOf, gap = 12 }: { data: T[]; render: (item: T) => ReactNode; keyOf: (item: T) => string; gap?: number }) {
  return (
    <FlatList
      horizontal
      data={data}
      keyExtractor={keyOf}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap }}
      renderItem={({ item }) => <>{render(item)}</>}
      initialNumToRender={4}
      windowSize={5}
    />
  );
}

function PhotoCard({
  uri,
  width,
  height,
  title,
  subtitle,
  big,
  onPress,
  children,
}: {
  uri?: string;
  width: number;
  height: number;
  title?: string;
  subtitle?: string;
  big?: boolean;
  onPress: () => void;
  children?: ReactNode;
}) {
  const { colors } = useSettings();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <View style={[styles.card, { width, height, backgroundColor: colors.placeholder, borderRadius: big ? 30 : 22 }]}>
        {children ?? (uri ? <Image source={{ uri }} contentFit="cover" transition={150} style={StyleSheet.absoluteFill} /> : null)}
        {!!title && (
          <>
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={styles.cardShade} />
            <View style={styles.cardText}>
              <Txt size={big ? 26 : 17} weight={big ? '800' : '600'} color="#fff" numberOfLines={2} style={{ letterSpacing: big ? -0.6 : -0.2 }}>
                {title}
              </Txt>
              {!!subtitle && (
                <Txt size={big ? 14 : 12} weight={big ? '600' : '500'} color="rgba(255,255,255,0.85)" style={big ? { textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 } : undefined}>
                  {subtitle}
                </Txt>
              )}
            </View>
          </>
        )}
      </View>
    </Pressable>
  );
}

function Mosaic({ assets }: { assets: Asset[] }) {
  const four = assets.slice(0, 4);
  return (
    <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', flexWrap: 'wrap', gap: 2 }]}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ width: '49.5%', height: '49.5%', backgroundColor: 'rgba(127,127,127,0.15)' }}>
          {four[i] && <Image source={{ uri: four[i].uri }} contentFit="cover" style={StyleSheet.absoluteFill} />}
        </View>
      ))}
    </View>
  );
}

function ListTile({ icon, label, count, locked, onPress }: { icon: IconName; label: string; count?: number; locked?: boolean; onPress: () => void }) {
  const { colors } = useSettings();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { backgroundColor: pressed ? colors.surfaceAlt : colors.surface, borderColor: colors.border }]}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
      <Txt size={16} weight="500" numberOfLines={1} style={{ flex: 1 }}>
        {label}
      </Txt>
      {locked ? (
        <Ionicons name="lock-closed" size={15} color={colors.textFaint} />
      ) : count !== undefined ? (
        <Txt size={13} faint>
          {count.toLocaleString()}
        </Txt>
      ) : null}
    </Pressable>
  );
}

// ---- sections --------------------------------------------------------------------------

function MemoriesSection() {
  const memories = useMemories();
  const { width } = useWindowDimensions();
  if (!memories.length) return null;
  const w = width * 0.8;
  return (
    <Section id="memories" title="Memories">
      <Row
        data={memories}
        keyOf={(m) => m.id}
        render={(m) => (
          <PhotoCard
            big
            uri={m.cover.uri}
            width={w}
            height={w * 1.08}
            title={m.title}
            subtitle={m.subtitle}
            onPress={() => router.push({ pathname: '/memory/[id]', params: { id: m.id } })}
          />
        )}
      />
    </Section>
  );
}

function PinnedSection() {
  const { favorites } = useFavorites();
  const { hidden } = useVault();
  const { assets } = useVisibleAssets(true);
  const { albumTitles } = useLibrary();
  const { albums } = useAlbums();
  const { settings, update, colors } = useSettings();
  const { width } = useWindowDimensions();
  const [edit, setEdit] = useState(false);
  const size = width * 0.4;

  const favs = favorites.filter((f) => !hidden.has(f.id));
  const videos = useMemo(() => assets.filter(isVideo), [assets]);
  const screenshots = useMemo(() => assets.filter((a) => mediaTypes[2].test(a, albumTitles)), [assets, albumTitles]);
  const pinned = albums.filter((a) => settings.pinnedAlbums.includes(a.id));

  type Pin = { key: string; title: string; render: () => ReactNode; go: () => void };
  const pins: Pin[] = [
    { key: 'fav', title: 'Favorites', render: () => <Mosaic assets={favs} />, go: () => router.push('/favorites') },
    ...(videos.length ? [{ key: 'vid', title: 'Videos', render: () => <Cover uri={videos[0].uri} />, go: () => router.push({ pathname: '/media/[type]', params: { type: 'videos' } }) }] : []),
    ...(screenshots.length ? [{ key: 'ss', title: 'Screenshots', render: () => <Cover uri={screenshots[0].uri} />, go: () => router.push({ pathname: '/media/[type]', params: { type: 'screenshots' } }) }] : []),
    ...pinned.map((a) => ({
      key: a.id,
      title: a.title,
      render: () => <Cover uri={a.cover} />,
      go: () => router.push({ pathname: '/album/[id]', params: { id: a.id, title: a.title } }),
    })),
  ];

  return (
    <Section
      id="pinned"
      title="Pinned"
      action={
        <Pressable onPress={() => setEdit(true)} style={[styles.pillBtn, { backgroundColor: colors.surfaceAlt }]}>
          <Txt size={14} weight="600" color={colors.accent}>
            Edit
          </Txt>
        </Pressable>
      }
    >
      <Row
        data={pins}
        keyOf={(p) => p.key}
        render={(p) => (
          <PhotoCard width={size} height={size} title={p.title} onPress={p.go}>
            {p.render()}
          </PhotoCard>
        )}
      />
      <Sheet visible={edit} onClose={() => setEdit(false)}>
        <Txt size={20} weight="700" style={{ marginBottom: 10, marginLeft: 8 }}>
          Pin albums
        </Txt>
        <ScrollView style={{ maxHeight: 420 }}>
          {albums.map((a) => {
            const on = settings.pinnedAlbums.includes(a.id);
            return (
              <View key={a.id} style={styles.pinRow}>
                <Image source={a.cover ? { uri: a.cover } : undefined} style={[styles.pinThumb, { backgroundColor: colors.placeholder }]} contentFit="cover" />
                <Txt weight="500" style={{ flex: 1 }} numberOfLines={1}>
                  {a.title}
                </Txt>
                <Switch
                  value={on}
                  onValueChange={(v) =>
                    update({ pinnedAlbums: v ? [...settings.pinnedAlbums, a.id] : settings.pinnedAlbums.filter((x) => x !== a.id) })
                  }
                  trackColor={{ true: colors.accent, false: colors.surfaceAlt }}
                  thumbColor="#fff"
                />
              </View>
            );
          })}
        </ScrollView>
      </Sheet>
    </Section>
  );
}

function Cover({ uri }: { uri?: string }) {
  return uri ? <Image source={{ uri }} contentFit="cover" transition={150} style={StyleSheet.absoluteFill} /> : null;
}

function AlbumsSection() {
  const { albums } = useAlbums();
  const { settings } = useSettings();
  const { width } = useWindowDimensions();
  const size = width * 0.4;
  const list = useMemo(
    () => albums.filter((a) => !settings.hiddenAlbums.includes(a.id)).sort((a, b) => b.assetCount - a.assetCount),
    [albums, settings.hiddenAlbums],
  );
  if (!list.length) return null;
  return (
    <Section id="albums" title="Albums" onTitle={() => router.push('/albums')}>
      <Row
        data={list}
        keyOf={(a) => a.id}
        render={(a) => (
          <PhotoCard
            uri={a.cover}
            width={size}
            height={size}
            title={a.title}
            onPress={() => router.push({ pathname: '/album/[id]', params: { id: a.id, title: a.title } })}
          />
        )}
      />
    </Section>
  );
}

function PeopleSection() {
  const { people, status, scanned, total } = usePeople();
  const { colors } = useSettings();
  const label = scanLabel(status, scanned, total);
  return (
    <Section id="people" title="People" onTitle={() => router.push('/people')}>
      {people.length ? (
        <Row
          data={people.slice(0, 20)}
          keyOf={(p) => p.id}
          gap={16}
          render={(p) => (
            <Pressable onPress={() => router.push({ pathname: '/person/[id]', params: { id: p.id } })} style={{ alignItems: 'center', width: 84 }}>
              <FaceAvatar person={p} size={84} />
              <Txt size={13} weight="500" numberOfLines={1} style={{ marginTop: 6 }}>
                {p.name ?? ' '}
              </Txt>
            </Pressable>
          )}
        />
      ) : (
        <View style={[styles.note, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="people-outline" size={26} color={colors.accent} />
          <Txt dim style={{ flex: 1, lineHeight: 20 }}>
            {label ?? 'People will appear here once Gallero has found faces in your photos.'}
          </Txt>
        </View>
      )}
      {!!label && people.length > 0 && (
        <Txt size={12} faint style={{ marginLeft: 20, marginTop: 8 }}>
          {label}
        </Txt>
      )}
    </Section>
  );
}

function FeaturedSection() {
  const featured = useFeatured();
  const { width } = useWindowDimensions();
  const size = width * 0.4;
  if (!featured.length) return null;
  return (
    <Section id="featured" title="Featured Photos">
      <Row
        data={featured}
        keyOf={(a) => a.id}
        render={(a) => (
          <PhotoCard
            uri={a.uri}
            width={size}
            height={size}
            onPress={() => {
              openViewer({ source: 'featured', assets: featured, index: featured.indexOf(a) });
              router.push('/viewer');
            }}
          />
        )}
      />
    </Section>
  );
}

function RecentDaysSection() {
  const days = useRecentDays();
  const { width } = useWindowDimensions();
  const size = width * 0.4;
  if (!days.length) return null;
  return (
    <Section id="days" title="Recent Days">
      <Row
        data={days}
        keyOf={(d) => d.key}
        render={(d) => (
          <PhotoCard
            uri={d.cover.uri}
            width={size}
            height={size}
            title={dayLabel(d.key)}
            onPress={() => router.push({ pathname: '/day/[key]', params: { key: d.key } })}
          />
        )}
      />
    </Section>
  );
}

function MediaTypesSection() {
  const { assets } = useVisibleAssets(true);
  const { albumTitles } = useLibrary();
  const types = useMemo(
    () => mediaTypes.map((t) => ({ ...t, count: assets.filter((a) => t.test(a, albumTitles)).length })).filter((t) => t.count > 0),
    [assets, albumTitles],
  );
  if (!types.length) return null;
  return (
    <Section id="media" title="Media Types">
      <View style={styles.tiles}>
        {types.map((t) => (
          <View key={t.key} style={styles.half}>
            <ListTile icon={t.icon as IconName} label={t.label} count={t.count} onPress={() => router.push({ pathname: '/media/[type]', params: { type: t.key } })} />
          </View>
        ))}
      </View>
    </Section>
  );
}

function UtilitiesSection() {
  const { favorites } = useFavorites();
  const { assets } = useVisibleAssets(true);
  const dupes = useMemo(() => findDuplicates(assets).length, [assets]);
  return (
    <Section id="utilities" title="Utilities">
      <View style={styles.tiles}>
        <View style={styles.half}>
          <ListTile icon="heart-outline" label="Favorites" count={favorites.length} onPress={() => router.push('/favorites')} />
        </View>
        <View style={styles.half}>
          <ListTile icon="copy-outline" label="Duplicates" count={dupes} onPress={() => router.push('/duplicates')} />
        </View>
        <View style={styles.half}>
          <ListTile icon="eye-off-outline" label="Hidden" locked onPress={() => router.push('/hidden')} />
        </View>
        <View style={styles.half}>
          <ListTile icon="trash-outline" label="Recently Deleted" locked onPress={() => router.push('/deleted')} />
        </View>
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  sectionHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12, gap: 10 },
  sectionTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  collapse: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  pillBtn: { paddingHorizontal: 16, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  card: { overflow: 'hidden' },
  cardShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },
  cardText: { position: 'absolute', left: 14, right: 14, bottom: 12 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10 },
  half: { width: '48.4%' },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 56,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingVertical: 8 },
  pinThumb: { width: 44, height: 44, borderRadius: 10 },
});
