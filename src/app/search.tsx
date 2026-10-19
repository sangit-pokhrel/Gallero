import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FaceAvatar } from '../components/FaceAvatar';
import { MediaGrid } from '../components/MediaGrid';
import { EmptyState, Txt } from '../components/ui';
import { groupBy, useLibrary, useVisibleAssets } from '../lib/library';
import { matchesQuery, searchText } from '../lib/utils';
import { useAlbums } from '../lib/media';
import { usePeople } from '../lib/people';
import { useSettings } from '../lib/settings';

const MONTH_YEAR = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useSettings();
  const [query, setQuery] = useState('');
  const q = useDeferredValue(query.trim().toLowerCase());
  const { assets } = useVisibleAssets(true);
  const { albumTitles } = useLibrary();
  const { albums } = useAlbums();
  const { people } = usePeople();

  // One lowercase "description" per item: what it is, when, where it lives, who's in it.
  const haystack = useMemo(() => {
    const names = new Map<string, string[]>();
    for (const p of people) if (p.name) for (const id of p.assetIds) names.set(id, [...(names.get(id) ?? []), p.name.toLowerCase()]);
    return assets.map((a) => searchText(a, albumTitles, names.get(a.id) ?? []));
  }, [assets, albumTitles, people]);

  const results = useMemo(() => {
    if (!q) return [];
    return assets.filter((_, i) => matchesQuery(haystack[i], q));
  }, [q, assets, haystack]);

  const matchPeople = q ? people.filter((p) => p.name?.toLowerCase().includes(q)) : people.filter((p) => p.name).slice(0, 8);
  const matchAlbums = q ? albums.filter((a) => a.title.toLowerCase().includes(q)) : [];
  const months = useMemo(
    () =>
      [...groupBy(assets, (a) => MONTH_YEAR.format(new Date(a.creationTime))).entries()]
        .slice(0, 8)
        .map(([label, list]) => ({ label, cover: list[0] })),
    [assets],
  );

  const suggestions = ['Videos', 'Screenshots', 'Selfies', ...months.slice(0, 4).map((m) => m.label)];

  const header = (
    <View>
      {matchPeople.length > 0 && (
        <>
          <Label>{q ? 'People' : 'Your People'}</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hrow}>
            {matchPeople.map((p) => (
              <Pressable key={p.id} onPress={() => router.push({ pathname: '/person/[id]', params: { id: p.id } })} style={{ alignItems: 'center', width: 72 }}>
                <FaceAvatar person={p} size={64} />
                <Txt size={12} numberOfLines={1} style={{ marginTop: 6 }}>
                  {p.name}
                </Txt>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}
      {matchAlbums.length > 0 && (
        <>
          <Label>Albums</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hrow}>
            {matchAlbums.map((a) => (
              <Pressable key={a.id} onPress={() => router.push({ pathname: '/album/[id]', params: { id: a.id, title: a.title } })} style={{ width: 110 }}>
                <Image source={a.cover ? { uri: a.cover } : undefined} contentFit="cover" style={[styles.albumCover, { backgroundColor: colors.placeholder }]} />
                <Txt size={13} weight="500" numberOfLines={1} style={{ marginTop: 6 }}>
                  {a.title}
                </Txt>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}
      {q ? (
        <Label>{`${results.length.toLocaleString()} ${results.length === 1 ? 'Result' : 'Results'}`}</Label>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 8 }}>
      <View style={styles.bar}>
        <View style={[styles.field, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="search" size={19} color={colors.textDim} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder="Places, people, months, albums…"
            placeholderTextColor={colors.textFaint}
            returnKeyType="search"
            style={[styles.input, { color: colors.text }]}
          />
          {!!query && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textFaint} />
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Txt size={16} weight="500" color={colors.accent}>
            Cancel
          </Txt>
        </Pressable>
      </View>

      {q ? (
        <Animated.View entering={FadeIn.duration(150)} style={{ flex: 1 }}>
          <MediaGrid
            source={`search:${q}`}
            assets={results}
            header={header}
            bottomInset={30}
            empty={<EmptyState icon="search" title="No results" body={`Nothing matched “${query.trim()}”.`} />}
          />
        </Animated.View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
          {header}
          <Label>Try</Label>
          <View style={styles.chips}>
            {suggestions.map((s) => (
              <Pressable key={s} onPress={() => setQuery(s)} style={[styles.chip, { backgroundColor: colors.surfaceAlt }]}>
                <Txt size={14} weight="500">
                  {s}
                </Txt>
              </Pressable>
            ))}
          </View>
          <Label>Recent Months</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hrow}>
            {months.map((m) => (
              <Pressable key={m.label} onPress={() => setQuery(m.label)} style={{ width: 130 }}>
                <Image source={{ uri: m.cover.uri }} contentFit="cover" style={[styles.monthCover, { backgroundColor: colors.placeholder }]} />
                <Txt size={13} weight="500" numberOfLines={1} style={{ marginTop: 6 }}>
                  {m.label}
                </Txt>
              </Pressable>
            ))}
          </ScrollView>
        </ScrollView>
      )}
    </View>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Txt size={20} weight="800" style={{ marginHorizontal: 20, marginTop: 22, marginBottom: 12, letterSpacing: -0.4 }}>
      {children}
    </Txt>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, borderRadius: 23, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 16, paddingVertical: 0 },
  hrow: { paddingHorizontal: 20, gap: 14 },
  albumCover: { width: 110, height: 110, borderRadius: 16 },
  monthCover: { width: 130, height: 130, borderRadius: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
});
