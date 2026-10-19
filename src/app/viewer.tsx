import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  FlatList,
  GestureDetector,
  useExclusiveGestures,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { Glass } from '../components/Glass';
import { ActionSheet, AlbumPicker, Sheet } from '../components/Sheet';
import { IconButton, toast, Txt } from '../components/ui';
import { useFavorites } from '../lib/favorites';
import {
  addToAlbum,
  copyImageToClipboard,
  formatDuration,
  isVideo,
  MediaLibrary,
  shareableUri,
  type Asset,
} from '../lib/media';
import { perf } from '../lib/perf';
import { useSettings } from '../lib/settings';
import { deleteForever, hideAssets, moveToTrash, restoreFromTrash, unhideAssets } from '../lib/vault';
import { fitSize } from '../lib/utils';
import { measureTile, setHiddenTile, useViewerSession, type Rect } from '../lib/viewer';

const WHEN = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const TIME = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

const GAP = 28; // space between pages while swiping
const MAX_ZOOM = 6;
const ZOOM_SPRING = { damping: 28, stiffness: 320, mass: 0.85 };
const OPEN_SPRING = { damping: 26, stiffness: 220, mass: 0.9, overshootClamping: true };

/** Elastic resistance past a limit, like iOS scroll views. */
function rubber(value: number, min: number, max: number) {
  'worklet';
  if (value < min) return min - (min - value) * 0.3;
  if (value > max) return max + (value - max) * 0.3;
  return value;
}

export default function Viewer() {
  const session = useViewerSession();
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { settings, colors, tick } = useSettings();
  const { isFavorite, toggle, remove } = useFavorites();
  const STRIDE = W + GAP;

  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const assets = useMemo(() => session.assets.filter((a) => !removed.has(a.id)), [session.assets, removed]);
  const [index, setIndexState] = useState(session.index);
  const [chrome, setChrome] = useState(!session.autoplay);
  const [hiRes, setHiRes] = useState(false);
  const [sheet, setSheet] = useState<null | 'info' | 'more' | 'copy' | 'move'>(null);
  const [slideshow, setSlideshow] = useState(!!session.autoplay);
  const closing = useRef(false);
  const viewMode = session.source === 'trash' ? 'trash' : session.source === 'hidden' ? 'hidden' : 'normal';

  const safeIndex = Math.max(0, Math.min(index, assets.length - 1));
  const current = assets[safeIndex];
  const count = assets.length;

  // ---- shared animation state ------------------------------------------------
  const idx = useSharedValue(session.index);
  const list = useRef<FlatList<Asset>>(null);
  const [scrollOn, setScrollOn] = useState(true);
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const start = useSharedValue({ s: 1, x: 0, y: 0, fx: 0, fy: 0 });
  const zoomed = useSharedValue(false);
  const free = useSharedValue(true); // not zoomed: swipe-down to close is allowed
  const pinching = useSharedValue(false);
  const rebase = useSharedValue(false);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const open = useSharedValue(0); // 0 = at thumbnail, 1 = full screen
  const fade = useSharedValue(1); // used when there's no thumbnail to fly back to
  const origin = useSharedValue<Rect | null>(session.origin ?? null);
  const chromeV = useSharedValue(1);
  const fit = useSharedValue(current ? fitSize(current, W, H) : { w: W, h: H });
  const zoomable = useSharedValue(current ? !isVideo(current) : false);

  useEffect(() => {
    if (!current) return;
    fit.value = fitSize(current, W, H);
    zoomable.value = !isVideo(current);
    // Give the full image a moment to decode before hiding its thumbnail.
    const t = setTimeout(() => !closing.current && setHiddenTile(`${session.source}:${current.id}`), 90);
    return () => clearTimeout(t);
  }, [current?.id, W, H]);

  // Opening: fly out of the tapped thumbnail.
  useEffect(() => {
    if (!session.origin) fade.value = 0;
    open.value = withSpring(1, OPEN_SPRING);
    fade.value = withTiming(1, { duration: 200 });
    return () => setHiddenTile(null);
  }, []);

  useEffect(() => {
    chromeV.value = withTiming(chrome ? 1 : 0, { duration: 180 });
  }, [chrome]);

  // ---- index bookkeeping -------------------------------------------------------
  const setIndex = useCallback(
    (i: number) => {
      setIndexState(i);
      setHiRes(false);
      if (i >= assets.length - 4) session.loadMore?.();
    },
    [assets.length, session.loadMore],
  );

  const resetZoom = () => {
    scale.value = 1;
    tx.value = 0;
    ty.value = 0;
    zoomed.value = false;
    free.value = true;
    setScrollOn(true);
  };

  const goTo = useCallback(
    (i: number, animated = true) => {
      const target = Math.max(0, Math.min(i, count - 1));
      idx.value = target;
      resetZoom();
      list.current?.scrollToOffset({ offset: target * STRIDE, animated });
      setIndex(target);
    },
    [count, STRIDE, setIndex],
  );

  // The native pager settled on a page: make it the current one.
  const onSettled = (x: number) => {
    const i = Math.max(0, Math.min(Math.round(x / STRIDE), count - 1));
    if (i === idx.value) return;
    idx.value = i;
    resetZoom();
    setIndex(i);
  };

  // Keep position when items are deleted out from under us.
  useEffect(() => {
    if (!count) {
      router.back();
      return;
    }
    if (index > count - 1) goTo(count - 1, false);
  }, [count]);

  // ---- closing -------------------------------------------------------------------
  const close = useCallback(async () => {
    if (closing.current || !current) return;
    closing.current = true;
    setChrome(false);
    setSlideshow(false);
    const rect = await measureTile(`${session.source}:${current.id}`);
    origin.value = rect ?? null;
    const done = () => {
      setHiddenTile(null);
      router.back();
    };
    // Settle zoom so the image lands cleanly on its tile.
    scale.value = withTiming(1, { duration: 260 });
    tx.value = withTiming(0, { duration: 260 });
    ty.value = withTiming(0, { duration: 260 });
    dragX.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
    dragY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
    if (!rect) fade.value = withTiming(0, { duration: 220 });
    open.value = withTiming(0, { duration: rect ? 300 : 240, easing: Easing.out(Easing.cubic) }, (fin) => {
      if (fin) scheduleOnRN(done);
    });
  }, [current, session.source]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sheet) {
        setSheet(null);
        return true;
      }
      close();
      return true;
    });
    return () => sub.remove();
  }, [close, sheet]);

  // ---- slideshow ---------------------------------------------------------------
  useEffect(() => {
    if (!slideshow) return;
    const t = setInterval(() => {
      if (index >= count - 1) setSlideshow(false);
      else goTo(index + 1);
    }, 3200);
    return () => clearInterval(t);
  }, [slideshow, index, count, goTo]);

  // ---- gestures ----------------------------------------------------------------
  const bounds = (s: number) => {
    'worklet';
    return {
      x: Math.max(0, (fit.value.w * s - W) / 2),
      y: Math.max(0, (fit.value.h * s - H) / 2),
    };
  };

  // While zoomed, the native pager is locked so one finger moves the photo instead.
  const onZoomChange = useCallback((z: boolean) => {
    setScrollOn(!z);
    setHiRes(z);
  }, []);

  const markZoomed = (z: boolean) => {
    'worklet';
    if (zoomed.value === z) return;
    zoomed.value = z;
    free.value = !z;
    scheduleOnRN(onZoomChange, z);
  };

  const settleZoom = () => {
    'worklet';
    const s = Math.min(Math.max(scale.value, 1), MAX_ZOOM);
    const b = bounds(s);
    scale.value = withSpring(s, ZOOM_SPRING);
    tx.value = withSpring(s === 1 ? 0 : Math.min(Math.max(tx.value, -b.x), b.x), ZOOM_SPRING);
    ty.value = withSpring(s === 1 ? 0 : Math.min(Math.max(ty.value, -b.y), b.y), ZOOM_SPRING);
    markZoomed(s > 1.01);
  };

  const pinch = usePinchGesture({
    enabled: zoomable,
    onActivate: (e) => {
      'worklet';
      pinching.value = true;
      markZoomed(true);
      start.value = {
        s: scale.value,
        x: tx.value,
        y: ty.value,
        fx: e.focalX - W / 2,
        fy: e.focalY - H / 2,
      };
    },
    onUpdate: (e) => {
      'worklet';
      const st = start.value;
      const raw = st.s * e.scale;
      // Elastic past the limits instead of a hard stop.
      const s = raw > MAX_ZOOM ? MAX_ZOOM + (raw - MAX_ZOOM) * 0.25 : raw < 1 ? 1 - (1 - raw) * 0.45 : raw;
      const fx = e.focalX - W / 2;
      const fy = e.focalY - H / 2;
      // Keep the point under the fingers pinned (also lets two fingers pan).
      tx.value = fx - (s / st.s) * (st.fx - st.x);
      ty.value = fy - (s / st.s) * (st.fy - st.y);
      scale.value = s;
    },
    onFinalize: () => {
      'worklet';
      if (!pinching.value) return;
      pinching.value = false;
      settleZoom();
    },
  });

  // One finger moves the photo around while zoomed (with momentum and soft edges).
  const movePan = usePanGesture({
    enabled: zoomed,
    maxPointers: 2,
    minDistance: 2,
    onActivate: () => {
      'worklet';
      rebase.value = true;
    },
    onUpdate: (e) => {
      'worklet';
      if (pinching.value) {
        rebase.value = true;
        return;
      }
      if (rebase.value) {
        // Started, or a finger lifted mid-pinch: continue from exactly where the photo is.
        rebase.value = false;
        start.value = { s: scale.value, x: tx.value - e.translationX, y: ty.value - e.translationY, fx: 0, fy: 0 };
      }
      const st = start.value;
      const b = bounds(scale.value);
      tx.value = rubber(st.x + e.translationX, -b.x, b.x);
      ty.value = rubber(st.y + e.translationY, -b.y, b.y);
    },
    onDeactivate: (e) => {
      'worklet';
      rebase.value = false;
      if (pinching.value) return;
      const b = bounds(scale.value);
      tx.value = withDecay({ velocity: e.velocityX, clamp: [-b.x, b.x], rubberBandEffect: true, rubberBandFactor: 0.7 });
      ty.value = withDecay({ velocity: e.velocityY, clamp: [-b.y, b.y], rubberBandEffect: true, rubberBandFactor: 0.7 });
    },
  });

  // Swipe down (or up) to close. Horizontal swipes fail this and go to the native pager.
  const dismissPan = usePanGesture({
    enabled: free,
    activeOffsetY: [-14, 14],
    failOffsetX: [-14, 14],
    onUpdate: (e) => {
      'worklet';
      dragX.value = e.translationX;
      dragY.value = e.translationY;
    },
    onDeactivate: (e) => {
      'worklet';
      if (Math.abs(e.translationY) > 110 || Math.abs(e.velocityY) > 900) {
        scheduleOnRN(close);
      } else {
        dragX.value = withSpring(0, ZOOM_SPRING);
        dragY.value = withSpring(0, ZOOM_SPRING);
      }
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    maxDelay: 250,
    enabled: zoomable,
    onDeactivate: (e) => {
      'worklet';
      if (e.canceled) return;
      if (scale.value > 1.01) {
        scale.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
        tx.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
        ty.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
        markZoomed(false);
      } else {
        // Zoom so the photo fills the screen, or 2.5x, whichever is larger.
        const fill = Math.max(W / fit.value.w, H / fit.value.h);
        const s = Math.min(Math.max(2.5, fill), MAX_ZOOM);
        const b = bounds(s);
        const x = Math.min(Math.max((W / 2 - e.x) * (s - 1), -b.x), b.x);
        const y = Math.min(Math.max((H / 2 - e.y) * (s - 1), -b.y), b.y);
        scale.value = withTiming(s, { duration: 280, easing: Easing.out(Easing.cubic) });
        tx.value = withTiming(x, { duration: 280, easing: Easing.out(Easing.cubic) });
        ty.value = withTiming(y, { duration: 280, easing: Easing.out(Easing.cubic) });
        markZoomed(true);
      }
    },
  });

  const singleTap = useTapGesture({
    requireToFail: doubleTap,
    runOnJS: true,
    onDeactivate: (e) => {
      if (!e.canceled) setChrome((c) => !c);
    },
  });

  const gesture = useSimultaneousGestures(pinch, movePan, dismissPan, useExclusiveGestures(doubleTap, singleTap));

  // ---- animated styles -------------------------------------------------------------

  const dragProgress = () => {
    'worklet';
    return Math.min(Math.abs(dragY.value) / (H * 0.6), 1);
  };

  const backdrop = useAnimatedStyle(() => ({ opacity: open.value * (1 - dragProgress()) }));
  const chromeStyle = useAnimatedStyle(() => ({
    opacity: chromeV.value * open.value * (1 - Math.min(dragProgress() * 4, 1)),
  }));

  // ---- actions -----------------------------------------------------------------------
  const share = async () => {
    if (current) await Sharing.shareAsync(await shareableUri(current)).catch(() => {});
  };

  const drop = (id: string) => setRemoved((r) => new Set(r).add(id));

  const del = () => {
    if (!current) return;
    if (viewMode === 'trash') {
      Alert.alert('Delete forever?', 'This can’t be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteForever([current.id]);
            drop(current.id);
          },
        },
      ]);
      return;
    }
    Alert.alert('Delete this item?', 'You can restore it from Recently Deleted for 30 days.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (await moveToTrash([current]).catch(() => false)) {
            remove([current.id]);
            unhideAssets([current.id]);
            drop(current.id);
          }
        },
      },
    ]);
  };

  const hide = () => {
    if (!current) return;
    if (viewMode === 'hidden') {
      unhideAssets([current.id]);
      toast('Moved back to your Library');
    } else {
      hideAssets([current.id]);
      toast('Hidden');
    }
    drop(current.id);
  };

  const restore = async () => {
    if (!current) return;
    if (await restoreFromTrash([current.id])) {
      toast('Restored');
      drop(current.id);
    }
  };

  const copy = async () => {
    if (!current || isVideo(current)) return;
    try {
      await copyImageToClipboard(current);
      toast('Copied to clipboard');
    } catch {
      toast('Couldn’t copy this photo');
    }
  };

  const toAlbum = (copyMode: boolean) => async (target: { albumId?: string; newName?: string }) => {
    if (!current) return;
    try {
      await addToAlbum([current], target, copyMode);
      toast(copyMode ? 'Copied to album' : 'Moved to album');
    } catch {
      toast(copyMode ? 'Couldn’t copy' : 'Couldn’t move');
    }
  };

  if (!current) return <View style={{ flex: 1 }} />;

  const date = new Date(current.creationTime);
  const fav = isFavorite(current.id);
  const bg = settings.viewerBlack ? '#000' : colors.bg;
  // Controls sit on dark smoked glass over a soft shade, so they read on any photo.
  const fg = '#fff';

  return (
    <View style={{ flex: 1 }}>
      <StatusBar hidden={!chrome} style="light" animated />
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: bg }, backdrop]} />

      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill} collapsable={false}>
          <FlatList
            ref={list}
            data={assets}
            horizontal
            scrollEnabled={scrollOn}
            snapToInterval={STRIDE}
            decelerationRate="fast"
            disableIntervalMomentum
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={Math.min(session.index, Math.max(count - 1, 0))}
            getItemLayout={(_, i) => ({ length: STRIDE, offset: STRIDE * i, index: i })}
            keyExtractor={(a) => a.id}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            windowSize={perf.viewerWindow * 2 + 1}
            removeClippedSubviews
            onEndReached={session.loadMore}
            onEndReachedThreshold={3}
            onMomentumScrollEnd={(e) => onSettled(e.nativeEvent.contentOffset.x)}
            extraData={hiRes ? safeIndex : -1 - safeIndex}
            renderItem={({ item, index: i }) => (
              <Page
                asset={item}
                i={i}
                W={W}
                H={H}
                stride={STRIDE}
                idx={idx}
                scale={scale}
                tx={tx}
                ty={ty}
                dragX={dragX}
                dragY={dragY}
                open={open}
                fade={fade}
                origin={origin}
                hiRes={hiRes && i === safeIndex}
                player={i === safeIndex && isVideo(item)}
              />
            )}
          />
        </View>
      </GestureDetector>

      {/* shades behind the bars */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, chromeStyle]}>
        <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']} style={[styles.shadeTop, { height: insets.top + 120 }]} />
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']} style={[styles.shadeBottom, { height: insets.bottom + 150 }]} />
      </Animated.View>

      {/* top bar */}
      <Animated.View
        pointerEvents={chrome ? 'box-none' : 'none'}
        style={[styles.top, { paddingTop: insets.top + 6 }, chromeStyle]}
      >
        <Glass style={[styles.round, styles.smoke, { backgroundColor: colors.accent + 'E6' }]}>
          <IconButton name="chevron-down" color={fg} onPress={close} />
        </Glass>
        <Glass style={[styles.titlePill, styles.smoke, { backgroundColor: colors.accent + 'E6' }]}>
          <Txt size={15} weight="600" color={fg} numberOfLines={1}>
            {WHEN.format(date)}
          </Txt>
          <Txt size={12} color={fg} style={{ opacity: 0.6 }}>
            {TIME.format(date)}
            {count > 1 ? `  ·  ${safeIndex + 1} of ${count}` : ''}
          </Txt>
        </Glass>
        <Glass style={[styles.round, styles.smoke, { backgroundColor: colors.accent + 'E6' }]}>
          <IconButton
            name={slideshow ? 'pause' : 'play-outline'}
            color={slideshow ? '#FFD66B' : fg}
            onPress={() => setSlideshow((s) => !s)}
          />
        </Glass>
      </Animated.View>

      {/* bottom bar */}
      <Animated.View
        pointerEvents={chrome ? 'box-none' : 'none'}
        style={[styles.bottom, { bottom: insets.bottom + 18 }, chromeStyle]}
      >
        {isVideo(current) && <VideoControls assetId={current.id} fg={fg} accent={colors.accent} />}
        <Glass style={[styles.actions, styles.smoke, { backgroundColor: colors.accent + 'E6' }]}>
          {viewMode === 'trash' ? (
            <>
              <IconButton name="arrow-undo-outline" color={fg} onPress={restore} />
              <IconButton name="information-circle-outline" color={fg} onPress={() => setSheet('info')} />
              <IconButton name="trash-outline" color="#F0605D" onPress={del} />
            </>
          ) : (
            <>
              <IconButton name="share-outline" color={fg} onPress={share} />
              <IconButton
                name={fav ? 'heart' : 'heart-outline'}
                color={fav ? '#FFD66B' : fg}
                haptic
                onPress={() => toggle(current)}
              />
              <IconButton name="information-circle-outline" color={fg} onPress={() => setSheet('info')} />
              <IconButton name="ellipsis-horizontal" color={fg} onPress={() => setSheet('more')} />
              <IconButton name="trash-outline" color={fg} onPress={del} />
            </>
          )}
        </Glass>
      </Animated.View>

      <ActionSheet
        visible={sheet === 'more'}
        onClose={() => setSheet(null)}
        actions={[
          ...(isVideo(current)
            ? []
            : [{ icon: 'copy-outline' as const, label: 'Copy', hint: 'Paste it into any app', onPress: copy }]),
          { icon: 'albums-outline', label: 'Copy to album…', onPress: () => setSheet('copy') },
          { icon: 'folder-open-outline', label: 'Move to album…', onPress: () => setSheet('move') },
          {
            icon: viewMode === 'hidden' ? 'eye-outline' : 'eye-off-outline',
            label: viewMode === 'hidden' ? 'Unhide' : 'Hide',
            hint: viewMode === 'hidden' ? 'Show it in your Library again' : 'Moves it to the locked Hidden album',
            onPress: hide,
          },
          {
            icon: 'play-circle-outline',
            label: slideshow ? 'Stop slideshow' : 'Slideshow',
            onPress: () => {
              setChrome(!slideshow);
              setSlideshow((s) => !s);
            },
          },
          { icon: 'trash-outline', label: 'Delete', danger: true, onPress: del },
        ]}
      />
      <AlbumPicker visible={sheet === 'copy'} onClose={() => setSheet(null)} title="Copy to album" onPick={toAlbum(true)} />
      <AlbumPicker visible={sheet === 'move'} onClose={() => setSheet(null)} title="Move to album" onPick={toAlbum(false)} />
      <InfoSheet visible={sheet === 'info'} asset={current} onClose={() => (tick(), setSheet(null))} />
    </View>
  );
}

// ---- page ------------------------------------------------------------------------------

type PageProps = {
  asset: Asset;
  i: number;
  W: number;
  H: number;
  stride: number;
  idx: SharedValue<number>;
  scale: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  open: SharedValue<number>;
  fade: SharedValue<number>;
  origin: SharedValue<Rect | null>;
  hiRes: boolean;
  player: boolean;
};

const Page = memo(function Page({ asset, i, W, H, stride, idx, scale, tx, ty, dragX, dragY, open, fade, origin, hiRes, player }: PageProps) {
  const { w: fitW, h: fitH } = fitSize(asset, W, H);

  // The "clip" morphs between the thumbnail's rounded square and the full screen;
  // the image inside scales from cover-the-thumbnail to fit-the-screen.
  const clip = useAnimatedStyle(() => {
    const current = idx.value === i;
    const p = current ? open.value : 1;
    const o = current && origin.value ? origin.value : null;
    const ox = o ? o.x + o.width / 2 : W / 2;
    const oy = o ? o.y + o.height / 2 : H / 2;
    const ow = o ? o.width : fitW * 0.9;
    const oh = o ? o.height : fitH * 0.9;
    // Size/position only change during the open & close flight. Once open the
    // frame is fixed, so drags and zooms are pure GPU transforms (no layout).
    const settled = p >= 0.999;
    const cw = settled ? W : ow + (W - ow) * p;
    const ch = settled ? H : oh + (H - oh) * p;
    const cx = settled ? W / 2 : ox + (W / 2 - ox) * p;
    const cy = settled ? H / 2 : oy + (H / 2 - oy) * p;
    const shrink = current ? 1 - Math.min(Math.abs(dragY.value) / H, 1) * 0.45 : 1;
    return {
      left: cx - cw / 2,
      top: cy - ch / 2,
      width: cw,
      height: ch,
      borderRadius: o && !settled ? o.radius * (1 - p) : 0,
      opacity: current ? fade.value : 1,
      transform: current
        ? [{ translateX: dragX.value }, { translateY: dragY.value }, { scale: shrink }]
        : [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
    };
  });

  const image = useAnimatedStyle(() => {
    const current = idx.value === i;
    const p = current ? open.value : 1;
    const o = current && origin.value ? origin.value : null;
    const settled = p >= 0.999;
    const cover = o ? Math.max(o.width / fitW, o.height / fitH) : 0.9;
    const cw = settled ? W : (o ? o.width : fitW * 0.9) + (W - (o ? o.width : fitW * 0.9)) * p;
    const ch = settled ? H : (o ? o.height : fitH * 0.9) + (H - (o ? o.height : fitH * 0.9)) * p;
    const base = settled ? 1 : cover + (1 - cover) * p;
    return {
      left: (cw - fitW) / 2,
      top: (ch - fitH) / 2,
      transform: current
        ? [{ translateX: tx.value }, { translateY: ty.value }, { scale: base * scale.value }]
        : [{ translateX: 0 }, { translateY: 0 }, { scale: base }],
    };
  });

  return (
    <View style={{ width: stride, height: H }}>
      <Animated.View style={[styles.clip, clip]}>
        <Animated.View style={[{ position: 'absolute', width: fitW, height: fitH }, image]}>
          <Image source={{ uri: asset.uri }} recyclingKey={asset.id} contentFit="contain" style={StyleSheet.absoluteFill} />
          {hiRes && (
            <Image
              source={{ uri: asset.uri }}
              contentFit="contain"
              allowDownscaling={false}
              transition={150}
              style={StyleSheet.absoluteFill}
            />
          )}
          {player && <ActiveVideo asset={asset} />}
          {isVideo(asset) && !player && (
            <View style={styles.playBadge}>
              <Ionicons name="play" size={28} color="#fff" />
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
});

// ---- video -----------------------------------------------------------------------------

let activePlayer: VideoPlayer | null = null;
const playerListeners = new Set<() => void>();

function ActiveVideo({ asset }: { asset: Asset }) {
  const [uri, setUri] = useState<string | null>(asset.uri.startsWith('file://') ? asset.uri : null);
  useEffect(() => {
    if (!uri) shareableUri(asset).then(setUri).catch(() => {});
  }, [uri, asset]);
  if (!uri) return null;
  return <VideoSurface uri={uri} />;
}

function VideoSurface({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  useEffect(() => {
    activePlayer = player;
    playerListeners.forEach((l) => l());
    return () => {
      if (activePlayer === player) activePlayer = null;
      playerListeners.forEach((l) => l());
    };
  }, [player]);
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />;
}

/** Play/pause and a draggable scrubber for the current video. */
function VideoControls({ assetId, fg, accent }: { assetId: string; fg: string; accent: string }) {
  const [, force] = useState(0);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [playing, setPlaying] = useState(true);
  const barW = useRef(1);

  useEffect(() => {
    const l = () => force((n) => n + 1);
    playerListeners.add(l);
    return () => {
      playerListeners.delete(l);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      const p = activePlayer;
      if (!p) return;
      setTime(p.currentTime);
      setDur(p.duration);
      setPlaying(p.playing);
    }, 250);
    return () => clearInterval(t);
  }, [assetId]);

  const seek = (x: number) => {
    const p = activePlayer;
    if (!p || !dur) return;
    const t = Math.max(0, Math.min(1, x / barW.current)) * dur;
    p.currentTime = t;
    setTime(t);
  };

  const progress = dur ? time / dur : 0;
  return (
    <View style={styles.video}>
      <IconButton
        name={playing ? 'pause' : 'play'}
        color={fg}
        onPress={() => {
          const p = activePlayer;
          if (!p) return;
          p.playing ? p.pause() : p.play();
          setPlaying(!p.playing);
        }}
      />
      <Txt size={12} color={fg} style={styles.time}>
        {formatDuration(time)}
      </Txt>
      <View
        style={styles.track}
        onLayout={(e) => (barW.current = e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => seek(e.nativeEvent.locationX)}
        onResponderMove={(e) => seek(e.nativeEvent.locationX)}
      >
        <View style={[styles.trackBg, { backgroundColor: fg + '33' }]}>
          <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: accent, borderRadius: 2 }} />
        </View>
        <View style={[styles.knob, { left: `${progress * 100}%`, backgroundColor: fg }]} />
      </View>
      <Txt size={12} color={fg} style={styles.time}>
        {formatDuration(dur)}
      </Txt>
    </View>
  );
}

// ---- info ------------------------------------------------------------------------------

function InfoSheet({ visible, asset, onClose }: { visible: boolean; asset: Asset; onClose: () => void }) {
  const { colors } = useSettings();
  const [details, setDetails] = useState<MediaLibrary.AssetInfo | null>(null);

  useEffect(() => {
    if (visible) MediaLibrary.getAssetInfoAsync(asset).then(setDetails).catch(() => {});
  }, [visible, asset]);

  const date = new Date(asset.creationTime);
  const mp = (asset.width * asset.height) / 1e6;
  const loc = details?.location;
  const rows: [string, string][] = [
    ['Name', asset.filename],
    ['Taken', `${WHEN.format(date)}, ${TIME.format(date)}`],
    ['Size', `${asset.width} × ${asset.height}${mp >= 0.1 ? `  ·  ${mp.toFixed(1)} MP` : ''}`],
  ];
  if (isVideo(asset)) rows.push(['Length', formatDuration(asset.duration)]);
  if (loc) rows.push(['Location', `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`]);
  if (details?.localUri) rows.push(['Path', decodeURI(details.localUri.replace('file://', ''))]);

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: 8 }}>
        <Txt size={20} weight="700" style={{ marginBottom: 14 }}>
          Details
        </Txt>
        {rows.map(([k, v]) => (
          <View key={k} style={[styles.infoRow, { borderColor: colors.border }]}>
            <Txt dim size={13} style={{ width: 80 }}>
              {k}
            </Txt>
            <Txt size={14} style={{ flex: 1 }} selectable>
              {v}
            </Txt>
          </View>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  clip: { position: 'absolute', overflow: 'hidden' },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  bottom: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 10 },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 30 },
  smoke: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  shadeTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  shadeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  titlePill: { flex: 1, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 22, marginHorizontal: 8 },
  playBadge: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -34,
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginHorizontal: 16,
    paddingRight: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(30,30,34,0.6)',
  },
  time: { width: 44, textAlign: 'center', fontVariant: ['tabular-nums'] },
  track: { flex: 1, height: 36, justifyContent: 'center' },
  trackBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
  knob: { position: 'absolute', width: 14, height: 14, borderRadius: 7, marginLeft: -7 },
  infoRow: { flexDirection: 'row', paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
});
