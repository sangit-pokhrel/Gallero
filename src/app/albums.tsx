import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, Header, IconButton, Txt } from '../components/ui';
import { useAlbums, type AlbumWithCover } from '../lib/media';
import { useSettings } from '../lib/settings';

export default function AlbumsScreen() {
  const { settings, colors, update, tick } = useSettings();
  const { albums, loading } = useAlbums();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [showHidden, setShowHidden] = useState(false);

  const cols = settings.albumColumns;
  const pad = 16;
  const gap = 14;
  const size = (width - pad * 2 - gap * (cols - 1)) / cols;
  const hidden = new Set(settings.hiddenAlbums);

  const list = useMemo(() => {
    const visible = albums.filter((a) => showHidden || !hidden.has(a.id));
    return visible.sort((a, b) =>
      settings.albumSort === 'name' ? a.title.localeCompare(b.title) : b.assetCount - a.assetCount,
    );
  }, [albums, showHidden, settings.hiddenAlbums, settings.albumSort]);

  const toggleHidden = (album: AlbumWithCover) => {
    tick();
    const isHidden = hidden.has(album.id);
    Alert.alert(album.title, isHidden ? 'Show this album again?' : 'Hide this album from the list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: isHidden ? 'Unhide' : 'Hide',
        onPress: () =>
          update({
            hiddenAlbums: isHidden
              ? settings.hiddenAlbums.filter((id) => id !== album.id)
              : [...settings.hiddenAlbums, album.id],
          }),
      },
    ]);
  };

  return (
    <FlatList
      key={cols}
      data={list}
      numColumns={cols}
      keyExtractor={(a) => a.id}
      columnWrapperStyle={cols > 1 ? { gap, paddingHorizontal: pad } : undefined}
      contentContainerStyle={{ paddingBottom: 120 + insets.bottom, gap: 20 }}
      ListHeaderComponent={
        <Header
          back
          title="Albums"
          subtitle={`${list.length} albums${settings.hiddenAlbums.length ? ` · ${settings.hiddenAlbums.length} hidden` : ''}`}
          right={
            <>
              {settings.hiddenAlbums.length > 0 && (
                <IconButton name={showHidden ? 'eye' : 'eye-off-outline'} onPress={() => setShowHidden((s) => !s)} />
              )}
              <IconButton
                name={settings.albumSort === 'name' ? 'text' : 'stats-chart-outline'}
                onPress={() => update({ albumSort: settings.albumSort === 'name' ? 'count' : 'name' })}
              />
              <IconButton
                name={cols === 1 ? 'reorder-four-outline' : cols === 2 ? 'grid-outline' : 'apps-outline'}
                onPress={() => update({ albumColumns: cols >= 3 ? 1 : cols + 1 })}
              />
            </>
          }
        />
      }
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 80 }} />
        ) : (
          <EmptyState icon="albums-outline" title="No albums" />
        )
      }
      renderItem={({ item }) => {
        const isHidden = hidden.has(item.id);
        const coverH = cols === 1 ? 200 : size;
        return (
          <Pressable
            onPress={() => router.push({ pathname: '/album/[id]', params: { id: item.id, title: item.title } })}
            onLongPress={() => toggleHidden(item)}
            style={({ pressed }) => ({
              width: cols === 1 ? width - pad * 2 : size,
              marginHorizontal: cols === 1 ? pad : 0,
              opacity: pressed ? 0.7 : isHidden ? 0.45 : 1,
            })}
          >
            <Image
              source={item.cover ? { uri: item.cover } : undefined}
              contentFit="cover"
              transition={150}
              style={[
                styles.cover,
                { height: coverH, borderRadius: Math.min(Math.max(settings.radius * 2, 10), 28), backgroundColor: colors.placeholder },
              ]}
            />
            <View style={styles.meta}>
              <Txt weight="600" numberOfLines={1} style={{ flex: 1 }}>
                {item.title}
              </Txt>
              {isHidden && <Ionicons name="eye-off" size={13} color={colors.textFaint} />}
            </View>
            <Txt size={13} dim>
              {item.assetCount.toLocaleString()}
            </Txt>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
});
