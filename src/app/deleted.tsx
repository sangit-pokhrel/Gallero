import { useMemo } from 'react';
import { Alert, View } from 'react-native';
import { GlassButton } from '../components/Glass';
import { GridPage } from '../components/GridPage';
import { LockGate } from '../components/LockGate';
import { toast } from '../components/ui';
import { deleteForever, restoreFromTrash, useVault } from '../lib/vault';

export default function RecentlyDeletedScreen() {
  const { trash } = useVault();
  const assets = useMemo(() => trash.map((e) => ({ ...e.asset, id: e.id })), [trash]);

  const recoverAll = async () => {
    const n = await restoreFromTrash(trash.map((e) => e.id));
    toast(`Restored ${n} item${n === 1 ? '' : 's'}`);
  };
  const deleteAll = () =>
    Alert.alert('Delete all forever?', 'These items will be permanently removed. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete All', style: 'destructive', onPress: () => deleteForever(trash.map((e) => e.id)) },
    ]);

  return (
    <LockGate title="Recently Deleted">
      <GridPage
        source="trash"
        mode="trash"
        title="Recently Deleted"
        subtitle="Items are kept for 30 days, then removed for good."
        assets={assets}
        right={
          trash.length ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <GlassButton icon="arrow-undo-outline" onPress={recoverAll} />
              <GlassButton icon="trash-outline" color="#F0605D" onPress={deleteAll} />
            </View>
          ) : undefined
        }
        emptyTitle="No recently deleted items"
        emptyBody="Deleted photos and videos stay here for 30 days so you can get them back."
      />
    </LockGate>
  );
}
