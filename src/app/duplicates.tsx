import { useMemo } from 'react';
import { GridPage } from '../components/GridPage';
import { findDuplicates, useVisibleAssets } from '../lib/library';

export default function DuplicatesScreen() {
  const { assets } = useVisibleAssets(true);
  const list = useMemo(() => findDuplicates(assets), [assets]);
  return (
    <GridPage
      source="duplicates"
      title="Duplicates"
      subtitle={list.length ? `${list.length} items saved more than once` : undefined}
      assets={list}
      emptyTitle="No duplicates"
      emptyBody="Photos saved more than once will show up here so you can clean them up."
    />
  );
}
