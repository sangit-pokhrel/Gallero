import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Asset } from '../lib/media';
import { useVault } from '../lib/vault';
import { TopFade } from './Glass';
import { MediaGrid } from './MediaGrid';
import { EmptyState, Header } from './ui';

/** A pushed page showing a set of photos: back button, big title, grid. */
export function GridPage({
  source,
  title,
  subtitle,
  assets,
  hero,
  right,
  mode = 'normal',
  emptyTitle = 'Nothing here yet',
  emptyBody,
  loadMore,
}: {
  source: string;
  title: string;
  subtitle?: string;
  assets: Asset[];
  hero?: ReactElement;
  right?: ReactElement;
  mode?: 'normal' | 'hidden' | 'trash';
  emptyTitle?: string;
  emptyBody?: string;
  loadMore?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { hidden } = useVault();
  // Hidden items never leak into ordinary collections.
  const visible = useMemo(
    () => (mode === 'normal' ? assets.filter((a) => !hidden.has(a.id)) : assets),
    [assets, hidden, mode],
  );
  return (
    <View style={{ flex: 1 }}>
      <MediaGrid
        source={source}
        assets={visible}
        mode={mode}
        loadMore={loadMore}
        bottomInset={30}
        header={
          <View>
            <Header back title={title} subtitle={subtitle ?? `${visible.length.toLocaleString()} items`} right={right} />
            {hero}
          </View>
        }
        empty={<EmptyState icon="images-outline" title={emptyTitle} body={emptyBody} />}
      />
      <TopFade height={insets.top + 8} />
    </View>
  );
}
