import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSettings } from '../lib/settings';
import { unlockVault, useVault } from '../lib/vault';
import { Header, PrimaryButton, Txt } from './ui';

/** Shows children only after fingerprint / face / screen-lock verification. */
export function LockGate({ title, children }: { title: string; children: ReactNode }) {
  const { unlocked } = useVault();
  const { colors } = useSettings();
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    if (!unlocked && !asked) {
      setAsked(true);
      unlockVault(`Unlock ${title}`);
    }
  }, [unlocked, asked]);

  if (unlocked) return <Animated.View entering={FadeIn.duration(200)} style={{ flex: 1 }}>{children}</Animated.View>;

  return (
    <View style={{ flex: 1 }}>
      <Header back title={title} />
      <View style={styles.center}>
        <View style={[styles.icon, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="lock-closed" size={30} color={colors.accent} />
        </View>
        <Txt size={20} weight="700" style={{ marginTop: 18 }}>
          {title} is locked
        </Txt>
        <Txt dim style={{ marginTop: 8, textAlign: 'center', lineHeight: 21 }}>
          Use your fingerprint, face, or screen lock PIN / pattern to view.
        </Txt>
        <View style={{ marginTop: 28, alignSelf: 'stretch' }}>
          <PrimaryButton label={`View ${title}`} onPress={() => unlockVault(`Unlock ${title}`)} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingBottom: 80 },
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
});
