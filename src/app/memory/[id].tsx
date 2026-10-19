import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GridPage } from '../../components/GridPage';
import { Txt } from '../../components/ui';
import { useMemories } from '../../lib/memories';
import { useSettings } from '../../lib/settings';
import { openViewer } from '../../lib/viewer';

export default function MemoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const memory = useMemories().find((m) => m.id === id);
  const { width } = useWindowDimensions();
  const { colors } = useSettings();

  if (!memory) return <GridPage source={`memory:${id}`} title="Memory" assets={[]} />;

  const play = () => {
    openViewer({ source: `memory:${id}`, assets: memory.assets, index: 0, autoplay: true });
    router.push('/viewer');
  };

  return (
    <GridPage
      source={`memory:${id}`}
      title={memory.title}
      subtitle={memory.subtitle}
      assets={memory.assets}
      hero={
        <Pressable onPress={play} style={[styles.hero, { width: width - 32, height: (width - 32) * 1.15 }]}>
          <Image source={{ uri: memory.cover.uri }} contentFit="cover" transition={200} style={[StyleSheet.absoluteFill, { backgroundColor: colors.placeholder }]} />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={styles.shade} />
          <View style={styles.play}>
            <Ionicons name="play" size={22} color="#000" />
            <Txt weight="700" color="#000">
              Play Memory
            </Txt>
          </View>
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  hero: { alignSelf: 'center', borderRadius: 28, overflow: 'hidden', marginBottom: 16 },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
  play: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 26,
  },
});
