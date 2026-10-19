import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useAlbums } from '../lib/media';
import { useSettings } from '../lib/settings';
import { Txt, type IconName } from './ui';

const SPRING = { damping: 26, stiffness: 260, mass: 0.9 };

/** Bottom sheet with a spring entrance, drag-to-dismiss and a fading scrim. */
export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const { colors } = useSettings();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const y = useSharedValue(height);
  const drag = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      drag.value = 0;
      y.value = withSpring(0, SPRING);
    } else if (mounted) {
      y.value = withTiming(height, { duration: 220 }, (done) => {
        if (done) scheduleOnRN(setMounted, false);
      });
    }
  }, [visible]);

  const pan = usePanGesture({
    activeOffsetY: 8,
    onUpdate: (e) => {
      'worklet';
      // Resist upward drags, follow downward ones.
      drag.value = e.translationY > 0 ? e.translationY : e.translationY / 6;
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > 110 || e.velocityY > 900) {
        scheduleOnRN(onClose);
      } else {
        drag.value = withSpring(0, SPRING);
      }
    },
  });

  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: y.value + drag.value }] }));
  const scrim = useAnimatedStyle(() => ({ opacity: 1 - Math.min((y.value + drag.value) / 500, 1) }));

  if (!mounted) return null;

  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrim]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 }, panel]}
          >
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            {children}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

export type Action = { icon: IconName; label: string; onPress: () => void; danger?: boolean; hint?: string };

export function ActionSheet({
  visible,
  onClose,
  title,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  actions: Action[];
}) {
  const { colors } = useSettings();
  return (
    <Sheet visible={visible} onClose={onClose}>
      {!!title && (
        <Txt size={13} faint weight="600" style={{ marginBottom: 6, marginLeft: 4, letterSpacing: 0.6 }}>
          {title.toUpperCase()}
        </Txt>
      )}
      {actions.map((a) => (
        <Pressable
          key={a.label}
          onPress={() => {
            onClose();
            // Let the sheet start closing before heavy work kicks in.
            setTimeout(a.onPress, 60);
          }}
          style={({ pressed }) => [styles.action, { backgroundColor: pressed ? colors.surfaceAlt : 'transparent' }]}
        >
          <View style={[styles.actionIcon, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name={a.icon} size={19} color={a.danger ? '#F0605D' : colors.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt weight="500" color={a.danger ? '#F0605D' : undefined}>
              {a.label}
            </Txt>
            {!!a.hint && (
              <Txt size={12} faint>
                {a.hint}
              </Txt>
            )}
          </View>
        </Pressable>
      ))}
    </Sheet>
  );
}

export function AlbumPicker({
  visible,
  onClose,
  title,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  onPick: (target: { albumId?: string; newName?: string }) => void;
}) {
  const { colors } = useSettings();
  const { albums } = useAlbums();
  const [name, setName] = useState('');
  const { height } = useWindowDimensions();

  const pick = (t: { albumId?: string; newName?: string }) => {
    onClose();
    setName('');
    onPick(t);
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Txt size={20} weight="700" style={{ marginBottom: 14, marginLeft: 4 }}>
        {title}
      </Txt>
      <View style={[styles.newAlbum, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name="add" size={20} color={colors.textDim} />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="New album name"
          placeholderTextColor={colors.textFaint}
          style={{ flex: 1, color: colors.text, fontSize: 15, paddingVertical: 12 }}
          returnKeyType="done"
          onSubmitEditing={() => name.trim() && pick({ newName: name.trim() })}
        />
        {!!name.trim() && (
          <Pressable onPress={() => pick({ newName: name.trim() })} style={[styles.create, { backgroundColor: colors.text }]}>
            <Txt size={13} weight="600" color={colors.bg}>
              Create
            </Txt>
          </Pressable>
        )}
      </View>
      <ScrollView style={{ maxHeight: height * 0.45 }} showsVerticalScrollIndicator={false}>
        {albums
          .filter((a) => a.title)
          .sort((a, b) => b.assetCount - a.assetCount)
          .map((a) => (
            <Pressable
              key={a.id}
              onPress={() => pick({ albumId: a.id })}
              style={({ pressed }) => [styles.action, { backgroundColor: pressed ? colors.surfaceAlt : 'transparent' }]}
            >
              <Image
                source={a.cover ? { uri: a.cover } : undefined}
                contentFit="cover"
                style={[styles.albumThumb, { backgroundColor: colors.placeholder }]}
              />
              <View style={{ flex: 1 }}>
                <Txt weight="500" numberOfLines={1}>
                  {a.title}
                </Txt>
                <Txt size={12} faint>
                  {a.assetCount.toLocaleString()}
                </Txt>
              </View>
            </Pressable>
          ))}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 14 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 10, borderRadius: 16 },
  actionIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  newAlbum: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    paddingRight: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  create: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  albumThumb: { width: 44, height: 44, borderRadius: 10 },
});
