import * as MediaLibrary from 'expo-media-library/legacy';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Logo, PrimaryButton, ToastHost, Txt } from '../components/ui';
import { FavoritesProvider } from '../lib/favorites';
import { startLibrary } from '../lib/library';
import { watchLibrary } from '../lib/media';
import { initPeople } from '../lib/people';
import { perf } from '../lib/perf';
import { loadVault } from '../lib/vault';
import { SettingsProvider, useSettings } from '../lib/settings';

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 150, fade: true });

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SettingsProvider>
          <FavoritesProvider>
            <Gate />
          </FavoritesProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Gate() {
  const { colors, ready, settings } = useSettings();
  const [permission, request] = MediaLibrary.usePermissions({ granularPermissions: ['photo', 'video'] });

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  useEffect(() => {
    if (!permission?.granted) return;
    watchLibrary();
    startLibrary();
    loadVault();
    initPeople(settings.peopleScan);
  }, [permission?.granted]);

  const statusBar = <StatusBar style={colors.dark ? 'light' : 'dark'} />;

  if (!ready || !permission) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg, padding: 32 }]}>
        {statusBar}
        <Animated.View entering={FadeIn.duration(500)}>
          <Logo size={112} accent={colors.accent} />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(150).duration(500)} style={{ alignItems: 'center' }}>
          <Txt size={40} weight="700" style={{ marginTop: 28, letterSpacing: -1.5 }}>
            Gallero
          </Txt>
          <Txt dim size={16} style={{ marginTop: 10, textAlign: 'center', lineHeight: 23, maxWidth: 300 }}>
            Your photos, beautifully simple.{'\n'}No ads. No clutter. Nothing leaves your phone.
          </Txt>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={{ marginTop: 44, width: '100%' }}>
          <PrimaryButton
            label={permission.canAskAgain ? 'Allow photo access' : 'Open settings'}
            onPress={() => (permission.canAskAgain ? request() : Linking.openSettings())}
          />
        </Animated.View>
      </View>
    );
  }

  return (
    <>
      {statusBar}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          // iOS-style push with parallax on capable phones, a light fade elsewhere.
          animation: perf.tier === 'high' ? 'ios_from_right' : 'fade',
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="search" options={{ animation: 'fade', animationDuration: 180 }} />
        <Stack.Screen
          name="viewer"
          options={{ animation: 'none', presentation: 'transparentModal', contentStyle: { backgroundColor: 'transparent' } }}
        />
      </Stack>
      <ToastHost />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
