import { Image } from 'expo-image';
import { View } from 'react-native';
import { useLibrary } from '../lib/library';
import type { Person } from '../lib/people';
import { useSettings } from '../lib/settings';

/** A round portrait cropped from the photo where this person's face is largest. */
export function FaceAvatar({ person, size }: { person: Person; size: number }) {
  const { colors } = useSettings();
  const { assets } = useLibrary();
  const asset = assets.find((a) => a.id === person.cover.assetId);
  const [x, y, w] = person.cover.box;
  const width = size / w;
  const height = width * (person.cover.h / person.cover.w);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: colors.placeholder }}>
      {asset && (
        <Image
          source={{ uri: asset.uri }}
          contentFit="fill"
          transition={150}
          style={{ position: 'absolute', width, height, left: -x * width, top: -y * height }}
        />
      )}
    </View>
  );
}
