import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { FaceAvatar } from '../../components/FaceAvatar';
import { GlassButton } from '../../components/Glass';
import { GridPage } from '../../components/GridPage';
import { Sheet } from '../../components/Sheet';
import { PrimaryButton, toast, Txt } from '../../components/ui';
import { useVisibleAssets } from '../../lib/library';
import { mergePeople, renamePerson, usePeople } from '../../lib/people';
import { useSettings } from '../../lib/settings';

export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { people } = usePeople();
  const { assets } = useVisibleAssets(true);
  const { colors } = useSettings();
  const person = people.find((p) => p.id === id);
  const [sheet, setSheet] = useState<null | 'name' | 'merge'>(null);
  const [name, setName] = useState(person?.name ?? '');

  const list = useMemo(() => {
    const ids = new Set(person?.assetIds ?? []);
    return assets.filter((a) => ids.has(a.id));
  }, [assets, person]);

  if (!person) return <GridPage source={`person:${id}`} title="Person" assets={[]} />;

  return (
    <>
      <GridPage
        source={`person:${id}`}
        title={person.name ?? 'Add Name'}
        subtitle={`${list.length.toLocaleString()} photos`}
        assets={list}
        right={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <GlassButton icon="git-merge-outline" onPress={() => setSheet('merge')} />
            <GlassButton icon="create-outline" onPress={() => setSheet('name')} />
          </View>
        }
        hero={
          <Pressable onPress={() => setSheet('name')} style={styles.hero}>
            <FaceAvatar person={person} size={120} />
          </Pressable>
        }
      />

      <Sheet visible={sheet === 'name'} onClose={() => setSheet(null)}>
        <View style={{ paddingHorizontal: 8 }}>
          <Txt size={20} weight="700" style={{ marginBottom: 14 }}>
            Who is this?
          </Txt>
          <TextInput
            value={name}
            onChangeText={setName}
            autoFocus
            placeholder="Name"
            placeholderTextColor={colors.textFaint}
            style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceAlt }]}
            onSubmitEditing={() => {
              renamePerson(person.id, name);
              setSheet(null);
            }}
          />
          <View style={{ marginTop: 14 }}>
            <PrimaryButton
              label="Save"
              onPress={() => {
                renamePerson(person.id, name);
                setSheet(null);
              }}
            />
          </View>
        </View>
      </Sheet>

      <Sheet visible={sheet === 'merge'} onClose={() => setSheet(null)}>
        <Txt size={20} weight="700" style={{ marginBottom: 6, marginLeft: 8 }}>
          Same person as…
        </Txt>
        <Txt dim size={13} style={{ marginBottom: 12, marginLeft: 8 }}>
          Pick another group of this person to combine them.
        </Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingHorizontal: 8, paddingBottom: 8 }}>
          {people
            .filter((p) => p.id !== person.id)
            .map((p) => (
              <Pressable
                key={p.id}
                onPress={() => {
                  mergePeople(person.id, p.id);
                  setSheet(null);
                  toast('Merged');
                }}
                style={{ alignItems: 'center', width: 76 }}
              >
                <FaceAvatar person={p} size={68} />
                <Txt size={12} numberOfLines={1} style={{ marginTop: 6 }}>
                  {p.name ?? `${p.assetIds.length} photos`}
                </Txt>
              </Pressable>
            ))}
        </ScrollView>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { alignSelf: 'center', marginBottom: 18 },
  input: { fontSize: 17, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16 },
});
