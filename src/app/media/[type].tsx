import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { GridPage } from '../../components/GridPage';
import { mediaTypes, useLibrary, useVisibleAssets } from '../../lib/library';

export default function MediaTypeScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const { assets } = useVisibleAssets(true);
  const { albumTitles } = useLibrary();
  const def = mediaTypes.find((m) => m.key === type);
  const list = useMemo(() => (def ? assets.filter((a) => def.test(a, albumTitles)) : []), [assets, albumTitles, def]);
  return <GridPage source={`media:${type}`} title={def?.label ?? 'Media'} assets={list} />;
}
