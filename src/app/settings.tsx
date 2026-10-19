import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header, Logo, Txt } from '../components/ui';
import { useAssets } from '../lib/media';
import { scanLabel, startPeopleScan, stopPeopleScan, usePeople } from '../lib/people';
import { perf } from '../lib/perf';
import { useSettings, type Settings } from '../lib/settings';
import { accents, palettes } from '../lib/theme';

export default function StudioScreen() {
  const { settings, update, reset, colors } = useSettings();
  const insets = useSafeAreaInsets();
  const people = usePeople();

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 130 + insets.bottom }} showsVerticalScrollIndicator={false}>
      <Header back title="Studio" subtitle="Make Gallero yours" />
      <Preview />

      <Section title="Appearance">
        <Label>Theme</Label>
        <View style={styles.themes}>
          {(['system', 'light', 'dark', 'amoled', 'paper'] as const).map((t) => {
            const p = t === 'system' ? null : palettes[t];
            const active = settings.theme === t;
            return (
              <Pressable key={t} onPress={() => update({ theme: t })} style={{ alignItems: 'center', gap: 6 }}>
                <View
                  style={[
                    styles.themeSwatch,
                    { borderColor: active ? colors.accent : colors.border, borderWidth: active ? 2 : 1 },
                  ]}
                >
                  {p ? (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: p.bg }]}>
                      <View style={[styles.themeLine, { backgroundColor: p.text, width: 22 }]} />
                      <View style={[styles.themeLine, { backgroundColor: p.textFaint, width: 14 }]} />
                    </View>
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
                      <View style={{ flex: 1, backgroundColor: palettes.light.bg }} />
                      <View style={{ flex: 1, backgroundColor: palettes.dark.bg }} />
                    </View>
                  )}
                </View>
                <Txt size={12} weight={active ? '600' : '400'} dim={!active}>
                  {t === 'amoled' ? 'AMOLED' : t[0].toUpperCase() + t.slice(1)}
                </Txt>
              </Pressable>
            );
          })}
        </View>

        <Label>Accent</Label>
        <View style={styles.swatches}>
          {accents.map((a) => {
            const active = settings.accent === a.color;
            return (
              <Pressable
                key={a.color}
                onPress={() => update({ accent: a.color })}
                style={[styles.swatchRing, { borderColor: active ? a.color : 'transparent' }]}
              >
                <View style={[styles.swatch, { backgroundColor: a.color }]}>
                  {active && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Label>Typeface</Label>
        <Chips
          value={settings.font}
          onChange={(font) => update({ font })}
          options={[
            ['sans', 'Sans'],
            ['serif', 'Serif'],
            ['mono', 'Mono'],
            ['rounded', 'Light'],
          ]}
        />
        <Toggle label="Large titles" k="largeTitles" />
        <Label hint={perf.blur ? 'Real blur supported' : 'Lighter effect on this phone'}>Glass effects</Label>
        <Chips
          value={settings.glass}
          onChange={(glass) => update({ glass })}
          options={[
            ['auto', 'Auto'],
            ['on', 'On'],
            ['off', 'Off'],
          ]}
        />
      </Section>

      <Section title="Grid">
        <Label hint="or pinch the grid">Columns</Label>
        <Chips
          value={settings.columns}
          onChange={(columns) => update({ columns })}
          options={[2, 3, 4, 5, 6].map((n) => [n, String(n)] as const)}
        />
        <Label>Spacing</Label>
        <Chips
          value={settings.gap}
          onChange={(gap) => update({ gap })}
          options={[
            [0, 'None'],
            [1, 'Hair'],
            [2, 'Tight'],
            [4, 'Airy'],
            [8, 'Loose'],
          ]}
        />
        <Label>Corners</Label>
        <Chips
          value={settings.radius}
          onChange={(radius) => update({ radius })}
          options={[
            [0, 'Sharp'],
            [3, 'Soft'],
            [6, 'Smooth'],
            [12, 'Round'],
            [999, 'Circle'],
          ]}
        />
        <Label>Group by</Label>
        <Chips
          value={settings.grouping}
          onChange={(grouping) => update({ grouping })}
          options={[
            ['month', 'Month'],
            ['day', 'Day'],
            ['none', 'Nothing'],
          ]}
        />
        <Toggle label="Newest first" k="newestFirst" />
      </Section>

      <Section title="People">
        <View style={styles.toggle}>
          <View style={{ flex: 1 }}>
            <Txt weight="500">Recognise people</Txt>
            <Txt size={12} faint>
              {scanLabel(people.status, people.scanned, people.total) ?? `${people.people.length} people found · on-device only`}
            </Txt>
          </View>
          <Switch
            value={settings.peopleScan}
            onValueChange={(v) => {
              update({ peopleScan: v });
              v ? startPeopleScan() : stopPeopleScan();
            }}
            trackColor={{ true: colors.accent, false: colors.surfaceAlt }}
            thumbColor="#fff"
          />
        </View>
      </Section>

      <Section title="Media">
        <Toggle label="Show videos" k="showVideos" />
        <Toggle label="Video duration badges" k="videoBadges" />
        <Toggle label="Black viewer background" k="viewerBlack" />
        <Toggle label="Haptic feedback" k="haptics" />
      </Section>

      <Section title="Reset">
        {settings.hiddenAlbums.length > 0 && (
          <Row label={`Unhide ${settings.hiddenAlbums.length} albums`} onPress={() => update({ hiddenAlbums: [] })} />
        )}
        <Row
          label="Restore default look"
          danger
          onPress={() =>
            Alert.alert('Restore defaults?', 'All customizations will be reset.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Restore', style: 'destructive', onPress: reset },
            ])
          }
        />
      </Section>

      <View style={styles.about}>
        <Logo size={44} accent={colors.accent} />
        <Txt weight="600" style={{ marginTop: 10 }}>
          Gallero
        </Txt>
        <Txt size={12} faint style={{ marginTop: 2 }}>
          v{Constants.expoConfig?.version ?? '1.0.0'} · no ads · fully offline
        </Txt>
      </View>
    </ScrollView>
  );
}

function Preview() {
  const { settings, colors } = useSettings();
  const { width } = useWindowDimensions();
  const { assets } = useAssets({ showVideos: false, newestFirst: true, pageSize: 12 });
  const cols = settings.columns;
  const gap = settings.gap;
  const inner = width - 40 - 24;
  const tile = (inner - gap * (cols - 1)) / cols;
  const items = Array.from({ length: cols * 2 }, (_, i) => assets[i]);

  return (
    <View style={[styles.preview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Txt size={12} faint weight="600" style={{ marginBottom: 10, letterSpacing: 1 }}>
        PREVIEW
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
        {items.map((a, i) => (
          <Image
            key={a?.id ?? i}
            source={a ? { uri: a.uri } : undefined}
            contentFit="cover"
            style={{
              width: tile,
              height: tile,
              borderRadius: settings.radius,
              backgroundColor: i === 0 ? colors.accent : colors.placeholder,
            }}
          />
        ))}
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useSettings();
  return (
    <View style={{ marginTop: 26, paddingHorizontal: 20 }}>
      <Txt size={12} weight="600" faint style={{ letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
        {title.toUpperCase()}
      </Txt>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>
    </View>
  );
}

function Label({ children, hint }: { children: string; hint?: string }) {
  return (
    <View style={styles.label}>
      <Txt weight="500">{children}</Txt>
      {!!hint && (
        <Txt size={12} faint>
          {hint}
        </Txt>
      )}
    </View>
  );
}

function Chips<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly (readonly [T, string])[];
}) {
  const { colors } = useSettings();
  return (
    <View style={[styles.chips, { backgroundColor: colors.surfaceAlt }]}>
      {options.map(([v, label]) => {
        const active = v === value;
        return (
          <Pressable
            key={String(v)}
            onPress={() => onChange(v)}
            style={[styles.chip, active && { backgroundColor: colors.accent }]}
          >
            <Txt size={13} weight={active ? '700' : '500'} color={active ? '#fff' : colors.textDim}>
              {label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

type BoolKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

function Toggle({ label, k }: { label: string; k: BoolKey }) {
  const { settings, update, colors } = useSettings();
  return (
    <View style={styles.toggle}>
      <Txt weight="500" style={{ flex: 1 }}>
        {label}
      </Txt>
      <Switch
        value={settings[k]}
        onValueChange={(v) => update({ [k]: v } as Partial<Settings>)}
        trackColor={{ true: colors.accent, false: colors.surfaceAlt }}
        thumbColor="#fff"
      />
    </View>
  );
}

function Row({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const { colors } = useSettings();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.toggle, { opacity: pressed ? 0.6 : 1 }]}>
      <Txt weight="500" color={danger ? '#F0605D' : undefined} style={{ flex: 1 }}>
        {label}
      </Txt>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  preview: { marginHorizontal: 20, marginTop: 4, padding: 12, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth },
  card: { borderRadius: 22, paddingHorizontal: 16, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth },
  label: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 14, marginBottom: 10 },
  themes: { flexDirection: 'row', justifyContent: 'space-between' },
  themeSwatch: { width: 52, height: 64, borderRadius: 14, overflow: 'hidden' },
  themeLine: { height: 4, borderRadius: 2, marginLeft: 8, marginTop: 10 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  swatchRing: { padding: 3, borderRadius: 22, borderWidth: 2 },
  swatch: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', padding: 4, borderRadius: 16, marginBottom: 6 },
  chip: { flex: 1, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toggle: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  about: { alignItems: 'center', marginTop: 40 },
});
