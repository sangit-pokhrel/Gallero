import { useMemo } from 'react';
import { GridPage } from '../components/GridPage';
import { LockGate } from '../components/LockGate';
import { useLibrary } from '../lib/library';
import { useVault } from '../lib/vault';

export default function HiddenScreen() {
  const { assets } = useLibrary();
  const { hidden } = useVault();
  const list = useMemo(() => assets.filter((a) => hidden.has(a.id)), [assets, hidden]);
  return (
    <LockGate title="Hidden">
      <GridPage
        source="hidden"
        mode="hidden"
        title="Hidden"
        assets={list}
        emptyTitle="No hidden items"
        emptyBody="Long-press photos and choose Hide to keep them here, out of your Library."
      />
    </LockGate>
  );
}
