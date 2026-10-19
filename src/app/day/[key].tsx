import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { GridPage } from '../../components/GridPage';
import { dayKey, useVisibleAssets } from '../../lib/library';
import { dayLabel } from '../../lib/memories';

export default function DayScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { assets } = useVisibleAssets(true);
  const list = useMemo(() => assets.filter((a) => dayKey(a.creationTime) === key), [assets, key]);
  return <GridPage source={`day:${key}`} title={dayLabel(key)} assets={list} />;
}
