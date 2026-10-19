import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { GridPage } from '../../components/GridPage';
import { useAssets } from '../../lib/media';
import { useSettings } from '../../lib/settings';

export default function AlbumScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const { settings, colors } = useSettings();
  const { assets, total, loading, loadMore } = useAssets({
    albumId: id,
    showVideos: settings.showVideos,
    newestFirst: settings.newestFirst,
  });

  if (loading && !assets.length) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <GridPage
      source={`album:${id}`}
      title={title ?? 'Album'}
      subtitle={`${total.toLocaleString()} items`}
      assets={assets}
      loadMore={loadMore}
      emptyTitle="This album is empty"
    />
  );
}
