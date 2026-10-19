import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import * as Sharing from 'expo-sharing';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Alert, BackHandler, Pressable, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, {
  FadeInDown,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useFavorites } from '../lib/favorites';
import { addToAlbum, copyImageToClipboard, formatDuration, isVideo, shareableUri, type Asset } from '../lib/media';
import { deleteForever, hideAssets, moveToTrash, restoreFromTrash, unhideAssets } from '../lib/vault';
import { useSettings } from '../lib/settings';
import { buildRows, type GridItem, type GridRow } from '../lib/utils';
import { openViewer, registerTile, syncViewer, useTileHidden, type Measurable } from '../lib/viewer';
import { ActionSheet, AlbumPicker } from './Sheet';
import { IconButton, toast, Txt } from './ui';

type Item = GridItem<Asset>;
type Row = GridRow<Asset>;

const HEADER_H = 50;

type Props = {
  source: string;
  assets: Asset[];
  loadMore?: () => void;
  refresh?: () => void;
  header?: ReactElement;
  empty?: ReactElement;
  bottomInset?: number;
  /** hidden / trash grids get Unhide / Restore instead of the usual actions. */
  mode?: 'normal' | 'hidden' | 'trash';
  /** Scroll to the first item from this year / month (used by Years / Months). */
  jumpTo?: { year: number; month?: number; key: number } | null;
};

export function MediaGrid({
  source,
  assets,
  loadMore,
  refresh,
  header,
  empty,
  bottomInset = 110,
  mode = 'normal',
  jumpTo,
}: Props) {
  const { settings, colors, update, tick } = useSettings();
  const { isFavorite, toggle, remove } = useFavorites();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<null | 'more' | 'copy' | 'move'>(null);
  const selecting = selected.size > 0;
  const list = useRef<FlashListRef<Row>>(null);

  const { columns, gap, radius, grouping } = settings;
  const pad = gap > 0 ? Math.max(gap, 8) : 0;
  const tile = (width - pad * 2 - gap * (columns - 1)) / columns;

  const rows = useMemo(() => buildRows(assets, columns, grouping), [assets, columns, grouping]);

  // Row offsets let a finger position be mapped to a tile for drag-select.
  const headerH = useRef(0);
  const scrollY = useRef(0);
  const offsets = useMemo(() => {
    const out: number[] = [];
    let y = 0;
    for (const r of rows) {
      out.push(y);
      y += r.type === 'header' ? HEADER_H : tile + gap;
    }
    return out;
  }, [rows, tile, gap]);

  useEffect(() => {
    if (!jumpTo) return;
    let i = rows.findIndex((r) => {
      if (r.type !== 'row') return false;
      const d = new Date(r.items[0].asset.creationTime);
      return d.getFullYear() === jumpTo.year && (jumpTo.month === undefined || d.getMonth() === jumpTo.month);
    });
    if (i > 0 && rows[i - 1].type === 'header') i--;
    if (i >= 0) setTimeout(() => list.current?.scrollToIndex({ index: i, animated: false, viewOffset: 40 }), 60);
  }, [jumpTo?.key]);

  // Keep an open viewer in sync as more pages load.
  useEffect(() => syncViewer(source, assets, loadMore), [source, assets, loadMore]);

  // Hardware back clears the selection before leaving the screen.
  useEffect(() => {
    if (!selecting) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelected(new Set());
      return true;
    });
    return () => sub.remove();
  }, [selecting]);

  const onTilePress = useCallback(
    (asset: Asset, index: number, view: Measurable | null) => {
      if (selecting) {
        setSelected((prev) => {
          const next = new Set(prev);
          next.has(asset.id) ? next.delete(asset.id) : next.add(asset.id);
          return next;
        });
        return;
      }
      const go = (origin?: { x: number; y: number; width: number; height: number }) => {
        openViewer({ source, assets, index, loadMore, origin: origin && { ...origin, radius } });
        router.push('/viewer');
      };
      if (view) view.measureInWindow((x, y, w, h) => go(w > 0 ? { x, y, width: w, height: h } : undefined));
      else go();
    },
    [selecting, source, assets, loadMore, radius],
  );

  const onTileLongPress = useCallback(
    (asset: Asset) => {
      tick();
      setSelected((prev) => new Set(prev).add(asset.id));
    },
    [tick],
  );

  // ---- drag to select ----------------------------------------------------------
  const drag = useRef<{ start: number; base: Set<string>; adding: boolean; last: number; y: number } | null>(null);
  const autoScroll = useRef<ReturnType<typeof setInterval> | null>(null);

  const indexAt = (x: number, y: number) => {
    const cy = y + scrollY.current - headerH.current;
    if (cy < 0) return -1;
    let lo = 0;
    let hi = offsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (offsets[mid] <= cy) lo = mid;
      else hi = mid - 1;
    }
    const row = rows[lo];
    if (!row || row.type !== 'row') return -1;
    const col = Math.max(0, Math.min(columns - 1, Math.floor((x - pad) / (tile + gap))));
    return (row.items[col] ?? row.items[row.items.length - 1]).index;
  };

  const applyDrag = (x: number, y: number) => {
    const d = drag.current;
    if (!d) return;
    d.y = y;
    const i = indexAt(x, y);
    if (i < 0 || i === d.last) return;
    d.last = i;
    tick();
    const [a, b] = d.start < i ? [d.start, i] : [i, d.start];
    const next = new Set(d.base);
    for (let k = a; k <= b; k++) {
      const id = assets[k]?.id;
      if (!id) continue;
      d.adding ? next.add(id) : next.delete(id);
    }
    setSelected(next);
  };

  const stopAutoScroll = () => {
    if (autoScroll.current) clearInterval(autoScroll.current);
    autoScroll.current = null;
  };

  const selectPan = usePanGesture({
    enabled: selecting,
    runOnJS: true,
    activeOffsetX: [-14, 14],
    failOffsetY: [-14, 14],
    onActivate: (e) => {
      const i = indexAt(e.x, e.y);
      if (i < 0) return;
      const id = assets[i].id;
      drag.current = { start: i, base: new Set(selected), adding: !selected.has(id), last: -1, y: e.y };
      applyDrag(e.x, e.y);
      // Near the top/bottom edge, keep scrolling so long ranges are easy.
      autoScroll.current = setInterval(() => {
        const d = drag.current;
        if (!d) return;
        const edge = 110;
        const speed = d.y > height - edge - 60 ? 14 : d.y < edge + 40 ? -14 : 0;
        if (!speed) return;
        scrollY.current = Math.max(0, scrollY.current + speed);
        list.current?.scrollToOffset({ offset: scrollY.current, animated: false });
      }, 16);
    },
    onUpdate: (e) => applyDrag(e.x, e.y),
    onFinalize: () => {
      drag.current = null;
      stopAutoScroll();
    },
  });

  // ---- pinch to change density, with live feedback ----------------------------------
  const runColumns = useCallback(
    (n: number) => {
      tick();
      update({ columns: n });
    },
    [tick, update],
  );
  const zoom = useSharedValue(1);
  const fadeV = useSharedValue(1);
  const pinch = usePinchGesture({
    onUpdate: (e) => {
      'worklet';
      zoom.value = Math.max(0.78, Math.min(e.scale, 1.3));
    },
    onDeactivate: (e) => {
      'worklet';
      const s = e.scale;
      if ((s > 1.2 && columns > 2) || (s < 0.83 && columns < 6)) {
        const next = s > 1 ? columns - 1 : columns + 1;
        // Start the new layout at the matching scale so the change feels continuous.
        zoom.value = zoom.value * (next / columns);
        fadeV.value = 0.4;
        zoom.value = withSpring(1, { damping: 22, stiffness: 220 });
        fadeV.value = withTiming(1, { duration: 260 });
        scheduleOnRN(runColumns, next);
      } else {
        zoom.value = withSpring(1, { damping: 20, stiffness: 260 });
      }
    },
  });
  const gridStyle = useAnimatedStyle(() => ({ flex: 1, opacity: fadeV.value, transform: [{ scale: zoom.value }] }));
  const gestures = useSimultaneousGestures(pinch, selectPan);

  // ---- actions ---------------------------------------------------------------------
  const selectedAssets = () => assets.filter((a) => selected.has(a.id));
  const clear = () => setSelected(new Set());

  const actions = {
    favorite: () => {
      tick();
      selectedAssets().forEach((a) => toggle(a));
      clear();
    },
    share: async () => {
      const [first] = selectedAssets();
      if (first) await Sharing.shareAsync(await shareableUri(first)).catch(() => {});
    },
    copy: async () => {
      const [first] = selectedAssets();
      if (!first) return;
      try {
        await copyImageToClipboard(first);
        toast('Copied to clipboard');
      } catch {
        toast('Couldn’t copy this item');
      }
    },
    album: (copy: boolean) => async (target: { albumId?: string; newName?: string }) => {
      const list = selectedAssets();
      try {
        await addToAlbum(list, target, copy);
        toast(`${copy ? 'Copied' : 'Moved'} ${list.length} item${list.length > 1 ? 's' : ''}`);
        clear();
      } catch {
        toast(copy ? 'Couldn’t copy' : 'Couldn’t move');
      }
    },
    delete: () => {
      const list = selectedAssets();
      const what = `${list.length} item${list.length > 1 ? 's' : ''}`;
      if (mode === 'trash') {
        Alert.alert(`Delete ${what} forever?`, 'This can’t be undone.', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              deleteForever(list.map((a) => a.id));
              clear();
            },
          },
        ]);
        return;
      }
      Alert.alert(`Delete ${what}?`, 'You can restore from Recently Deleted for 30 days.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (await moveToTrash(list).catch(() => false)) {
              remove(list.map((a) => a.id));
              unhideAssets(list.map((a) => a.id));
              clear();
            }
          },
        },
      ]);
    },
    hide: () => {
      const ids = [...selected];
      const what = `${ids.length} item${ids.length > 1 ? 's' : ''}`;
      if (mode === 'hidden') {
        unhideAssets(ids);
        toast(`Unhid ${what}`);
      } else {
        hideAssets(ids);
        toast(`Hid ${what}`);
      }
      clear();
    },
    restore: async () => {
      const n = await restoreFromTrash([...selected]);
      toast(`Restored ${n} item${n === 1 ? '' : 's'}`);
      clear();
    },
  };

  const toggleGroup = (items: Item[]) => {
    tick();
    setSelected((prev) => {
      const next = new Set(prev);
      const all = items.every((it) => next.has(it.asset.id));
      items.forEach((it) => (all ? next.delete(it.asset.id) : next.add(it.asset.id)));
      return next;
    });
  };

  const renderItem = ({ item }: { item: Row }) => {
    if (item.type === 'header') {
      const all = selecting && item.items.every((it) => selected.has(it.asset.id));
      return (
        <View style={[styles.groupHeader, { paddingHorizontal: Math.max(pad, 16) }]}>
          <Txt size={15} weight="600" style={{ flex: 1 }}>
            {item.title}
          </Txt>
          {selecting ? (
            <Pressable hitSlop={10} onPress={() => toggleGroup(item.items)}>
              <Txt size={13} weight="600" color={colors.accent}>
                {all ? 'Deselect' : 'Select all'}
              </Txt>
            </Pressable>
          ) : (
            <Txt size={12} faint>
              {item.items.length}
            </Txt>
          )}
        </View>
      );
    }
    return (
      <View style={{ flexDirection: 'row', gap, paddingHorizontal: pad, marginBottom: gap }}>
        {item.items.map(({ asset, index }) => (
          <Tile
            key={asset.id}
            source={source}
            asset={asset}
            index={index}
            size={tile}
            radius={radius}
            placeholder={colors.placeholder}
            accent={colors.accent}
            badge={settings.videoBadges}
            favorite={isFavorite(asset.id)}
            selecting={selecting}
            selected={selected.has(asset.id)}
            onPress={onTilePress}
            onLongPress={onTileLongPress}
          />
        ))}
      </View>
    );
  };

  const count = selected.size;

  return (
    <View style={{ flex: 1 }}>
      <GestureDetector gesture={gestures}>
        <Animated.View style={gridStyle} collapsable={false}>
          <FlashList
            ref={list}
            data={rows}
            renderItem={renderItem}
            keyExtractor={(r) => r.key}
            getItemType={(r) => r.type}
            extraData={[selected, tile, isFavorite, colors]}
            ListHeaderComponent={
              header ? <View onLayout={(e) => (headerH.current = e.nativeEvent.layout.height)}>{header}</View> : undefined
            }
            ListEmptyComponent={empty}
            onEndReached={loadMore}
            onEndReachedThreshold={1.5}
            onScroll={(e) => (scrollY.current = e.nativeEvent.contentOffset.y)}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingBottom: bottomInset + insets.bottom }}
            refreshControl={
              refresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  tintColor={colors.accent}
                  colors={[colors.accent]}
                  progressBackgroundColor={colors.surface}
                  onRefresh={async () => {
                    setRefreshing(true);
                    await refresh();
                    setRefreshing(false);
                  }}
                />
              ) : undefined
            }
          />
        </Animated.View>
      </GestureDetector>

      {selecting && (
        <Animated.View
          entering={FadeInDown.springify().damping(20)}
          exiting={FadeOutDown.duration(150)}
          style={[
            styles.selectBar,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              bottom: insets.bottom + (bottomInset >= 100 ? bottomInset - 28 : 18),
            },
          ]}
        >
          <IconButton name="close" onPress={clear} />
          <Txt weight="600" style={{ flex: 1 }}>
            {count} selected
          </Txt>
          {mode === 'normal' && <IconButton name="heart-outline" onPress={actions.favorite} />}
          {mode !== 'trash' && count === 1 && <IconButton name="share-outline" onPress={actions.share} />}
          {mode === 'normal' && <IconButton name="ellipsis-horizontal" onPress={() => setSheet('more')} />}
          {mode === 'hidden' && <IconButton name="eye-outline" onPress={actions.hide} />}
          {mode === 'trash' && <IconButton name="arrow-undo-outline" onPress={actions.restore} />}
          <IconButton name="trash-outline" color="#F0605D" onPress={actions.delete} />
        </Animated.View>
      )}

      <ActionSheet
        visible={sheet === 'more'}
        onClose={() => setSheet(null)}
        title={`${count} selected`}
        actions={[
          ...(count === 1 && !isVideo(selectedAssets()[0] ?? assets[0])
            ? [{ icon: 'copy-outline' as const, label: 'Copy', hint: 'Paste it into any app', onPress: actions.copy }]
            : []),
          { icon: 'albums-outline', label: 'Copy to album…', onPress: () => setSheet('copy') },
          { icon: 'folder-open-outline', label: 'Move to album…', onPress: () => setSheet('move') },
          { icon: 'eye-off-outline', label: 'Hide', hint: 'Moves to the locked Hidden album', onPress: actions.hide },
          {
            icon: 'checkmark-done-outline',
            label: 'Select all',
            onPress: () => setSelected(new Set(assets.map((a) => a.id))),
          },
        ]}
      />
      <AlbumPicker visible={sheet === 'copy'} onClose={() => setSheet(null)} title="Copy to album" onPick={actions.album(true)} />
      <AlbumPicker visible={sheet === 'move'} onClose={() => setSheet(null)} title="Move to album" onPick={actions.album(false)} />
    </View>
  );
}

type TileProps = {
  source: string;
  asset: Asset;
  index: number;
  size: number;
  radius: number;
  placeholder: string;
  accent: string;
  badge: boolean;
  favorite: boolean;
  selecting: boolean;
  selected: boolean;
  onPress: (a: Asset, i: number, view: Measurable | null) => void;
  onLongPress: (a: Asset) => void;
};

const Tile = memo(function Tile({
  source,
  asset,
  index,
  size,
  radius,
  placeholder,
  accent,
  badge,
  favorite,
  selecting,
  selected,
  onPress,
  onLongPress,
}: TileProps) {
  const key = `${source}:${asset.id}`;
  const ref = useRef<Measurable | null>(null);
  const hidden = useTileHidden(key);
  const video = isVideo(asset);
  return (
    <Pressable
      onPress={() => onPress(asset, index, ref.current)}
      onLongPress={() => onLongPress(asset)}
      delayLongPress={300}
      style={{ width: size, height: size }}
    >
      <View
        ref={(v: Measurable | null) => {
          ref.current = v;
          registerTile(key, v, radius);
        }}
        collapsable={false}
        style={{ width: size, height: size, opacity: hidden ? 0 : 1, transform: [{ scale: selected ? 0.86 : 1 }] }}
      >
        <Image
          source={{ uri: asset.uri }}
          recyclingKey={asset.id}
          contentFit="cover"
          transition={0}
          cachePolicy="memory-disk"
          style={{ width: size, height: size, borderRadius: radius, backgroundColor: placeholder }}
        />
      </View>
      {video && badge && (
        <View style={styles.badge}>
          <Ionicons name="play" size={10} color="#fff" />
          <Txt size={11} weight="600" color="#fff">
            {formatDuration(asset.duration)}
          </Txt>
        </View>
      )}
      {favorite && !selecting && <Ionicons name="heart" size={14} color="#fff" style={styles.fav} />}
      {selecting && (
        <View
          style={[styles.check, selected ? { backgroundColor: accent, borderColor: accent } : { borderColor: '#fff' }]}
        >
          {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  groupHeader: {
    height: HEADER_H,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
  },
  badge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  fav: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
  },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  selectBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 60,
    borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
});
