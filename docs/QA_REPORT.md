# Gallero — QA Report

| | |
|---|---|
| **Build** | 1.0.0 (release APK, arm64-v8a) |
| **Date** | 19 October 2026 |
| **Test device** | HMD Crest · Android 14 · large real-world library (thousands of photos & videos) |
| **Stack** | Expo SDK 58 · React Native 0.88 (New Architecture) · Hermes |

## 1. Summary

| Area | Result |
|---|---|
| Unit tests | ✅ **30 / 30 passed** (1 suite, ~1.4 s) |
| TypeScript (strict) | ✅ 0 errors |
| `expo-doctor` | ⚠️ 19 / 20 — only a metadata advisory (see §5) |
| Release build | ✅ 23.3 MB APK (arm64); builds, installs, launches with no crash |
| Manual device QA | ✅ core flows verified · ⚠️ some flows not yet exercised (see §3) |

## 2. Automated tests

Run with `npm test` (`jest-expo`). Tests target `src/lib/utils.ts`, the pure logic module the
app itself imports — so the tested code is the shipped code, not a copy.

| Suite | Test | Result |
|---|---|---|
| formatDuration | formats short clips as m:ss | ✅ |
| formatDuration | adds hours for long videos | ✅ |
| formatDuration | never shows negative time | ✅ |
| dates | dayKey uses the local calendar day | ✅ |
| dates | daysAgo counts calendar days, not 24h windows | ✅ |
| dates | dayLabel says Today / Yesterday, otherwise a date | ✅ |
| dates | groupTitle by day adds the year only for other years | ✅ |
| media types | spots screenshots by file name or album | ✅ |
| media types | treats very wide/tall photos as panoramas, but not screenshots or videos | ✅ |
| media types | recognises GIFs, selfies and screen recordings | ✅ |
| media types | has a unique key for every media type | ✅ |
| grouping | groupBy keeps insertion order | ✅ |
| grouping | findDuplicates returns every copy of a shot saved twice | ✅ |
| grouping | buildRows splits groups into rows of N with headers | ✅ |
| grouping | buildRows without grouping has no headers | ✅ |
| grouping | buildRows gives every row a unique key | ✅ |
| grouping | coverOf prefers a still from the middle | ✅ |
| grouping | seeded is deterministic and in [0, 1) | ✅ |
| search | matches by month, year, album and type together | ✅ |
| search | finds people by name and is case-insensitive | ✅ |
| search | an empty query matches nothing | ✅ |
| face matching | cosine similarity is 1 for same direction, 0 for orthogonal | ✅ |
| face matching | assigns a face to the closest person above the threshold | ✅ |
| face matching | starts a new person when nobody is similar enough | ✅ |
| Recently Deleted | counts down 30 days | ✅ |
| Recently Deleted | expires only after the full 30 days | ✅ |
| viewer geometry | fitSize letterboxes landscape photos on a portrait screen | ✅ |
| viewer geometry | fitSize pillarboxes tall images | ✅ |
| viewer geometry | fitSize falls back to the screen when dimensions are unknown | ✅ |
| viewer geometry | panBounds is zero until the image is bigger than the screen | ✅ |

**Not unit-tested (by design):** React components and native modules (media library, ML Kit,
TFLite, biometrics). These were checked on a real device instead (§3).

## 3. Manual device QA

Legend: ✅ verified on device · ⚠️ built but not yet exercised on device

| # | Scenario | Result | Evidence |
|---|---|---|---|
| 1 | Fresh install → permission prompt → library loads | ✅ | Screenshot; counts shown |
| 2 | App launch with no crashes / JS errors | ✅ | `logcat` clean on every build |
| 3 | Glass tab bar, Years · Months · All switcher, search button | ✅ | Screenshot (real blur on Android 14) |
| 4 | Open photo → viewer → slideshow | ✅ | Tester confirmed |
| 5 | Swipe between photos (native pager) | ✅ | Tester confirmed after fix (§4, #4) |
| 6 | Viewer buttons readable on black and white photos | ⚠️ | Fix shipped (#5); awaiting tester sign-off |
| 7 | People scan runs in background without errors | ✅ / ⚠️ | Verified before the size work (~6 photos/s); re-check pending on the 23 MB build, which now uses ML Kit via Play services (needs internet once to fetch the model) |
| 8 | Splash → first grid paint is quicker | ⚠️ | Fix shipped (#6); not timed |
| 9 | Hidden / Recently Deleted lock (fingerprint / PIN / pattern) | ⚠️ | Not exercised |
| 10 | Delete → Recently Deleted → Restore | ⚠️ | Not exercised |
| 11 | Copy image → paste into gallery; copy / move to album | ⚠️ | Not exercised |
| 12 | People grouping accuracy, rename, merge | ⚠️ | Scan verified; grouping quality not reviewed |
| 13 | Search (month, album, person, type) | ⚠️ | Logic unit-tested; UI not exercised |
| 14 | Video playback & scrubber | ⚠️ | Not exercised |
| 15 | Low-RAM / Android < 12 device tier | ⚠️ | No such device available |
| 16 | iOS | ⚠️ | Not built (face module is Android-only) |

## 4. Defects found & fixed during QA

| # | Severity | Issue | Root cause | Fix |
|---|---|---|---|---|
| 1 | Blocker | Release build failed on Windows (`ninja: mkdir … No such file`) | Native C++ object paths exceeded Windows path limits; CMake 3.22's ninja isn't long-path aware | Build with CMake 4.0.2 (ninja 1.12) via `local.properties` |
| 2 | High | People never started (`RNMLKitFaceDetection.initialize` rejected with NPE) | Third-party ML Kit wrapper crashed parsing options | Replaced with a small local Expo module (`modules/gallero-faces`) calling ML Kit directly |
| 3 | High | Face model not found in release (`MalformedURLException: assets_models_mobilefacenet`) | Release builds pack assets as Android resources, not file URLs | Load the model via `expo-asset` (copied to a real file first) |
| 4 | High | Couldn't swipe between photos; zoom felt choppy | Custom JS pager + a blur target wrapping the pager that redrew on its own schedule | Native snapping pager (Gesture Handler `FlatList`); blur removed from the viewer; pans only for zoomed-move and swipe-to-dismiss |
| 5 | Medium | Viewer buttons invisible on dark photos | Dark translucent pills on dark images | Accent-filled pills, white outline + shadow, gradient shades behind bars |
| 6 | Medium | Splash screen lingered | Splash waited on the permission check; first page fetched 400 items | Hide when settings load, 150 ms fade, first page 120 items |
| 7 | Low | Vibration on every tab switch | Haptic on all buttons | Haptics only on meaningful actions (select, favourite, column snap) |
| 8 | Medium | Grid scroll heavier than needed | Each thumbnail ran its own animated style | Thumbnails are plain views; no per-tile fade while flinging |
| 9 | Low | Logo invisible on light splash | Cream glyph on cream background | Splash uses the tiled logo |
| 11 | Medium | Release APK was 63.6 MB | Bundled ML Kit face models (~12 MB), float32 face model (5.1 MB), unshrunk code/resources, every icon font pulled in by a barrel import | Unbundled ML Kit (Play services), 8-bit model (1.5 MB, cosine 0.9995 vs float), R8 + resource shrinking, compressed native libs, Ionicons-only import → **23.3 MB** |
| 12 | Blocker | First shrunk build crashed on launch | Excluded TFLite GPU lib is a hard link-time dependency; R8 stripped ML Kit registrar constructors | Kept the GPU lib; added keep rules for Nitro/TFLite/ML Kit |
| 10 | Privacy | README mock-ups contained the tester's real library counts | Copied from a screenshot | Replaced with sample numbers; art is generated, never screenshots |

## 5. Known issues & limitations

- **Hidden is app-level.** Other gallery apps on the device can still see hidden photos.
- **Recently Deleted keeps a private copy** for 30 days, so storage isn't freed until then; Android also asks to confirm each deletion.
- **People** is conservative (may split one person into two groups; use *Merge*). First scan of a large library takes a while and only runs while the app is open.
- **Face detection is Android-only**; iOS builds would need an iOS implementation of `gallero-faces`.
- **No Map view** (would need a maps SDK).
- `expo-doctor` advisory: `react-native-fast-tflite` is "untested on New Architecture" in the React Native Directory; it ran correctly on the test device.
- Release APK is signed with the debug key — re-sign before distributing.

## 6. How to reproduce

```bash
npm install
npm test            # unit tests
npm run typecheck   # TypeScript
npx expo-doctor     # project health
```
