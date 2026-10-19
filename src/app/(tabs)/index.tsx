import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassButton, TopFade } from '../../components/Glass';
import { MediaGrid } from '../../components/MediaGrid';
import { ActionSheet } from '../../components/Sheet';
import { EmptyState, Header, toast, Txt } from '../../components/ui';
import { groupBy, useVisibleAssets } from '../../lib/library';
import { isVideo, pasteImageFromClipboard, type Asset } from '../../lib/media';
import { useSettings } from '../../lib/settings';

/** True while the clipboard holds an image that can be pasted into the gallery. */
function useClipboardImage() {
  const [has, setHas] = useState(false);
  const check = useCallback(() => {
    Clipboard.hasImageAsync().then(setHas).catch(() => setHas(false));
  }, []);
  useFocusEffect(check);
  useEffect(() => {
    const sub = Clipboard.addClipboardListener(check);
    const app = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => {
      sub.remove();
      app.remove();
    };
  }, [check]);
  return [has, check] as const;
}

const MONTH_YEAR = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

function cover(list: Asset[]) {
  const stills = list.filter((a) => !isVideo(a));
  return (stills.length ? stills : list)[0];
}

export default function LibraryScreen() {
  const { settings, colors, update } = useSettings();
  const insets = useSafeAreaInsets();
  const [canPaste, recheck] = useClipboardImage();
  const [menu, setMenu] = useState(false);
  const [jump, setJump] = useState<{ year: number; month?: number; key: number } | null>(null);
  const [monthJump, setMonthJump] = useState<number | null>(null);
  const { assets: newest, ready } = useVisibleAssets(settings.showVideos);
  const assets = useMemo(() => (settings.newestFirst ? newest : [...newest].reverse()), [newest, settings.newestFirst]);

  const videos = useMemo(() => newest.filter(isVideo).length, [newest]);
  const subtitle = `${(newest.length - videos).toLocaleString()} Photos${videos ? `, ${videos.toLocaleString()} Videos` : ''}`;

  const paste = async () => {
    try {
      toast((await pasteImageFromClipboard()) ? 'Pasted into your gallery' : 'Nothing to paste');
    } catch {
      toast('Couldn’t paste that image');
    }
    recheck();
  };

  const header = (
    <Header
      title="Library"
      subtitle={newest.length ? subtitle : undefined}
      right={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {canPaste && <GlassButton icon="clipboard-outline" color={colors.accent} onPress={paste} />}
          <GlassButton icon="ellipsis-horizontal" onPress={() => setMenu(true)} />
        </View>
      }
    />
  );

  if (!ready && !newest.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {settings.libraryView === 'all' && (
        <Animated.View entering={FadeIn.duration(180)} style={{ flex: 1 }}>
          <MediaGrid
            source="all"
            assets={assets}
            header={header}
            jumpTo={jump}
            bottomInset={170}
            empty={<EmptyState icon="images-outline" title="No photos yet" body="Photos you take or save will appear here." />}
          />
        </Animated.View>
      )}
      {settings.libraryView === 'months' && (
        <Animated.View entering={FadeIn.duration(180)} style={{ flex: 1 }}>
          <Months
            assets={newest}
            header={header}
            jumpYear={monthJump}
            onPick={(year, month) => {
              setJump({ year, month, key: Date.now() });
              update({ libraryView: 'all' });
            }}
          />
        </Animated.View>
      )}
      {settings.libraryView === 'years' && (
        <Animated.View entering={FadeIn.duration(180)} style={{ flex: 1 }}>
          <Years
            assets={newest}
            header={header}
            onPick={(year) => {
              setMonthJump(year);
              update({ libraryView: 'months' });
            }}
          />
        </Animated.View>
      )}
      <TopFade height={insets.top + 8} />

      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        actions={[
          {
            icon: settings.newestFirst ? 'arrow-up' : 'arrow-down',
            label: settings.newestFirst ? 'Show oldest first' : 'Show newest first',
            onPress: () => update({ newestFirst: !settings.newestFirst }),
          },
          {
            icon: settings.showVideos ? 'videocam-off-outline' : 'videocam-outline',
            label: settings.showVideos ? 'Hide videos' : 'Show videos',
            onPress: () => update({ showVideos: !settings.showVideos }),
          },
          {
            icon: 'grid-outline',
            label: `Grid: ${settings.columns} columns`,
            hint: 'Tip: pinch the grid to change it',
            onPress: () => update({ columns: settings.columns >= 6 ? 2 : settings.columns + 1 }),
          },
          { icon: 'color-palette-outline', label: 'Studio', hint: 'Themes, colours, layout', onPress: () => router.push('/settings') },
        ]}
      />
    </View>
  );
}

function Months({
  assets,
  header,
  jumpYear,
  onPick,
}: {
  assets: Asset[];
  header: React.ReactElement;
  jumpYear: number | null;
  onPick: (year: number, month: number) => void;
}) {
  const { width } = useWindowDimensions();
  const list = useRef<FlashListRef<{ year: number; month: number; items: Asset[] }>>(null);
  const months = useMemo(
    () =>
      [...groupBy(assets, (a) => {
        const d = new Date(a.creationTime);
        return `${d.getFullYear()}-${d.getMonth()}`;
      }).values()].map((items) => {
        const d = new Date(items[0].creationTime);
        return { year: d.getFullYear(), month: d.getMonth(), items };
      }),
    [assets],
  );

  useEffect(() => {
    if (jumpYear === null) return;
    const i = months.findIndex((m) => m.year === jumpYear);
    if (i >= 0) setTimeout(() => list.current?.scrollToIndex({ index: i, animated: false }), 60);
  }, [jumpYear]);

  return (
    <FlashList
      ref={list}
      data={months}
      keyExtractor={(m) => `${m.year}-${m.month}`}
      ListHeaderComponent={header}
      contentContainerStyle={{ paddingBottom: 190 }}
      renderItem={({ item }) => (
        <Card
          asset={cover(item.items)}
          width={width - 32}
          height={(width - 32) * 0.62}
          title={MONTH_YEAR.format(new Date(item.items[0].creationTime))}
          subtitle={`${item.items.length.toLocaleString()} items`}
          onPress={() => onPick(item.year, item.month)}
        />
      )}
    />
  );
}

function Years({ assets, header, onPick }: { assets: Asset[]; header: React.ReactElement; onPick: (year: number) => void }) {
  const { width } = useWindowDimensions();
  const years = useMemo(
    () => [...groupBy(assets, (a) => String(new Date(a.creationTime).getFullYear())).entries()],
    [assets],
  );
  return (
    <FlashList
      data={years}
      keyExtractor={([y]) => y}
      ListHeaderComponent={header}
      contentContainerStyle={{ paddingBottom: 190 }}
      renderItem={({ item: [year, items] }) => (
        <Card
          asset={cover(items)}
          width={width - 32}
          height={(width - 32) * 1.05}
          title={year}
          big
          subtitle={`${items.length.toLocaleString()} items`}
          onPress={() => onPick(Number(year))}
        />
      )}
    />
  );
}

function Card({
  asset,
  width,
  height,
  title,
  subtitle,
  big,
  onPress,
}: {
  asset: Asset;
  width: number;
  height: number;
  title: string;
  subtitle: string;
  big?: boolean;
  onPress: () => void;
}) {
  const { colors } = useSettings();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, { width, height, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      <Image source={{ uri: asset.uri }} contentFit="cover" transition={150} recyclingKey={asset.id} style={[StyleSheet.absoluteFill, { backgroundColor: colors.placeholder }]} />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={styles.cardShade} />
      <View style={styles.cardText}>
        <Txt size={big ? 40 : 24} weight="800" color="#fff" style={{ letterSpacing: big ? -1 : -0.4 }}>
          {title}
        </Txt>
        <Txt size={13} weight="500" color="rgba(255,255,255,0.85)">
          {subtitle}
        </Txt>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { alignSelf: 'center', borderRadius: 26, overflow: 'hidden', marginBottom: 14 },
  cardShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
  cardText: { position: 'absolute', left: 20, bottom: 18, right: 20 },
});
