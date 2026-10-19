import { router } from 'expo-router';
import { FlatList, Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FaceAvatar } from '../components/FaceAvatar';
import { TopFade } from '../components/Glass';
import { EmptyState, Header, Txt } from '../components/ui';
import { scanLabel, usePeople } from '../lib/people';
import { useSettings } from '../lib/settings';

export default function PeopleScreen() {
  const { people, status, scanned, total } = usePeople();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const cols = 3;
  const size = (width - 32 - 20 * (cols - 1)) / cols;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={people}
        numColumns={cols}
        keyExtractor={(p) => p.id}
        columnWrapperStyle={{ gap: 20, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 22, paddingBottom: 60 + insets.bottom }}
        ListHeaderComponent={
          <Header back title="People" subtitle={scanLabel(status, scanned, total) ?? `${people.length} people`} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title={status === 'scanning' ? 'Looking for faces…' : 'No people yet'}
            body={
              !settings.peopleScan
                ? 'People detection is off. Turn it on in Studio.'
                : 'Gallero recognises the faces in your photos right on your phone and groups each person together.'
            }
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/person/[id]', params: { id: item.id } })}
            style={({ pressed }) => ({ width: size, alignItems: 'center', transform: [{ scale: pressed ? 0.95 : 1 }] })}
          >
            <FaceAvatar person={item} size={size} />
            <Txt weight="600" numberOfLines={1} style={{ marginTop: 8 }}>
              {item.name ?? ''}
            </Txt>
            <Txt size={12} faint>
              {item.assetIds.length}
            </Txt>
          </Pressable>
        )}
      />
      <TopFade height={insets.top + 8} />
    </View>
  );
}
