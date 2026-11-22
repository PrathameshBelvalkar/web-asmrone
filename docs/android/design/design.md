# Echo Android: Mobile Design Build Plan

How we build the Echo Android **phone UI** in Jetpack Compose with **Material 3 Expressive**, screen by screen, from the
Figma file. This replaces the old `docs/ANDROID.md`.

| | |
|---|---|
| **Figma file** | `nH0JYhnDDovO32WChEgMqH`, page **Screens** |
| **Screens** | Section **Mobile (phone · 412×917)** (`21:55360`): 75 frames in 7 groups |
| **Design system** | Section **5 · Design system** (`21:28263`): Colour, Typography, Shape, Spacing, Components, Motion + Icons |
| **Code** | `apps/android/` on branch `feat/android` |
| **Scope** | Phone only (compact width, < 600 dp). Tablet and big-screen frames are out of scope for now. |

---

## Contents

1. [Rules](#1-rules)
2. [Build order](#2-build-order)
3. [Tech stack](#3-tech-stack)
4. [Emulator setup](#4-emulator-setup)
5. [File structure](#5-file-structure)
6. [Phase 1: Design system in code](#6-phase-1-design-system-in-code)
7. [Colour and theme switching](#7-colour-and-theme-switching)
8. [Phase 2: Common components](#8-phase-2-common-components)
9. [Phase 3: Data and storage](#9-phase-3-data-and-storage)
10. [Phase 4: App shell and navigation](#10-phase-4-app-shell-and-navigation)
11. [Screens, in build order](#11-screens-in-build-order)
12. [Testing](#12-testing)
13. [Definition of done](#13-definition-of-done)
14. [Open questions from Figma](#14-open-questions-from-figma)

---

## 1. Rules

1. **Figma is the spec.** If the code and Figma disagree, Figma wins, or Figma is changed first. Nothing is designed in
   code.
2. **Layer names are the component list.** Every layer in a Mobile frame is named `M3E · <Component> (<variant>)` or
   `Echo · <Component>`. `M3E · …` means a stock Compose Material 3 Expressive component. `Echo · …` means one of our own
   composables, listed in [§8.3](#83-echo-components). A name like `→ opens 0.3 History` is a navigation target.
3. **Tokens only.** Colours come from `MaterialTheme.colorScheme.<role>`, type from `MaterialTheme.typography.<style>`,
   shapes from `MaterialTheme.shapes` and `EchoShapes`, and spacing and sizes from `EchoSpacing` and `EchoSizes`. No
   raw hex, `dp` or `sp` values in screen code.
4. **UI first, with fake data.** This plan builds the whole UI against a fake catalogue that uses the placeholder
   content from Figma ("Whispered bedtime story", "Circle Aoi", "ABC-101", grey covers). Things stored on the device
   are real from the start: settings, theme, profile, library, history, playlists and reader preferences. Scrapers and
   real playback plug in later behind the same repository interfaces.
5. **Every component and every screen has previews** in Light, Dark and Pure black, and a screenshot test.
6. **Each composable says which frame it builds:** `/** Figma 1.1 Home (35:2) */`.

---

## 2. Build order

Foundations first, then the screens. Each screen group reuses what the earlier groups built. **1.1 Home is the first
screen**: it holds the most shared pieces (search app bar, source switcher, profile avatar, tabs, carousels, shelf
headers, segmented list, mini player, navigation bar), and 0.1, P.1, S.14, S.15 and O.9 are all overlays on it.
**Onboarding is built last, and O.9 First-run tip is the very last screen.** Onboarding writes the settings and profile
that the rest of the app reads, and O.9 is a tooltip over a finished Home.

| Phase | What | Figma | Done when |
|---|---|---|---|
| **0** | Setup: modules, dependencies, emulator, screenshot tests | — | `./gradlew lint test assembleDebug` passes. The empty app runs on `Pixel_8`. |
| **1** | Design system in code: colour, type, shape, spacing, sizes, elevation, state layers, motion, icons | 5 · Design system | A debug **Design system** screen matches every DS frame side by side |
| **2** | Common components (M3E wrappers and Echo composables) | Layer names across all screens | Every component has previews and screenshot tests in the three themes |
| **3** | Data and storage: DataStore, Room, fake catalogue, theme switching wired | — | Theme mode, dynamic colour and pure black change live and survive a restart |
| **4** | App shell: scaffold, floating navigation bar, player sheet, routes for all 75 screens | — | Every route opens (placeholders allowed). Back works everywhere. |
| **5** | **ASMR**: 1.1 Home first, then 0.1, 1.2–1.12 | Mobile · ASMR, 0.1 | All 13 screens match Figma |
| **6** | **Shared**: 0.2 Library, 0.3 History, 0.4 Not found & empty | Mobile · Shared | 3 screens match |
| **7** | **Manga**: 2.1–2.11 | Mobile · Manga | 11 screens match |
| **8** | **JAV**: 3.1–3.12 | Mobile · JAV | 12 screens match |
| **9** | **Hentai**: H.1–H.11 | Mobile · Hentai | 11 screens match |
| **10** | **Settings and profile**: P.1, S.1–S.15 | Mobile · Settings & Profile | 16 screens match. S.8 drives the theme. |
| **11** | **Onboarding**: O.1–O.8, then **O.9 last** | Mobile · Onboarding | A fresh install runs O.1 → O.9 → Home, and its choices are saved |
| **12** | Polish: Figma prototype flows, motion, accessibility, final side-by-side pass | Flows on the Screens page | [§13](#13-definition-of-done) passes for all 75 screens |

Commits: one or more per phase on `feat/android`. Open a PR after Phase 4 (foundations) and after Phases 7, 10 and 12.

---

## 3. Tech stack

Already pinned in `apps/android/gradle/libs.versions.toml`: Kotlin 2.4.21, AGP 9.5.1, Compose BOM 2026.11.01
(Material 3 1.5.0: the first stable release where the Expressive type, shape and motion APIs are public; it needs
`compileSdkMinor = 1`, i.e. the android-37.1 platform),
Navigation 2.10.2, Room 2.8.5, DataStore 1.3.0, Coil 3.6.3, Paging 3.5.3, Lifecycle 2.11.0, min SDK 26, target SDK 37.

| Need | Library | Status |
|---|---|---|
| M3 Expressive components, `MaterialExpressiveTheme`, `MotionScheme.expressive()` | `androidx.compose.material3:material3` (from the BOM) | In use. Opt in with `@OptIn(ExperimentalMaterial3ExpressiveApi::class)`, kept inside `:designsystem`. |
| Navigation with type-safe routes | `navigation-compose` + `kotlinx-serialization` plugin on `:app` | Pinned. Plugin to apply. |
| Settings, profile, onboarding flags | `datastore-preferences` | Pinned |
| Library, history, playlists, queue, reader prefs | Room + KSP | Pinned |
| Images (later real covers) | Coil 3 | Pinned |
| Seed colour → full scheme, including pure black | `com.materialkolor:material-kolor` | **Add** (latest stable) |
| Player colours from the cover | `androidx.palette:palette-ktx` | **Add** |
| Splash (O.1) | `androidx.core:core-splashscreen` | **Add** |
| Reorderable lists (1.7, 1.9) | `sh.calvin.reorderable:reorderable` | **Add** |
| Icons (Material Symbols Rounded) | Vector drawables imported with Android Studio's Vector Asset tool into `:designsystem` | No library. Don't add `material-icons-extended`: it's large and has Material Icons, not Symbols. |
| Screenshot tests on the JVM | Roborazzi + Robolectric | **Add** |
| ViewModel and flow tests | JUnit 6, Turbine, coroutines-test | Pinned |

Some M3 Expressive APIs have moved between releases (for example the search app bar). When an API named in this doc
isn't in the pinned BOM, `:designsystem` builds the `M3E` wrapper from simpler parts with the sizes in
[§6](#6-phase-1-design-system-in-code), and screens keep calling the wrapper. Screens never need to change when the
wrapper's implementation does.

---

## 4. Emulator setup

### 4.1 Create the devices (once)

1. Install **Android Studio** (latest stable) with the SDK, platform tools and emulator.
2. **Device Manager → Create virtual device → Pixel 8**, named `Pixel_8`. The Pixel 8 is **412 × 915 dp**, almost
   exactly the Figma frame size (412 × 917), so screenshots line up with Figma at 1:1 dp.
3. System image: newest stable API, **Google APIs**, **arm64-v8a** on Apple chips (x86_64 on Intel).
4. RAM 4 GB, storage 8 GB, **Graphics: Hardware**.
5. Optional: a second AVD `Pixel_8_API_31` (Android 12, the first version with dynamic colour), and one on **API 30**
   to check the seed-colour fallback, where dynamic colour isn't available.

### 4.2 Daily loop

```bash
cd apps/android
./gradlew :app:installDebug          # or Run in Android Studio
./gradlew test                       # JVM unit + Roborazzi screenshot verify
./gradlew :app:recordRoborazziDebug  # re-record screenshots after an intended change
```

### 4.3 Make the emulator look like Figma

```bash
A=~/Library/Android/sdk/platform-tools/adb
# Status bar clock at 9:30, like every Figma frame
$A shell settings put global sysui_demo_allowed 1
$A shell am broadcast -a com.android.systemui.demo -e command enter
$A shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0930
# Light / dark
$A shell cmd uimode night no      # or: yes
# Font scale check (accessibility)
$A shell settings put system font_scale 1.3   # back to 1.0 afterwards
# Animations off (checks the "Animations" setting path and the system setting)
for k in animator_duration_scale transition_animation_scale window_animation_scale; do
  $A shell settings put global $k 0; done
# Screenshot to compare with the Figma frame
$A exec-out screencap -p > screen.png
```

Dynamic colour depends on the wallpaper. Use the same wallpaper every time you compare, and switch dynamic colour
**off** (S.8) when comparing against Figma, because Figma uses the baseline scheme (seed `#6750A4`).

### 4.4 Comparing with Figma

1. In Figma, select the frame and export it as PNG at **2.625×** (the Pixel 8 density, 420 dpi). It will be the same
   pixel size as the emulator screenshot.
2. Put the two images side by side, or overlay them at 50% opacity.
3. Check layout, spacing, sizes, colours, type, icons, corner shapes, and then motion and back behaviour on the
   device. Fix every difference, or write it down in the PR as deliberate, with the reason.

---

## 5. File structure

### 5.1 Modules

```
apps/android/
├── app/                 :app            Activity, navigation, shell, every screen (feature packages)
├── designsystem/        :designsystem   NEW · theme, tokens, icons, M3E wrappers, Echo components. No data, no navigation.
├── data/                :data           NEW · models, repository interfaces, fake catalogue, Room, DataStore
├── core/ services/ sources/              Existing backend modules. Untouched in this plan.
└── build-logic/         + EchoAndroidLibraryPlugin (com.android.library + Compose + Kotlin 17)
```

Dependency direction: `:app → :designsystem` and `:app → :data`. `:designsystem` and `:data` don't depend on each
other. Components take plain parameters (strings, numbers, lambdas, `ImageModel`), never repository types, so every
component can be previewed and screenshot-tested alone.

Add `com.android.library` to `[plugins]` in the version catalog and an `EchoAndroidLibraryPlugin` convention plugin,
so both new modules share one setup.

### 5.2 `:designsystem`

```
designsystem/src/main/kotlin/app/echo/designsystem/
├── theme/
│   ├── EchoTheme.kt            MaterialExpressiveTheme + colour resolution + motion + LocalEcho* providers
│   ├── ThemeConfig.kt          data class ThemeConfig(mode, dynamicColor, pureBlack, seed, contrast, animations)
│   ├── ColorSchemes.kt         Baseline light/dark from DS · Colour (exact Figma values), pureBlack(), fromSeed()
│   ├── PlayerTheme.kt          Cover → Palette → seed → scheme, for the player sheet only
│   ├── Typography.kt           M3 type scale + emphasized styles, Noto Sans JP fallback note
│   ├── Shapes.kt               M3 shapes + EchoShapes (largeIncreased 20, extraLargeIncreased 32, extraExtraLarge 48)
│   └── Motion.kt               Expressive motion scheme + a "reduced" scheme for Animations off
├── tokens/
│   ├── EchoSpacing.kt          2 4 8 12 16 20 24 32 48 64
│   ├── EchoSizes.kt            Button XS–XL, chips, list items, nav bar, avatar, slider, sheet handle
│   ├── EchoElevation.kt        Levels 0–5
│   └── EchoStateLayers.kt      Hover 8 · focus 10 · pressed 10 · dragged 16 · disabled 12/38
├── icon/
│   └── EchoIcons.kt            Material Symbols Rounded, outlined + filled pairs
├── component/
│   ├── m3e/                    Thin wrappers that fix the Echo variants: EchoSearchAppBar, EchoNavigationBar,
│   │                           SegmentedList, ConnectedButtonGroup, EchoButton(size), EchoIconButton(size, shape) …
│   └── echo/                   ShelfHeader, MediaHeader, MiniPlayer, PlayerSheet, SourceSwitcherButton, ProfileAvatar,
│                               EmptyState, CoverImage, CoverCard, TrackRow, MovieCard, GalleryCard, HanimeCard …
└── preview/
    ├── EchoPreviews.kt         @EchoPreviews = Light + Dark + Pure black (+ font 1.3 for screens)
    └── PreviewData.kt          Strings and sample values copied from Figma
```

### 5.3 `:data`

```
data/src/main/kotlin/app/echo/data/
├── model/                Section, Source, Work, Track, Artist, Playlist, Gallery, Tag, Movie, Idol, NewsPost,
│                         HentaiTitle, Episode, HistoryEntry, ReaderPrefs, Profile, Settings …
├── repository/           AsmrRepository, MangaRepository, JavRepository, HentaiRepository,
│                         LibraryRepository, PlaylistRepository, SettingsRepository, ProfileRepository,
│                         PlayerController, UpdateRepository
├── fake/                 FakeCatalog (Figma placeholder content), Fake*Repository, FakePlayerController,
│                         FakeConfig (latency, force error/empty, for checking states)
├── db/                   EchoDatabase, entities, DAOs, FakeSeeder (debug: fills Room with the Figma rows)
└── prefs/                EchoDataStore, SettingsKeys, typed SettingsRepositoryImpl / ProfileRepositoryImpl
```

### 5.4 `:app`

```
app/src/main/java/app/echo/android/
├── EchoApp.kt, MainActivity.kt, AppContainer.kt     Hand-made DI: builds repositories, exposes them to ViewModels
├── navigation/
│   ├── Routes.kt                @Serializable route objects for every screen, sheet and dialog
│   ├── EchoNavHost.kt           One NavHost. Sheets and dialogs as dialog destinations or screen-local state.
│   └── SectionNav.kt            Maps the active section to its Home / Search / Library routes
├── shell/
│   ├── EchoAppScaffold.kt       NavHost + floating navigation bar + player sheet + snackbar host
│   ├── ShellViewModel.kt        Active section, source, mini player state
│   └── SourceSwitcherSheet.kt   0.1
├── feature/
│   ├── asmr/        home/ search/ results/ feed/ work/ artist/ playlist/ player/ (fullplayer, upnext, lyrics, more) playlists/
│   ├── shared/      library/ history/ states/
│   ├── manga/       browse/ search/ tags/ taglist/ gallery/ reader/ (menus, immersive, settings, pages, end) artists/
│   ├── jav/         news/ newspost/ latest/ movies/ movielist/ movie/ theater/ idols/ idol/ genres/ search/ library/
│   ├── hentai/      home/ browse/ titles/ filters/ seasons/ search/ title/ preview/ library/ states/ theater/
│   ├── settings/    profile/ (P.1, S.12) settings/ preferences/ aisubtitles/ jav/ storage/ lookandfeel/
│   │                playback/ reader/ about/ updates/ (S.13–S.15)
│   └── onboarding/  splash/ welcome/ (O.2–O.4 pager) sources/ profile/ age/ theme/ firstrun/
└── debug/
    └── DesignSystemScreen.kt    Phase 1 catalogue: every token and component, mirrors the DS frames
```

### 5.5 One screen = four files

```
feature/asmr/home/
├── AsmrHomeRoute.kt      Gets the ViewModel, collects state, passes lambdas. The only file that knows navigation.
├── AsmrHomeScreen.kt     Stateless: AsmrHomeScreen(state, onEvent). Previews at the bottom.
├── AsmrHomeUiState.kt    data class + sealed Loading / Content / Empty / Error
└── AsmrHomeViewModel.kt  Reads repositories, exposes StateFlow<AsmrHomeUiState>
```

Naming: `<Section><Screen>`, for example `MangaGalleryScreen` and `JavMoviePageScreen`. Test tags use the Figma ID,
for example `Modifier.testTag("screen:1.1")`. All UI text goes in `strings.xml`. Placeholder content (titles, names)
lives in `FakeCatalog`, not in strings.

---

## 6. Phase 1: Design system in code

All values come from the **5 · Design system** frames.

### 6.1 Typography (DS · Typography)

Roboto (the system default) for every style. No custom font. Japanese text (lyrics originals, alternate names) uses
the system's Noto Sans JP fallback, one step smaller than the line above it.

| Style (size/line · tracking) | Echo uses it for |
|---|---|
| displaySmall 36/44 | End of gallery "You finished it" (2.10) |
| headlineLarge 32/40 | Large flexible app bar title (1.6, 3.9, S.1) |
| headlineMedium 28/36 | Medium flexible app bar title |
| headlineSmall 24/32 | Full player track title (emphasized) |
| titleLarge 22/28 | Small app bar title, shelf headers |
| titleMedium 16/24 · 0.15 | List item headline, mini player title |
| titleSmall 14/20 · 0.1 | Card titles |
| bodyLarge 16/24 · 0.5 | Lyrics (other lines), descriptions |
| bodyMedium 14/20 · 0.25 | Supporting text |
| bodySmall 12/16 · 0.4 | Meta lines (artist · duration) |
| labelLarge 14/20 · 0.1 | Buttons, tabs, chips |
| labelMedium 12/16 · 0.5 | Nav bar labels, badges |
| labelSmall 11/16 · 0.5 | Overlines ("PLAYING FROM") |

**Emphasized** styles (`typography.titleLargeEmphasized` and so on) have the same sizes in **Bold** (Figma's
"Emphasized · Title Large" specimen is Roboto Bold). The Compose defaults don't match Figma (tracking differs and the
emphasized styles keep the baseline weight), so `Typography.kt` writes every style out. Use them
for selected list items, the current lyric line, primary buttons, the Extended FAB, new or unread items, and the full
player title.

### 6.2 Shape (DS · Shape)

| Token | Value | Used for |
|---|---|---|
| none | 0 | — |
| extraSmall | 4 dp | Text field top corners, segmented list inner corners |
| small | 8 dp | Chips, small thumbnails, menu items |
| medium | 12 dp | Square icon buttons at rest, connected group inner corners |
| large | 16 dp | Cover art in grids and shelves, FAB, pressed square buttons |
| **largeIncreased** | 20 dp | Segmented list outer corners |
| extraLarge | 28 dp | Cards, mini player, floating toolbar, search bar, sheet tops, dialogs |
| **extraLargeIncreased** | 32 dp | Hero carousel items, full player cover |
| **extraExtraLarge** | 48 dp | End-of-gallery cover, onboarding art |
| full | pill | Buttons, icon buttons, selected chips, nav active indicator, badges |

**Shape morph:** play/pause, like and other toggles morph round ↔ square (12 → 16 dp) on press or selection. Use
`IconButtonDefaults.shapes()` / `ButtonDefaults.shapes()`, which animate with the expressive fast spatial spring.

### 6.3 Spacing and layout (DS · Spacing)

`EchoSpacing`: **2** (segmented list gap, connected buttons) · **4** (icon ↔ label) · **8** (chip gap, button group gap,
text stack) · **12** (cover row gap, list icon ↔ text) · **16** (screen margin, list and card padding) · **20** (large
card padding, sheet side padding) · **24** (section and dialog padding) · **32** (gap between shelves on big screens) ·
**48** (min touch target) · **64** (small app bar height).

Phone layout: 16 dp side margins. App bar heights: 64 (small), 112 (medium flexible), 152 (large flexible). Navigation
bar 64 dp plus the gesture area. The mini player sits 8 dp above the navigation bar. Everything is edge to edge
(`enableEdgeToEdge()`), with `WindowInsets` padding, never hard-coded status bar heights.

### 6.4 Component sizes (DS · Components)

| Item | Size |
|---|---|
| Buttons, icon buttons, toggle, split, button groups | **XS 32 · S 40 · M 56 · L 96 · XL 136** dp. S is the default (lists, toolbars). M for media-page Play/Shuffle. L for full player play/pause. |
| Chips | 32 dp, 8 dp radius |
| Text field | 56 dp, outlined, 4 dp top radius |
| Search bar | 56 dp, full radius |
| List item | 56 / 72 / 88 dp (one / two / three lines), 16 dp side padding |
| Navigation bar (flexible) | 64 dp, active indicator 56 × 32 |
| FAB / Extended FAB | 56 dp, 16 dp radius |
| Icons | 24 dp, 20 dp inside chips and S buttons |
| Avatar | 40 dp in app bars, 96 dp on artist pages. Echo profile avatar: 36 dp + 2 dp ring in a 48 dp target. |
| Slider | 44 dp handle, 16 dp track (XS) |
| Bottom sheet | Drag handle 32 × 4, 28 dp top radius, scrim 32% |

The minimum touch target is 48 × 48 dp even when the visible element is smaller.

### 6.5 Elevation and state layers

Prefer tonal surfaces (`surfaceContainer*`) to shadows. Shadows only for floating things.

| Level | dp | Used for |
|---|---|---|
| 0 | 0 | Screens |
| 1 | 1 | Cards |
| 2 | 3 | Nav bar, menus |
| 3 | 6 | FAB, mini player |
| 4 | 8 | Hover |
| 5 | 12 | Dragged |

State layers (the content colour on top of the container): hover 8%, focus 10%, pressed 10%, dragged 16%, disabled 12%
container and 38% content. Stock M3 components already do this. Echo components use `ripple()` and the same values.

### 6.6 Motion (DS · Motion)

`MaterialExpressiveTheme(motionScheme = MotionScheme.expressive())`. Springs, not durations.

| Token | Echo uses it for |
|---|---|
| fastSpatialSpec | Buttons, chips, toggles, shape morph |
| defaultSpatialSpec | Mini player ↔ full player sheet, screen navigation |
| slowSpatialSpec | Shared-element cover transitions, hero carousel |
| fast/default/slow EffectsSpec | Colour and opacity: theme switch, dynamic player colour (never overshoots) |

Read specs from `MaterialTheme.motionScheme`, never write `tween(300)` in a screen. **Animations off** (S.8 setting, or
system animator scale 0) swaps in a reduced motion scheme that returns `snap()` for spatial specs and short fades for
effects specs.

### 6.7 Icons

Material Symbols **Rounded**, 24 dp, weight 400, grade 0, optical size 24. Outlined when inactive, **filled when
selected** (nav bar, like, bookmarks). 20 dp in chips and S buttons. `EchoIcons.Home` / `EchoIcons.HomeFilled` and so
on, imported as vector drawables.

### 6.8 The Design system debug screen

`debug/DesignSystemScreen.kt` in the `debug` source set, reachable only in debug builds: its own launcher icon
"Echo · Design system" (`DesignSystemActivity`), and later a long-press on the version in S.11. Screenshot tests
render each section in Light, Dark and Pure black (`app/src/test/screenshots/ds/`). One section per
DS frame: colour roles in all modes, the type scale, the shape scale, the spacing scale, component sizes, elevation,
state layers, motion demos and icons. **Phase 1 is done when this screen matches the DS frames side by side.**

---

## 7. Colour and theme switching

### 7.1 Colour roles (DS · Colour)

The baseline scheme (seed `#6750A4`), used when dynamic colour is off. It goes into `ColorSchemes.kt` exactly as listed.

| Role | Light | Dark | Echo uses it for |
|---|---|---|---|
| primary | `#6750A4` | `#D0BCFF` | Filled buttons, active nav pill, FAB, slider, progress |
| onPrimary | `#FFFFFF` | `#381E72` | Text and icons on primary |
| primaryContainer | `#EADDFF` | `#4F378B` | Selected list item, toggles on, mini player art fallback |
| onPrimaryContainer | `#21005D` | `#EADDFF` | Text on primary container |
| secondaryContainer | `#E8DEF8` | `#4A4458` | Tonal buttons, nav active indicator, selected chips |
| onSecondaryContainer | `#1D192B` | `#E8DEF8` | Text on tonal buttons |
| tertiaryContainer | `#FFD8E4` | `#633B48` | NEW / BETA badges, highlights |
| error | `#B3261E` | `#F2B8B5` | Errors, destructive actions (Clear all data) |
| surface | `#FEF7FF` | `#141218` | Screen background |
| onSurface | `#1D1B20` | `#E6E0E9` | Primary text and icons |
| onSurfaceVariant | `#49454F` | `#CAC4D0` | Secondary text, inactive icons |
| surfaceContainerLow | `#F7F2FA` | `#1D1B20` | Segmented list tiles, cards |
| surfaceContainer | `#F3EDF7` | `#211F26` | Navigation bar, mini player |
| surfaceContainerHigh | `#ECE6F0` | `#2B2930` | Bottom sheets, menus, dialogs |
| surfaceContainerHighest | `#E6E0E9` | `#36343B` | Search bar, text fields, filled chips |
| outline | `#79747E` | `#938F99` | Text field borders, outlined buttons |
| outlineVariant | `#CAC4D0` | `#49454F` | Dividers, chip borders |
| inverseSurface | `#322F35` | `#E6E0E9` | Snackbars |
| scrim | `#000000` | `#000000` | Behind sheets and dialogs (32%) |

Every "X" has an "onX" for content on top of it. Use the pair, never mix.

### 7.2 Theme modes

| Mode | How it's built |
|---|---|
| **Light / Dark / System** | `ThemeMode.SYSTEM` follows `isSystemInDarkTheme()` |
| **Dynamic colour** (default **on**, Android 12+) | `dynamicLightColorScheme(context)` / `dynamicDarkColorScheme(context)`. The seed is ignored. |
| **Seed fallback** (dynamic off, or Android < 12) | Seed `#6750A4` → the exact baseline table above. Any other seed → `MaterialKolor` `dynamicColorScheme(seed, isDark, contrastLevel)`. |
| **Pure black** (AMOLED) | Dark scheme with `background` and `surface` set to `#000000`. Containers stay slightly lifted so cards still separate. Only applies in dark. |
| **Dynamic player colour** (default on) | Player sheet only. Cover → Palette → seed → scheme, inside its own `MaterialTheme` in `PlayerSheet`. Fake covers get a fixed sample seed (Figma's example is `#904A43`). |
| **Contrast** | Follow the system: `UiModeManager.contrast` on Android 14+, passed as `contrastLevel` to seed schemes. Dynamic schemes already follow it. |

### 7.3 How a switch flows through the app

```
S.8 Look and feel / O.8 Make it yours
        │  settingsRepository.updateTheme { copy(mode = DARK) }
        ▼
DataStore (settings)  ──Flow<ThemeConfig>──▶  MainActivity
                                               │ collectAsStateWithLifecycle()
                                               ▼
                                    EchoTheme(config) {
                                      dark   = mode.resolve(isSystemInDarkTheme())
                                      scheme = resolveColorScheme(config, dark, context)   // pure, unit-tested
                                      MaterialExpressiveTheme(scheme.animated(), motion, shapes, typography)
                                    }
```

- **`resolveColorScheme()` is a pure function** in `ColorSchemes.kt`: dynamic → seed → pure black, in that order. It
  gets its own unit tests ([§12](#12-testing)).
- **Animated:** every colour role moves with `animateColorAsState(target, motionScheme.defaultEffectsSpec())`, so a
  theme switch fades rather than flashes. With Animations off it snaps.
- **No flash on launch:** the splash screen stays up (`setKeepOnScreenCondition`) until the first `ThemeConfig` has been
  read from DataStore.
- **System bars:** call `enableEdgeToEdge()` again with `SystemBarStyle.auto` whenever `dark` changes, so status bar
  icons stay readable.
- **Where it's changed:** S.8 (theme connected button group System / Light / Dark, Dynamic colour, Pure black, Dynamic
  player colour, Blurred cover background, Bigger covers, Animations) and O.8 (theme previews, Dynamic colour, Dynamic
  player colour). Both call the same repository method, so they can't disagree.
- **Pure black is disabled** (switch greyed out) when the mode resolves to Light.

---

## 8. Phase 2: Common components

### 8.1 Rules for every component

- Stateless. State comes in, events go out as lambdas. `modifier: Modifier = Modifier` is the first optional parameter.
- Variant parameters match the Figma variant names: `EchoButton(size = ButtonSize.M, style = ButtonStyle.Tonal)`.
- Every component has `@EchoPreviews` and a Roborazzi test, and a `contentDescription` on every icon-only control.
- A 48 dp touch target, even when the visible element is smaller.

### 8.1a How Phase 2 is built and tested

- **Batches.** 2a (done first) is everything 1.1 Home and the shell need: icon button, button, segmented list,
  floating navigation bar, search / flexible / small app bars, tabs, carousels, connected and standard button
  groups, chips, badge, sheet, switch, and the Echo `ProfileAvatar`, `SourceSwitcherButton`, `ShelfHeader`,
  `CoverImage`, `CoverCard` / `ContinueCard`, `MiniPlayer`, `TrackRow`, `EmptyState`. 2b is the rest: search
  fields, floating toolbar, sliders (`EchoSlider`, `EchoRangeSlider`, wavy `SeekSlider`, `ValueIndicatorSlider`),
  `CoverGrid`, `SelectableCard`, `EchoSplitButton`, `PageIndicator`, `RadioOptionList`, and the Echo
  `GalleryCard` / `HanimeCard` / `MovieCard` / `IdolCard`, `MediaHeader`, `PlayerControls`, `FullPlayer`,
  `PlayerSheet`, `SyncedLyrics`, reader chrome, `EndOfGallery`, `ArticleHero` / `TitleHero`, `StatusLine`,
  `StudioLink`, `ProfileHeader`, `AvatarPicker`, `ThemePreviews`, `OnboardingIllustration`, `EchoSplash`.
- **Stock M3 pieces** used without a wrapper (Extended FAB, loading indicator, snackbar, text field, checkbox,
  dialog, menu, tooltip) are themed as they are; `StockComponentsPreview` screenshot-tests them in the Echo theme.
- **The reader is always dark**: reader chrome wraps itself in `ReaderTheme` (the app theme forced to dark).
- **PlayerSheet** is built on `Animatable` + `draggable` with three rest points (Expanded / Collapsed / Hidden),
  not the foundation anchored-drag API, which keeps changing between releases.
- Sliders with more than 10 stops hide the tick dots (page and age sliders), as in Figma.
- **Previews are the tests.** Every `@Preview` in `:designsystem` becomes a Roborazzi test (Roborazzi's preview
  scanner, ComposablePreviewScanner pinned to 0.9.3 because 0.10 breaks Roborazzi 1.79). Component previews use
  `@EchoPreviews` + `EchoThemesPreview { }`, which draws Light, Dark and Pure black in one image.
- **Uncontained carousel = `CoverRow`.** The M3 uncontained carousel masks each item and clips the card text, so
  "Carousel (Uncontained)" rows are a `LazyRow` (`CoverRow`). `CoverCarousel` covers Multi-browse and Hero.
- **Navigation bar** is drawn from primitives (floating pill, wide active item with icon and label side by side),
  because `ShortNavigationBar`'s indicator can't take Figma's 56 dp pill. `EchoButtonGroup` is a spaced `Row`.
- The debug Design system screen has a **Components (Phase 2)** section that shows them live on the emulator.

### 8.2 M3 Expressive components, in build order

Build order is by how many screens use them (the count). Build the top half before Phase 4.

| # | Figma layer | Compose API | Echo wrapper | Screens |
|---|---|---|---|---|
| 1 | Icon button (Standard / Filled / Tonal / Outlined, square / wide, toggle) | `IconButton`, `FilledIconButton`, `FilledTonalIconButton`, `OutlinedIconButton`, `*IconToggleButton`, `shapes = IconButtonDefaults.shapes()`, size from `IconButtonDefaults.*ContainerSize(widthOption)` | `EchoIconButton(icon, size, style, shape, checked?)` | 56 |
| 2 | Navigation bar (Flexible), floating, expanded active item | `ShortNavigationBar` + `ShortNavigationBarItem` (active item: icon and label side by side) inside a floating `Surface` (extraLarge shape, 16 dp side inset, level 2) | `EchoNavigationBar(destinations, selected, onSelect)` | 39 |
| 3 | List (Expressive, segmented / single-select / reorderable), list item | Expressive `ListItem` in a `Column(spacedBy(2.dp))`, tiles on `surfaceContainerLow`, outer corners 20 dp, inner corners 4 dp (`ListItemDefaults.segmentedShapes` where available) | `SegmentedList { item(…) }`, `SegmentedListItem(headline, supporting, leading, trailing, selected, onClick)` | 36 |
| 4 | Button group (Standard) | `ButtonGroup` with overflow | `EchoButtonGroup` | 27 |
| 5 | App bar (Medium flexible / Large flexible) | `MediumFlexibleTopAppBar` / `LargeFlexibleTopAppBar` + `exitUntilCollapsedScrollBehavior()` | `EchoFlexibleAppBar(title, subtitle, size, navigation, actions)` | 21 + 3 |
| 6 | App bar (Search app bar) | `AppBarWithSearch` (search bar 56 dp full radius) + `rememberSearchBarState()` | `EchoSearchAppBar(source, placeholder, onSearch, onSwitcher, onProfile)` | 20 |
| 7 | Tabs (Primary, scrollable) | `PrimaryScrollableTabRow` + `Tab` | `SectionTabs(tabs, selected)` | 20 |
| 8 | Carousel (Uncontained / Multi-browse / Hero) | `HorizontalUncontainedCarousel`, `HorizontalMultiBrowseCarousel`, `HorizontalCenteredHeroCarousel` + `Modifier.maskClip(shape)` | `CoverCarousel(style, items)` | 20 / 8 / 4 |
| 9 | Button group (Connected, single-select) | `Row(spacedBy(ButtonGroupDefaults.ConnectedSpaceBetween))` of `ToggleButton` with `ButtonGroupDefaults.connectedLeading/Middle/TrailingButtonShapes()` | `ConnectedButtonGroup(options, selected, onSelect)` | 17 |
| 10 | Progress indicator (Linear, wavy / Linear) | `LinearWavyProgressIndicator`, `LinearProgressIndicator` | — | 16 / 7 |
| 11 | Chips (Filter single / multi, Assist, Input, Suggestion) | `FilterChip`, `AssistChip`, `InputChip`, `SuggestionChip` in `FlowRow` or `LazyRow`, 8 dp gap | `ChipRow(chips, selection)` | 16 / 9 / 3 / 1 |
| 12 | Button (Filled / Tonal / Outlined / Text, XS–M) | `Button`, `FilledTonalButton`, `OutlinedButton`, `TextButton` + `ButtonDefaults.*ContainerHeight`, `contentPaddingFor(height)`, `shapes()` | `EchoButton(text, icon?, size, style)` | 15+ |
| 13 | Badge (Large) | `Badge { Text(…) }` on tertiaryContainer for NEW/BETA; overlays on covers for pages / language | `CoverBadge` | 12 |
| 14 | App bar (Small / centered / transparent over hero / overlay) | `TopAppBar`, `CenterAlignedTopAppBar` with `TopAppBarDefaults.topAppBarColors(containerColor = Transparent)` | `EchoSmallAppBar(style)` | 11 + 2 + 2 |
| 15 | Bottom sheet (Modal) | `ModalBottomSheet` (32 × 4 handle, 28 dp top, scrim 32%) | `EchoSheet(title, content)` | 9 |
| 16 | Switch (with icon) | `Switch(thumbContent = { Icon(check / close) })` | `SettingSwitchRow` | 13 |
| 17 | Search (Search view full-screen / Search bar small) | `ExpandedFullScreenSearchBar` + `SearchBarDefaults.InputField` / `SearchBar` (small, in-page) | `EchoSearchView`, `InlineSearchBar` | 4 / 2 |
| 18 | Toolbar (Floating, horizontal / vibrant) | `HorizontalFloatingToolbar` (+ `FloatingToolbarDefaults.vibrantFloatingToolbarColors()`) | `EchoFloatingToolbar` | 4 + 2 + 1 |
| 19 | Slider (Standard XS / with stops / range / value indicator / wavy) | `Slider`, `RangeSlider` (`steps` for stops). Wavy seek: custom track drawn like `LinearWavyProgressIndicator`. Value label: custom thumb label. | `SeekSlider(wavy)`, `EchoSlider(size)`, `AgeSlider` | 3+3+2+1+1 |
| 20 | Grid of Cards (3 columns) / Grid of page thumbnails | `LazyVerticalGrid(GridCells.Fixed(3))` (JAV movies: `Fixed(2)`) with 12 dp gaps | `CoverGrid` | 6 + 2 |
| 21 | Cards (Filled / Elevated / Outlined / Outlined selectable) | `Card`, `ElevatedCard`, `OutlinedCard(onClick)`. Selected = primary border + check | `SelectableCard` | 2–3 each |
| 22 | Extended FAB (Medium) | `MediumExtendedFloatingActionButton` | — | 2 |
| 23 | Split button (Filled, M) | `SplitButtonLayout` + `SplitButtonDefaults.LeadingButton` / `TrailingButton` | `EchoSplitButton(primary, menu)` | 2 |
| 24 | Loading indicator (Contained) | `LoadingIndicator` / `ContainedLoadingIndicator` | — | 2 + all loading states |
| 25 | Dialog (Basic / Full-screen) | `AlertDialog` / `Dialog(DialogProperties(usePlatformDefaultWidth = false))` | — | 2 / 1 |
| 26 | Menu | `DropdownMenu` + `DropdownMenuItem` | — | 2 |
| 27 | Checkbox, Radio button group, Text field (Outlined) | `Checkbox`, `RadioButton` + `Modifier.selectableGroup()`, `OutlinedTextField` | — | 1 each |
| 28 | Snackbar | `SnackbarHost` in the shell, `inverseSurface` | — | 1 |
| 29 | Tooltip (Rich) | `TooltipBox` + `RichTooltip` + `rememberTooltipState(isPersistent = true)` | — | 1 (O.9) |
| 30 | Page indicator | No M3 component: dots under a `HorizontalPager` (active dot primary, 8 dp, pill) | `PageIndicator` | 3 |

### 8.3 Echo components

| Component | Figma screens | What it is | Built from |
|---|---|---|---|
| `ProfileAvatar` | 23 screens | 36 dp avatar + 2 dp ring in a 48 dp target, initial "P" placeholder. Opens P.1. | `Box` + `CircleShape` + `border` |
| `SourceSwitcherButton` | 20 | The source pill inside the search app bar ("asmr.one", "3hentai", "javdatabase", "Hentai"). Opens 0.1. | Small tonal pill + `EchoIcons.ExpandMore` |
| `ShelfHeader` | 19 | Shelf title (titleLarge) + optional subtitle + trailing arrow icon button. The whole row is clickable when it has a target. | `Row` |
| `MiniPlayer` | 15 | Collapsed player: cover, title, artist, play/pause (Filled, square) and a wavy progress line. extraLarge shape, surfaceContainer, level 3, 8 dp above the nav bar. | `Surface` + `LinearWavyProgressIndicator` |
| `PlayerSheet` | 1.8–1.11 | Draggable sheet: Collapsed = `MiniPlayer`, Expanded = full player. Up Next and Lyrics are pages inside it. Swipe down collapses, swipe the mini player down stops. | `AnchoredDraggableState` with anchors Hidden / Collapsed / Expanded, `defaultSpatialSpec` |
| `CoverImage` | everywhere | Cover with a shape and an aspect ratio. With no image it shows Figma's grey box (surfaceContainerHighest + image icon). | Coil `AsyncImage` with a placeholder |
| `CoverCard` / `ContinueCard` / `GalleryCard` / `MovieCard` / `IdolCard` / `HanimeCard` | shelves and grids | Cover + title + meta (+ progress / badges). HanimeCard is a 2:3 cover with a view count. | `CoverImage` + text |
| `TrackRow` | ASMR lists | `SegmentedListItem` with number, title, "artist · duration", playing state (emphasized + equalizer icon), more button | — |
| `MediaHeader` (+ gallery variant) | 1.5, 2.5 | Cover, title, artist, meta, assist chips, button group (Play / Shuffle / like) or split button (Continue p. 34) | — |
| `PlayerControls` (compact) | 1.10 | Wavy seek slider + previous / play-pause / next button group | — |
| `SyncedLyrics` | 1.10 | Auto-scrolling lines. Current line titleLarge emphasized, others bodyLarge onSurfaceVariant, Japanese line under each. Tap a line to seek. | `LazyColumn` + `animateScrollToItem` |
| `EmptyState` | 0.4, H.10, every list | Icon, title, body, optional button. Variants: Not found, Offline, Empty, Blocked (451), Busy, No video. | — |
| `AzFastScroller` | 2.3 | Letter rail on the right edge. Drag to jump to a section. | `Column` + `pointerInput` |
| `ReaderBottomBar`, `PageFilmstrip`, `TapZonesOverlay`, `ReadingModeHint`, `PageNumber` | 2.6–2.9 | Mihon-style reader chrome (see [2.6](#26-reader--menus)) | — |
| `EndOfGallery` | 2.10 | Big cover (48 dp corners), "You finished it" | — |
| `ArticleHero` | 3.2 | Full-bleed image with a gradient and the headline on top | — |
| `TitleHero` | H.7 | Poster backdrop + overlapping 2:3 cover | — |
| `StatusLine` | H.1 | "Updated 12 min ago · 2,322 titles" + Refresh text button | — |
| `StudioLink` | H.7 | Studio avatar + name + count, clickable | — |
| `ProfileHeader` | P.1 | Avatar, name, "Your profile · on this device", stats chips | — |
| `AvatarPicker` | O.6, S.12 | Row of avatar choices, single-select, last item = photo picker | — |
| `ThemePreviews` | O.8 | Three mini phone previews (Light / Dark / Pure black), selectable | — |
| `OnboardingIllustration` | O.2–O.4 | Illustration box per welcome page (48 dp corners) | — |
| `EchoSplash` | O.1 | Android 12 SplashScreen API icon + "Echo · Listen · Read · Watch" + version | `core-splashscreen` |

---

## 9. Phase 3: Data and storage

### 9.1 What is stored where

| Store | Holds | Why there |
|---|---|---|
| **DataStore** (`settings`) | Theme, playback, reader defaults, source preferences, JAV, updates, AI subtitles | Small key/value settings, read as a `Flow` |
| **DataStore** (`profile`) | Name, avatar, age, show adult sources, onboarding done, first-run tip shown, enabled sections | Read on launch to pick the start screen |
| **Room** (`echo.db`) | Library, history, playlists, liked tracks, queue, per-gallery reader settings, search history | Lists you query, sort and page |
| **Fake catalogue** (memory) | Everything from the sites: feeds, works, galleries, movies, titles, news | Replaced by the real services later |
| **Coil disk cache** | Covers and pages (later) | Cleared from S.6 |

### 9.2 DataStore keys

| Group | Keys (default) | Screens |
|---|---|---|
| Theme | `themeMode` (SYSTEM), `dynamicColor` (true), `pureBlack` (false), `seedColor` (#6750A4), `dynamicPlayerColor` (true), `blurredPlayerBackground` (true), `biggerCovers` (false), `animations` (true) | S.8, O.8 |
| Playback | `defaultSpeed` (1.0), `skipSeconds` (10), `resume` (true), `finishedThreshold` (2 min / 5%), `defaultQuality` (Auto), `pictureInPicture` (true) | S.9, 1.11 |
| Reader defaults | `readingMode` (Paged R→L), `tapZones` (Default), `scaleType` (Fit screen), `cropBorders`, `dualPageLandscape`, `background` (Black), `showPageNumber`, `keepScreenOn` | S.10, 2.8 |
| ASMR source | `musicSource` (asmr.one), `subtitlesOnly`, `sfwOnly`, `mirror` (asmr-100), `translationLanguage` (English), `homeTags` (set) | S.2, S.3 |
| JAV | `hideUpcoming` (false) | S.5 |
| Updates | `channel` (Stable), `autoCheck` (true), `wifiOnly` (true), `showWhatsNew` (true) | S.13 |
| AI subtitles | `enabled`, `engine`, `model` (UI only, Phase 2 feature) | S.4 |
| Profile | `name` ("Pat"), `avatar`, `age`, `showAdultSources`, `enabledSections`, `onboardingDone`, `firstRunTipShown` | O.5–O.9, S.12, P.1 |

`SettingsRepository` and `ProfileRepository` expose typed `Flow`s and `update { }` functions. Screens never touch keys.

**Adult content rule** (from O.7 and S.12): if `age < 18` or `showAdultSources` is off, JAV, Hentai and adult ASMR
sources are hidden from the source switcher (0.1), O.5 and Library.

### 9.3 Room tables

| Table | Columns | Used by |
|---|---|---|
| `history_listen` | workId, trackId, title, artist, coverUrl, positionMs, durationMs, updatedAt, finished | 0.2 Continue / Listening, 0.3, 1.1 Continue listening, Work "Continue" |
| `history_read` | galleryId, title, artist, coverUrl, page, pageCount, updatedAt, finished | 0.2 Reading, 0.3 Manga, 2.1 Continue reading, 2.5 Continue p. N |
| `history_watch` | kind (JAV / HENTAI), id, code, title, coverUrl, episode, positionMs, durationMs, updatedAt, finished | 0.2 Watching, 3.12, H.9, 3.6 Resume |
| `playlist`, `playlist_track` | id, name, privacy, createdAt / playlistId, position, track fields | 1.7, 1.12, P.1 |
| `liked_track` | trackId, track fields, likedAt | 1.12 "Liked tracks", like toggles |
| `queue_item`, `queue_state` | position, track fields / currentIndex, positionMs, playingFrom | 1.8, 1.9, mini player |
| `reader_prefs` | galleryId, mode, tapZones, scaleType, cropBorders, dualPage | 2.8 "For this gallery" |
| `search_history` | section, query, searchedAt | 1.2 RECENT, other searches |

- **`FakeSeeder`** (debug builds) fills Room on first launch with the Figma rows ("Whispered bedtime story · 42 min
  left", "Gallery title · p. 34 / 52", "ABC-101 · Resume 42:07"), so Library and History look like Figma straight
  away.
- **Clear history** (0.3) and **Clear watch history** (3.12) delete from one table after a confirm dialog.
- **Clear all data** (S.7) runs `db.clearAllTables()`, clears both DataStores and the Coil cache, then restarts at O.1.

### 9.4 Fake catalogue

- `FakeCatalog` holds the placeholder content copied from the Figma frames, one object per section.
- `Fake*Repository` returns it as `Flow`s / `PagingData` with a short delay (default 300 ms), so loading states are
  visible.
- `FakeConfig` (a debug menu in S.11) forces **Loading**, **Empty**, **Error: offline**, **Error: blocked (451)** or
  **Error: busy** for any screen. Every state in Figma (0.4, H.10) can be checked without a network.
- `FakePlayerController` is a small state machine (play, pause, seek, next, previous, queue, speed, sleep timer) with a
  ticking position, so the player UI behaves like the real thing.

---

## 10. Phase 4: App shell and navigation

### 10.1 Scaffold

```
EchoAppScaffold
├── EchoNavHost                     every screen
├── PlayerSheet                     above content: MiniPlayer (collapsed) ↔ full player (expanded)
├── EchoNavigationBar               floating, bottom, Home · Search · Library
└── SnackbarHost
```

| Shown on | Navigation bar | Mini player |
|---|---|---|
| Section screens (1.x, 2.1–2.5, 2.11, 3.x, H.x), 0.2, 0.3 | Yes | Yes, when the queue isn't empty |
| Settings S.1–S.13, 0.4, H.10 | No | No |
| Full player, Up Next, Lyrics (inside the sheet) | No | No (the sheet is expanded) |
| Reader 2.6–2.10, theaters 3.7 / H.11, H.8, onboarding | No | No. Immersive, system bars hidden in the reader and theaters. |

### 10.2 The navigation bar follows the section

Home · Search · Library open different screens depending on the section picked in the source switcher. This matches the
Figma prototype links.

| Section | Home | Search | Library |
|---|---|---|---|
| ASMR (asmr.one, Japanese ASMR, JASMR, Hentai ASMR) | 1.1 | 1.2 | 0.2 |
| Manga (3hentai) | 2.1 | 2.2 | 0.2 |
| JAV (javdatabase, BETA) | 3.1 | 3.11 | 3.12 |
| Hentai | H.1 | H.6 | H.9 |

Switching section in 0.1 clears the back stack to that section's Home. Each nav tab keeps its own back stack
(`saveState` / `restoreState`).

### 10.3 Routes

`@Serializable` objects in `navigation/Routes.kt`, one per frame. Screens that are an overlay in Figma are **not**
routes. They are state on the screen beneath:

| Figma | Is | Over |
|---|---|---|
| 0.1 Source switcher | `ModalBottomSheet` (shell) | Any section Home |
| P.1 Profile | `ModalBottomSheet` (shell) | Any screen with the avatar |
| 1.9 Up Next, 1.10 Lyrics | Pages inside `PlayerSheet` | 1.8 |
| 1.11 Player › More | `ModalBottomSheet` | 1.8 |
| 2.6 / 2.7 | Reader state: menus shown / hidden | Reader |
| 2.8 Reader settings, 2.9 Pages | `ModalBottomSheet` | Reader |
| 3.8 filter sheet, H.4 Filters | `ModalBottomSheet` | 3.8 Idols, H.3 All titles |
| H.8 Preview viewer | Full-screen `Dialog` | H.7 |
| S.3 Music source, S.7 Clear all data | `AlertDialog` | S.2, S.6 |
| S.14 Update available, S.15 Downloading | `ModalBottomSheet` (shell, can appear anywhere) | Home |
| O.9 First-run tip | `RichTooltip` | 1.1 |

Start destination: `Onboarding` when `onboardingDone` is false, otherwise the last section's Home.

---

## 11. Screens, in build order

Each entry gives the Figma frame, the route, the layout from top to bottom with the components to use, what each tap
does (from the Figma prototype) and the data behind it. "Shell" means the floating navigation bar and the mini player
from [§10](#10-phase-4-app-shell-and-navigation).

### Phase 5: ASMR

#### 1.1 Home — **the first screen**
Figma `35:2` · route `AsmrHome` · `feature/asmr/home/`
1. `EchoSearchAppBar`: `SourceSwitcherButton` "asmr.one" → 0.1 · placeholder "Search" → 1.2 · `ProfileAvatar` → P.1.
2. `SectionTabs`: For you (this screen) · Popular · New · Recommended → 1.4 Feed, with that tab selected.
3. `CoverCarousel(MultiBrowse)`: big covers ("Rainy night library", "Ear cleaning"), extraLargeIncreased shape → 1.5.
4. `ShelfHeader` "Continue listening" + arrow → 1.4. `CoverCarousel(Uncontained)` of `ContinueCard`s with a
   `LinearProgressIndicator` and "42 min left" (from `history_listen`).
5. `ShelfHeader` "Trending tracks". `SegmentedList` of `TrackRow`s ("01 · Opening, whispered", "Circle Aoi · 4:12").
   Tap → plays → 1.8.
6. Shell.

States: Loading = `ContainedLoadingIndicator`, centred. Error = `EmptyState(Offline)` with Try again.
Data: `AsmrRepository.home(source)`, `LibraryRepository.continueListening()`.

#### 0.1 Source switcher
Figma `35:6876` · sheet in `shell/SourceSwitcherSheet.kt` · over 1.1
- `EchoSheet` with four `SegmentedList(singleSelect)` groups: **ASMR** (asmr.one, Japanese ASMR, JASMR, Hentai ASMR),
  **MANGA** (3hentai), **JAV** (javdatabase + `CoverBadge` "Beta" on tertiaryContainer), **HENTAI** (Hentai). The
  current source is selected (primaryContainer, check icon).
- Tap → set source and section, close the sheet, go to that section's Home (1.1 / 2.1 / 3.1 / H.1).
- `EchoButton(Text, S)` at the bottom → S.1. Scrim tap or swipe down → close.
- Adult sources are hidden by the [§9.2](#92-datastore-keys) rule.

#### 1.2 Search
Figma `35:137` · route `AsmrSearch`
- `EchoSearchView` (full-screen, query "rain", back arrow).
- Empty query: TRENDING `ChipRow(Suggestion)` (rain sounds, binaural …) and RECENT `SegmentedList` (from
  `search_history`, with a clock icon and a remove button).
- While typing: SUGGESTIONS `SegmentedList(standard)` with a search icon.
- Any chip or row → 1.3. Back → BACK. Shell.

#### 1.3 Search results
Figma `35:261` · route `AsmrSearchResults(query)`
1. `EchoSearchAppBar` showing the query "rain".
2. `ChipRow(Filter, single)`: All · Works · Tracks · Artists · Playlists.
3. "All" shows shelves: Works (`CoverCarousel(Uncontained)` → 1.5), Artists (round avatars → 1.6), Tracks
   (`SegmentedList` → 1.8). Other chips show one full list.
4. Shell.

#### 1.4 Feed
Figma `35:404` · route `AsmrFeed(tab)`
1. `EchoFlexibleAppBar(Medium)` "Popular", subtitle "asmr.one · 1,204 works", back, search → 1.2.
2. `ConnectedButtonGroup`: Today · Week · Month · All.
3. `CoverGrid` (2 columns) of `CoverCard`s (title + circle) → 1.5, paged with `LazyPagingItems`.
4. Shell.

#### 1.5 Work
Figma `35:508` · route `AsmrWork(id)`
1. `EchoSmallAppBar`: back, search → 1.2, more.
2. `MediaHeader`: cover, title, circle, "RJ01234567 · 12 tracks · 2h 14m", `ChipRow(Assist)` of voice actors and tags
   (→ 1.6).
3. `EchoButtonGroup`: Play (Filled, M) · Shuffle (Tonal, M) · like (Tonal icon toggle, square, morphs) → 1.8.
4. Description (bodyMedium, 3 lines, expandable).
5. `ShelfHeader` "Tracks". `SegmentedList`: folder row "Main audio · 8 tracks · 1h 52m", then `TrackRow`s, the playing
   one emphasized with "Playing · 18:40".
6. `ShelfHeader` "More like this". `CoverCarousel(Uncontained)`.
7. Shell.

#### 1.6 Artist
Figma `35:666` · route `AsmrArtist(id)`
1. `EchoFlexibleAppBar(Large)` "Aoi Mizuno", "Voice actor · 312 works", with a 96 dp avatar.
2. `EchoButtonGroup`: Play (Filled, S) · Shuffle (Tonal, S) · Follow (Outlined, S).
3. Three shelves (`ShelfHeader` + `CoverCarousel(Uncontained)`): Popular works, Latest releases (→ 1.5), Appears with
   (round avatars → 1.6).
4. Shell.

#### 1.7 Playlist
Figma `35:811` · route `AsmrPlaylist(id)`
1. `EchoFlexibleAppBar(Medium)` "Sleep queue", "You · Private · 18 tracks · 6h 02m", back, more.
2. `EchoButtonGroup`: Play (Filled, M) · Shuffle (Tonal, M) · edit (Outlined icon toggle).
3. `SegmentedList(reorderable)` of `TrackRow`s with drag handles. Long-press and drag to reorder (`reorderable`),
   saved to `playlist_track`.
4. `MediumExtendedFloatingActionButton` "Add tracks" → 1.2.
5. Shell.

#### 1.8 Full player
Figma `35:947` · `PlayerSheet` expanded · `feature/asmr/player/`
1. `EchoSmallAppBar(centered)`: collapse (chevron down), overline "PLAYING FROM WORK" / "Whispered bedtime story",
   more → 1.11.
2. `CoverCarousel(Hero)`: the cover, extraLargeIncreased. Swipe for previous or next track.
3. Title (headlineSmall emphasized), "Circle Aoi · Aoi Mizuno", "Track 2 of 12 · Binaural", like (Outlined icon
   toggle).
4. `SeekSlider(wavy)` with "7:42" / "−10:58".
5. Controls `EchoButtonGroup`: replay 10 (Tonal) · previous · **play/pause (Filled, L, wide, square, morphs)** · next ·
   forward 10 (Tonal).
6. "NEXT" `SegmentedListItem` "03 · Rain and heartbeat" → 1.9.
7. `EchoFloatingToolbar`: Up next → 1.9 · Lyrics → 1.10 · Sleep · 1.0×.

Colours from the cover when Dynamic player colour is on ([§7.2](#72-theme-modes)). Blurred cover background when that
setting is on. Swipe down → collapse to the mini player.

#### 1.9 Up Next
Figma `35:1036` · page inside `PlayerSheet`
- `MiniPlayer` at the top (tap or swipe down → back to 1.8).
- `ConnectedButtonGroup`: Up next · Lyrics (→ 1.10).
- "PLAYING FROM · WHISPERED BEDTIME STORY". `SegmentedList(reorderable)` of the queue, current track highlighted.
  Swipe a row to remove it.
- `EchoFloatingToolbar`: Shuffle · Repeat · Clear.

#### 1.10 Lyrics
Figma `35:1467` · page inside `PlayerSheet`
1. `EchoSmallAppBar` (now playing: title, "Circle Aoi · Track 2 of 12").
2. `ConnectedButtonGroup`: Up next (→ 1.9) · Lyrics. `AssistChip`s: Synced · Translated · English.
3. `SyncedLyrics`: time + line + Japanese line. Tap a line → seek.
4. `PlayerControls(compact)`.
5. `EchoFloatingToolbar(vibrant)` with `ConnectedButtonGroup` Both · EN · JP.

#### 1.11 Player › More sheet
Figma `35:1199` · `ModalBottomSheet` over 1.8
- Header: the track (`SegmentedListItem`).
- PLAYBACK SPEED: `ConnectedButtonGroup` 0.75× · 1.0× · 1.25× · 1.5×.
- SLEEP TIMER: `ChipRow(Filter, single)` Off · 15 min · 30 min · 1 h.
- `SegmentedList`: Add to playlist, Go to work, Go to artist, Share.

#### 1.12 Playlists
Figma `35:1348` · route `AsmrPlaylists` (from the 0.2 "Playlists" chip and P.1)
1. `EchoFlexibleAppBar(Medium)` "Playlists", "On this device · 6 playlists", `ProfileAvatar`.
2. `ChipRow(Filter, single)`: Favourites · Liked tracks · History.
3. `SegmentedList`: Sleep queue (Private · 18 tracks) … → 1.7.
4. `MediumExtendedFloatingActionButton` "New playlist" → name dialog.
5. Shell. Data: `PlaylistRepository` (Room).

### Phase 6: Shared

#### 0.2 Library
Figma `28:6608` · route `Library` (ASMR and Manga Library tab)
1. `EchoFlexibleAppBar(Medium)` "Library", "Everything you played, read and watched", history icon button → 0.3,
   `ProfileAvatar` → P.1.
2. `ChipRow(Filter, single)`: All · Listening · Reading · Watching (→ 3.12) · Playlists (→ 1.12).
3. `ShelfHeader` "Continue". `CoverCarousel(Uncontained)` mixing all sections, each with a `CoverBadge` (ASMR /
   MANGA / JAV / HENTAI) and progress ("42 min left", "p. 34 / 52", "Resume 42:07"). Tap → 1.5 / 2.5 / 3.6.
4. `ShelfHeader` "ASMR" → 0.3. `SegmentedList` of recent tracks → 1.8.
5. `ShelfHeader` "JAV / Hentai" → 3.12 / H.9. `SegmentedList` → resume.
6. Shell. Data: the three history tables, newest first.

#### 0.3 History
Figma `28:6776` · route `History`
1. `EchoFlexibleAppBar(Medium)` "History", back.
2. `ConnectedButtonGroup`: ASMR · Manga. `EchoButton(Text, S)` "Clear" → confirm `AlertDialog`.
3. `SegmentedList` per day (TODAY, YESTERDAY, NOV 17). Each row: cover, title, "Page 34 of 52" / "Finished",
   trailing `EchoButton(Tonal, XS)` "Continue" or `EchoButton(Outlined, XS)` "Read again" → the reader. Row → 2.5.
4. Shell.

#### 0.4 Not found & empty
Figma `28:6895` · `feature/shared/states/` · not a route: the shared `EmptyState` variants
- **Page not found**: `EchoButton(Filled, S)` "Back to home" → Home. Used for unknown routes and `NotFound` errors.
- **You're offline**: `EchoButton(Tonal, S)` "Try again".
- **Nothing watched yet**: "Movies you start show up here." (no button). Every list has an empty variant like this.

### Phase 7: Manga

#### 2.1 Browse
Figma `28:1575` · route `MangaBrowse`
1. `EchoSearchAppBar` "3hentai" → 2.2. `SectionTabs`: Browse · Tags (→ 2.3) · Artists (→ 2.11).
2. `ConnectedButtonGroup`: New · Popular. `EchoButton(Tonal, S)` "All languages" → `DropdownMenu`.
3. `ShelfHeader` "Continue reading" + icon → 0.2. `CoverCarousel(Uncontained)` with progress "p. 34 / 52".
4. `CoverGrid` (3 columns) of `GalleryCard`s with `CoverBadge` pages ("23p") and language ("JP") → 2.5. Paged.
5. Shell.

#### 2.2 Search
Figma `28:1728` · route `MangaSearch`
- `EchoSearchView` (query "orita"). `ChipRow(Filter, single)`: All languages · Japanese · English · Chinese.
- "1,284 RESULTS" overline. `CoverGrid` (3 columns) → 2.5. `ContainedLoadingIndicator` "Loading more" at the end of
  the page. Shell.

#### 2.3 Tags index
Figma `28:1836` · route `MangaTags`
1. `EchoSearchAppBar` + `SectionTabs` (Tags selected).
2. `InlineSearchBar` "Search tags". `ConnectedButtonGroup`: A–Z · Popular.
3. A `SegmentedList` per letter (sticky letter headers), rows "Tag name A1 · 12,480" → 2.4.
4. `AzFastScroller` on the right. Shell.

#### 2.4 Tag list
Figma `28:1971` · route `MangaTagList(tag)`
1. `EchoFlexibleAppBar(Medium)` "Tag name A1", "Tag · 12,480 galleries", back, search → 2.2.
2. `ConnectedButtonGroup`: New · 24h · 7 days · All time.
3. `CoverGrid` (3 columns) → 2.5. Shell.

#### 2.5 Gallery
Figma `28:2113` · route `MangaGallery(id)`
1. `EchoSmallAppBar`: back, share, more.
2. `MediaHeader(gallery)`: cover, title, artist, "52 pages · Japanese · Doujinshi", "Added 2026-11-18".
3. `EchoButtonGroup`: `EchoSplitButton` "Continue p. 34" (→ reader 2.7; the menu offers Start over / Choose page) ·
   download (Tonal, square) · bookmark (Outlined toggle).
4. `LinearWavyProgressIndicator` read progress "65%".
5. Tag groups as labelled `ChipRow(Assist)`: Parodies, Characters, Tags, Artists, Groups → 2.4.
6. `ShelfHeader` "Pages · 52". Page thumbnail grid (3 columns) → reader at that page.
7. `ShelfHeader` "More by Artist Name". `CoverCarousel(Uncontained)`. Shell.

#### 2.6 Reader · menus
Figma `28:2404` · route `MangaReader(id, page)` · `feature/manga/reader/` · immersive, dark
- `EchoSmallAppBar` floating over the page: back → 2.5, title + artist, `CoverBadge` "34 / 52", settings → 2.8.
- `PageFilmstrip`: nearby page thumbnails, current one outlined. Tap → 2.9.
- `ReaderBottomBar` (Mihon layout): `EchoSlider(XS, with stops)` for the page, and `EchoFloatingToolbar` quick
  actions R → L · Rotate · Crop · Pages (→ 2.9) · Settings (→ 2.8).
- Tap the page centre → hide menus (2.7). Menus slide in and out with `defaultSpatialSpec`.

#### 2.7 Reader · immersive
Figma `28:2509` · same route, menus hidden
- Full-screen pages (`HorizontalPager`, reversed for R→L, zoom later with Telephoto). `PageNumber` "34 / 52" at the
  bottom.
- `TapZonesOverlay` shown briefly on open: left = next page (R→L), centre = show menus (→ 2.6), right = previous.
- `ReadingModeHint` "Paged (right to left)" fades out after about 1.5 s.
- Past the last page → 2.10.

#### 2.8 Reader settings
Figma `28:2553` · `ModalBottomSheet` over the reader
- `EchoButton(Tonal, XS)` "For this gallery" (saves to `reader_prefs` instead of the defaults).
- `SectionTabs`: Reading mode · General · Filter.
- READING MODE: `SelectableCard` grid (Paged · Right to left · Left to right · Vertical · Long strip …).
- `ChipRow(Filter, single)` and `SegmentedList` of paged settings with `SettingSwitchRow`s.

#### 2.9 Pages sheet
Figma `28:2747` · `ModalBottomSheet` over the reader
- Title "Pages · 34 of 52". Thumbnail grid, current one labelled "34 · Reading" → jump to that page.
- `EchoButtonGroup`: First page · Last page (Tonal, S).

#### 2.10 End of gallery
Figma `28:3147` · reader end state
- `EndOfGallery`: big cover, "You finished it" (displaySmall), "Gallery title · 52 pages".
- `EchoButtonGroup`: Back to gallery (Filled, M) → 2.5 · Read again (Outlined, M) → page 1.
- `ShelfHeader` "More by Artist Name". `CoverCarousel(Uncontained)` → 2.5. Marks `history_read.finished`.

#### 2.11 Artists index
Figma `28:3214` · route `MangaArtists`
- `EchoSearchAppBar` + `SectionTabs` (Artists). `InlineSearchBar` "Search artists". `ConnectedButtonGroup` A–Z · Popular.
- "MOST GALLERIES". `SegmentedList` of artists ("1,204 galleries", trailing chevron) → 2.4. Shell.

### Phase 8: JAV

#### 3.1 News
Figma `28:3332` · route `JavNews` (JAV Home)
1. `EchoSearchAppBar` "javdatabase" → 3.11. `SectionTabs`: News · Latest (→ 3.3) · Movies (→ 3.4) · Idols (→ 3.8) ·
   Genres (→ 3.10).
2. `ChipRow(Filter, single)`: For you · Releases · Industry · Interviews · Rankings.
3. Top story `ElevatedCard` (image, "TOP STORY · RELEASES", headline, "Nov 19 · 3 min read") → 3.2.
4. `ShelfHeader` "Trending" + icon → 3.3. `CoverCarousel(Uncontained)` of stories → 3.2.
5. TODAY `SegmentedList` of news rows (category overline, headline, thumbnail) → 3.2. Shell.

#### 3.2 News post
Figma `28:3458` · route `JavNewsPost(id)`
- `ArticleHero` with `EchoSmallAppBar(transparent)` over it. "RELEASES · 3 min read", headline, "javdatabase news ·
  Nov 19, 2026".
- Body text, pull quote, image with caption.
- MENTIONED IN THIS STORY: `ChipRow(Assist)` ABC-101 · Idol Name A · Example Studio → 3.6.
- `EchoFloatingToolbar`: Share · Save · Text size · Source. Shell.

#### 3.3 Latest
Figma `28:3558` · route `JavLatest`
- `EchoSearchAppBar` + `SectionTabs` (Latest). `ConnectedButtonGroup`: Censored · Uncensored.
  `ChipRow(Filter, single)`: Released · Upcoming (Upcoming hidden when `hideUpcoming` is on, S.5).
- `CoverGrid` (**2 columns**) of `MovieCard`s (landscape cover, "ABC-101", title, date) → 3.6. Shell.

#### 3.4 Movies
Figma `28:3670` · route `JavMovies`
- Like 3.3, with a sort bar: `ChipRow(Filter, single)` Newest · Most viewed · Top rated + filter icon button (Tonal).
  Grid → 3.6.

#### 3.5 Movie list
Figma `28:3780` · route `JavMovieList(kind, id)` (studio, genre or director)
- `EchoFlexibleAppBar(Medium)` "Example Studio", "Studio · 1,284 movies", back, search → 3.11.
- `EchoButton(Tonal, S)` "Newest" → sort `DropdownMenu`. `CoverGrid` (2 columns) → 3.6. Shell.

#### 3.6 Movie page
Figma `28:3867` · route `JavMovie(id)`
1. `EchoSmallAppBar`: back, share, more.
2. `CoverCarousel(Hero)` of the cover and sample images, with a play `FilledIconButton` on the cover.
3. Title, `ChipRow(Assist)` ABC-101 · Example Studio.
4. `EchoButtonGroup`: `EchoSplitButton` "Resume 42:07" (menu: Start over, Quality) → 3.7 · Trailer (Tonal, M) → 3.7.
5. Details `Card(Filled)`: Released, Runtime, Studio (→ 3.5), Director. `EchoButton(Text, S)` "Open on javdatabase".
6. Shelves: Cast (`CoverCarousel(MultiBrowse)` of idols → 3.9), Genres (`ChipRow(Assist)` → 3.10), Sample images, More
   like this (`CoverCarousel(Uncontained)`). Shell.

#### 3.7 Theater (landscape)
Figma `28:4026` · route `JavTheater(id)` · forced landscape, immersive, black
- `EchoSmallAppBar(overlay)`: back, "ABC-101 · Movie title", quality and more buttons.
- Centre `EchoButtonGroup`: replay 10 · **play/pause (Tonal, wide, square)** · forward 10.
- Bottom: `EchoSlider(XS)` "42:07 / 2:00:00", fullscreen, PiP, speed.
- Quality `DropdownMenu`: Auto · 1080p · 720p · 480p. Controls auto-hide after 3 s. Design phase: a black video
  placeholder with a fake position.

#### 3.8 Idols + filter sheet
Figma `28:4088` · route `JavIdols`
- `EchoSearchAppBar` + `SectionTabs` (Idols). Sort bar: `ChipRow(Filter, single)` Popular · Newest · A–Z + filter
  icon button (Tonal) with a `Badge` "2".
- Active filters as `InputChip`s: "Debut 2020–2024", "Active".
- `CoverGrid` (3 columns) of `IdolCard`s (portrait photo, name, "40 movies") → 3.9.
- **Filter sheet** (`EchoSheet`): `ChipRow(Filter)` groups, Reset (Text, S), `EchoButtonGroup` Cancel (Outlined, M) ·
  Apply (Filled, M).

#### 3.9 Idol page
Figma `28:4233` · route `JavIdol(id)`
- `EchoFlexibleAppBar(Large)` "Idol Name A", "Debut 2021 · Active · 126 movies".
- `EchoButtonGroup`: Follow (Filled, S) · Agency A (Outlined, S) → 3.8 filtered.
- `ChipRow(Filter, single)`: Only her · Newest · Most viewed.
- `ShelfHeader` "Upcoming" + `CoverCarousel(Uncontained)` ("Releases Dec 3"). `ShelfHeader` "Movies · 126" + grid →
  3.6. Shell.

#### 3.10 Genres
Figma `28:4349` · route `JavGenres`
- `EchoSearchAppBar` + `SectionTabs` (Genres).
- One `OutlinedCard` per group (Format · 5 genres, Story · 4 genres, Setting …), each holding a `ChipRow(Assist)` (VR,
  4K, Debut …) → 3.5. Shell.

#### 3.11 Search
Figma `28:4469` · route `JavSearch`
- `EchoSearchView` (query "ABC-1"). `ConnectedButtonGroup`: Movies · Idols. `ChipRow(Filter, single)`: Censored ·
  Uncensored.
- `SegmentedList` of results (code, title, "2026-11-19 · Example Studio") → 3.6. Shell.

#### 3.12 Library
Figma `28:4561` · route `JavLibrary`
- `EchoFlexibleAppBar(Medium)` "JAV library", "Saved on this device".
- `ConnectedButtonGroup`: Continue watching · Watched.
- `SegmentedList` of rows ("ABC-101 · Resume 17:01 · Example Studio") → 3.6. Row more → `DropdownMenu`: Resume (→ 3.7) ·
  Start over · Remove from library.
- `EchoButton(Text, S)` "Clear watch history" → confirm dialog. Shell. Data: `history_watch` where kind = JAV.

### Phase 9: Hentai

#### H.1 Home
Figma `28:4682` · route `HentaiHome`
1. `EchoSearchAppBar` "Hentai" → H.6. `SectionTabs`: Home · Browse (→ H.2) · All titles (→ H.3) · Seasons (→ H.5).
2. `StatusLine` "Updated 12 min ago · 2,322 titles" + Refresh (Text, XS).
3. `CoverCarousel(Hero)` of landscape posters with `CoverBadge` NEW → H.7.
4. Shelves: New uploads and others (`ShelfHeader` + icon → H.3, `CoverCarousel(Uncontained)` of `HanimeCard`s) → H.7.
5. `Snackbar` for live catalogue updates, with an action (Text, S) → H.3. Shell.

#### H.2 Browse
Figma `28:4852` · route `HentaiBrowse`
- `SectionTabs` (Browse). Big entry `Card(Filled)`s: Trending, By year and season, Random, All titles → H.3.
- `ShelfHeader` "Categories & tags". `ChipRow(Filter, single)`: All · Format · Story · Characters · Pairing · Other.
- `CoverCarousel(Uncontained)` of tall tag cards (HD · 2,014 titles, Uncensored · 611 titles) → H.3.
  `ConnectedButtonGroup` + `ChipRow(Assist)` for more tags. Shell.

#### H.3 All titles
Figma `28:4991` · route `HentaiTitles(filters)`
- `SectionTabs` (All titles). `ChipRow(Filter, single)` sort: Newest upload · Views · Rating · Trending · Released, plus
  an order icon button (↓).
- `ConnectedButtonGroup`: All · Censored · Uncensored. `EchoButton(Tonal, S)` "Filters" + `Badge` "3" → H.4.
- Active filters as `InputChip`s: Tag A · not Tag B · 2018–2026. "214 titles".
- `CoverGrid` (3 columns) of `HanimeCard`s (NEW badges, views) → H.7. Shell.

#### H.4 Filters sheet
Figma `28:5186` · `ModalBottomSheet` over H.3
- Tag `ChipRow`s with **tri-state** chips (include ✓ / exclude ✕ / off). An Echo variant of `FilterChip`: include =
  secondaryContainer, exclude = errorContainer with a strikethrough label.
- Year `RangeSlider` (2018–2026). `ConnectedButtonGroup`s for the other options.
- Reset (Text, S). `EchoButtonGroup` Cancel (Outlined, M) · Show 214 titles (Filled, M).

#### H.5 Seasons
Figma `28:5451` · route `HentaiSeasons`
- `SectionTabs` (Seasons). `ChipRow(Filter, single)` years 2026 … 2021.
- One shelf per season ("Fall 2025 · 14 titles", `ShelfHeader` + icon → H.3, `CoverCarousel(Uncontained)` of
  `HanimeCard`s → H.7). Shell.

#### H.6 Search
Figma `28:5652` · route `HentaiSearch`
- `EchoSearchView` (query "ane"). Grouped `SegmentedList`s: TITLES ("Episode 1 · Studio Name · 2024"), SERIES, TAGS,
  STUDIOS → H.7. Last row "Search for "ane"" → H.3 filtered. Shell.

#### H.7 Title page
Figma `28:6186` · route `HentaiTitle(id)`
1. `TitleHero` with `EchoSmallAppBar(transparent)` and glass icon buttons (back, share, more).
2. `CoverBadge`s UNCENSORED · EP 1, title, `StudioLink` → H.3, "Released 2024-08-09 · Added 2024-08-12".
3. `ChipRow(Assist)`: FHD 1080p · 23 min · Sub EN · Dub JP.
4. `EchoButtonGroup`: Watch (Filled, M) → H.11 · download (Tonal, square) · like (Outlined).
5. Stats `Card(Filled)`: 3.3M Views · 41K Likes · 94% Rating · 210K Downloads.
6. Shelves: Synopsis (Show more, Text XS), Alternate names (Japanese line), Storyboard (`CoverCarousel(MultiBrowse)` of
   frames → H.8), Episodes (`SegmentedList` → H.11), More like this (3-column `HanimeCard` grid). Shell.

#### H.8 Preview viewer
Figma `28:5951` · full-screen `Dialog` over H.7
- `EchoSmallAppBar` "Preview" with close, "3 / 14 · 3:41".
- `CoverCarousel(Uncontained)` of frames. `EchoButtonGroup` previous / next (Tonal, wide).

#### H.9 Library
Figma `28:6000` · route `HentaiLibrary`
- `EchoFlexibleAppBar(Medium)` "Hentai library", "Saved on this device", `ProfileAvatar`.
- `ConnectedButtonGroup`: Continue watching · Watched. `SegmentedList` ("EPISODE 2 · Title placeholder 1 · 13:01 left ·
  Studio Name") → H.11. Shell. Data: `history_watch` where kind = HENTAI.

#### H.10 Title states
Figma `28:6103` · not a route: `EmptyState` variants for H.7
- **Blocked (451)**: "This title isn't available in Echo." No retry.
- **Busy**: "The source is busy, try again later" + Try again (Tonal, S) → reload H.7.
- **No video**: "No video for this title" + Back (Text, S).

#### H.11 Theater (landscape)
Figma `28:6140` · route `HentaiTheater(id, episode)`
- Same as 3.7, with "EPISODE 1 · SUB EN" and a Source button (Outlined, S) for picking the stream host.

### Phase 10: Settings and profile

Every S screen: `EchoFlexibleAppBar(Medium)` (S.1 Large) with back, then `SegmentedList` groups with overline headers.
No navigation bar. Every switch writes to `SettingsRepository` straight away; there's no Save button.

#### P.1 Profile
Figma `29:28468` · sheet in the shell, over the current screen
- `ProfileHeader` (avatar, "Pat", "Your profile · on this device") → S.12.
- `ChipRow(Assist)`: 6 playlists · 64 liked · 12 h listened → 1.12.
- `SegmentedList`: Your library → 0.2 · History → 0.3 · Settings → S.1. Scrim → close.

#### S.1 Settings
Figma `29:28648` · route `Settings`
- `EchoFlexibleAppBar(Large)` "Settings".
- **YOU**: Pat · "Profile · avatar, name, age" → S.12.
- **SOURCES**: Music source → S.3 · asmr.one preferences → S.2 · JAV → S.5.
- **APP**: Look and feel → S.8 · Playback → S.9 · Reader → S.10 · AI subtitles ("Phase 2 on Android") → S.4.
- **DEVICE**: Storage → S.6 · App updates → S.13 · About → S.11.

#### S.2 Preferences (asmr.one)
Figma `29:28765` · route `SettingsAsmr`
- Music source row → S.3. BROWSE: `SettingSwitchRow` Only show works with subtitles · Only show SFW works in search.
- SOURCE: Site mirror (asmr-100), Translation language (English) → pickers.
- SHOW TAGS ON HOME PAGE: `ChipRow(Filter, multi)` (Binaural, Ear cleaning …). Writes `homeTags`, which 1.1 reads.

#### S.3 Music source dialog
Figma `29:28844` · `AlertDialog` over S.2
- `RadioButton` group: asmr.one · Japanese ASMR · JASMR · Hentai ASMR, each with a supporting line. Picking one saves
  and closes. Cancel (Text, S).

#### S.4 AI subtitles
Figma `29:28958` · route `SettingsAiSubtitles`
- A note that this is a desktop feature, hidden in Android Phase 1. Switch, Engine (Whisper · CPU), Model (Base ·
  142 MB), "Speed on this device 1.8× real time". UI only.

#### S.5 JAV
Figma `29:29011` · route `SettingsJav`
- `SettingSwitchRow` "Hide upcoming movies" (3.3 and 3.9 read it). A note that content rules are built in and can't be
  turned off.

#### S.6 Storage
Figma `29:29039` · route `SettingsStorage`
- Image cache "Covers and pages · 248 MB" + Clear (Outlined, S). Source caches "· 64 MB" + Clear (Outlined, S).
- DANGER ZONE: Clear all data (Filled, S, error colours) → S.7.

#### S.7 Clear all data dialog
Figma `29:29079` · `AlertDialog` over S.6
- "Clear all data?" + explanation. Cancel (Text, S) · Clear (Filled, S, error). Clear runs the
  [§9.3](#93-room-tables) reset and restarts at O.1.

#### S.8 Look and feel
Figma `29:29128` · route `SettingsLookAndFeel`
- THEME: `ConnectedButtonGroup` System · Light · Dark.
- COLOUR: Dynamic colour ("From your wallpaper (Android 12+)", disabled below Android 12) · Pure black ("AMOLED dark
  theme", disabled in Light).
- PLAYER: Dynamic player colour · Blurred cover background.
- LAYOUT: Bigger covers ("For tablets") · Animations.
- Every change applies live through [§7.3](#73-how-a-switch-flows-through-the-app). This screen is the main test of
  theme switching.

#### S.9 Playback
Figma `29:29207` · route `SettingsPlayback`
- DEFAULT SPEED: `ConnectedButtonGroup` 0.75× · 1.0× · 1.25× · 1.5×. SKIP LENGTH: `EchoSlider(XS)` "10 s".
- RESUME: Resume where I left off · Count as finished ("Last 2 min or 5 %", picker).
- VIDEO: Default quality (Auto) · Picture-in-picture ("When you leave the theater").

#### S.10 Reader
Figma `29:29279` · route `SettingsReader`
- DEFAULT READING MODE: `SelectableCard` grid (Paged R→L, L→R, Vertical, Long strip, Continuous, With gaps, Auto, By
  category).
- PAGED: Tap zones (Default), Scale type (Fit screen), Crop borders, Two pages in landscape.
- GENERAL: Background colour (Black), Show page number, Keep screen on. The reader's 2.8 sheet uses these as defaults.

#### S.11 About
Figma `29:29387` · route `SettingsAbout`
- "Echo · Version 0.1.6 · Kotlin · Material 3 Expressive". PROJECT: App updates ("0.1.7 available") → S.13, Source
  code, What's new.
- LICENCES & CREDITS: Echo Android (design) · brahmkshatriya · Unabandon Public License; Mihon (reader design) ·
  Apache-2.0; Open-source licences.
- Debug builds: long-press the version → Design system screen and the `FakeConfig` menu.

#### S.12 Profile
Figma `29:29454` · route `SettingsProfile`
- Avatar + Change avatar (Tonal, S) → `AvatarPicker` sheet.
- ABOUT YOU: Name (Pat) → text dialog · Age (24, "Used to show or hide adult sources") → `AgeSlider` dialog.
- CONTENT: Show adult sources ("JAV, Hentai and adult ASMR · 18+ only"), disabled when age < 18.
- Reset profile (Outlined, S): clears name, avatar and age, and runs onboarding again.

#### S.13 App updates
Figma `29:29511` · route `SettingsUpdates`
- `Card(Filled)` "Echo 0.1.7 is available": size, date, release notes bullets, `EchoButtonGroup` Update now (Filled, S)
  → S.15 · Release notes (Text, S).
- UPDATE CHANNEL: `ConnectedButtonGroup` Stable · Beta · Nightly.
- OPTIONS: Check automatically (Once a day) → S.14 when found · Download on Wi-Fi only · Show what's new after
  updating.
- VERSION HISTORY list. Design phase: `FakeUpdateRepository`.

#### S.14 Update available
Figma `29:29607` · shell `ModalBottomSheet` over Home
- Version, size, notes. `EchoButtonGroup` Later (Outlined, M) · Update (Filled, M) → S.15.

#### S.15 Downloading update
Figma `29:29765` · same sheet, next state
- `LinearWavyProgressIndicator` (download). `EchoButtonGroup` Cancel (Outlined, M) · Install (Filled, M, enabled when
  done).

### Phase 11: Onboarding (built last)

Route group `Onboarding`, shown while `onboardingDone` is false. No shell. Each step saves its answer straight away, so
leaving and coming back resumes at the same step.

#### O.1 Splash
Figma `29:27967` · `EchoSplash`
- `core-splashscreen` icon, "Echo · Listen · Read · Watch", "v0.1.6", `ContainedLoadingIndicator`. Stays until the
  settings have loaded ([§7.3](#73-how-a-switch-flows-through-the-app)), then → O.2 (or Home if onboarding is done).

#### O.2 – O.4 Welcome
Figma `29:27982`, `29:28023`, `29:28073` · one `HorizontalPager` with three pages
- `OnboardingIllustration` (O.3 shows the source pill and ASMR · Manga · JAV · Hentai; O.4 shows ASMR · MANGA · JAV
  progress cards), headline, body, `PageIndicator`.
- `EchoButtonGroup`: Skip (Text, M) → O.5 · Next (Filled, M). O.4: Get started (Filled, M) → O.5.

#### O.5 Choose sources
Figma `29:28110`
- "What do you want in Echo?". Four `SelectableCard`s with `Checkbox`es: ASMR · Manga & doujinshi · JAV (BETA) ·
  Hentai.
- Continue (Filled, M) "Continue · 2 selected", disabled at 0. Saves `enabledSections`.

#### O.6 Your profile
Figma `29:28166`
- `OutlinedTextField` "Your name" (Pat), with the supporting text "Shown on your profile and Home greeting."
- PICK AN AVATAR: `AvatarPicker` (the last one opens the photo picker). Continue → O.7.

#### O.7 Age
Figma `29:28227`
- "How old are you?". `AgeSlider` 13–80+ with a value indicator ("24 years") and −/+ (Tonal) icon buttons for
  fine-tuning.
- The note under it: under 18 hides JAV, Hentai and adult ASMR, and content rules always apply. Continue → O.8.

#### O.8 Make it yours
Figma `29:28273`
- `ThemePreviews`: Light · Dark · Pure black (selectable). `SegmentedList`: Dynamic colour · Dynamic player colour
  switches.
- Changes apply live, the same as S.8. "Start exploring" (Filled, M) → sets `onboardingDone`, opens Home with O.9.

#### O.9 First-run tip — **the last screen**
Figma `29:28321` · `RichTooltip` over 1.1
- Anchored to the `SourceSwitcherButton`: explains switching sources. Two text buttons: Show me → opens 0.1 · Got it →
  closes. Tapping the scrim also closes it.
- Shown once (`firstRunTipShown`). Building it last means Home, the source switcher and onboarding are all finished, so
  the whole first-run path can be tested from O.1 to here.

### Phase 12: Polish

- Wire every tap to match the Figma prototype flows ("Echo phone · Full app (from splash)", ASMR, Manga, JAV, Hentai,
  Library, Settings). Walk each flow on the emulator next to Figma's prototype view.
- Shared-element transitions for covers (shelf → media page, mini player → full player) with `slowSpatialSpec`.
- An accessibility pass ([§12.4](#124-accessibility)). A final side-by-side pass over all 75 screens.

---

## 12. Testing

### 12.1 Unit tests (JVM, fast, in CI)

| What | Examples |
|---|---|
| Theme | `resolveColorScheme`: dynamic on → dynamic scheme; dynamic off + baseline seed → the exact Figma table; pure black → surface and background `#000000` only in dark; pure black ignored in light; a custom seed gives a different primary |
| Settings and profile | DataStore repositories on a temp file: defaults, updates, Flow emissions (Turbine) |
| Rules | Adult-content gating by age and switch; section → Home / Search / Library route mapping; start destination |
| ViewModels | Each screen's ViewModel with fake repositories: Loading → Content, Empty, each Error; events (play, toggle, filter) |
| Room | DAOs on an in-memory database (Robolectric): history ordering, continue lists, playlist reorder, clear all |
| Player | `FakePlayerController`: queue, next/previous, seek, speed, sleep timer |

### 12.2 Screenshot tests (Roborazzi, JVM, in CI)

- Every component preview and every screen preview, at Pixel 8 size, in **Light**, **Dark** and **Pure black**, plus
  font scale 1.3 for screens.
- Baselines are recorded once the screen matches Figma (checked by a person, [§4.4](#44-comparing-with-figma)). After
  that, `verifyRoborazziDebug` fails on any unintended pixel change.
- Screens are rendered with the fake catalogue and a fixed clock, so the images are stable.

### 12.3 UI tests (on the emulator, `androidTest`)

| Flow | Checks |
|---|---|
| First run | O.1 → O.9 → Home. Restart → straight to Home. Answers saved. |
| Theme | S.8 Dark → colours change without restarting. Restart → still dark. Pure black on → background black. |
| Sections | 0.1 → pick 3hentai → nav bar Home goes to 2.1 and Library to 0.2. Pick javdatabase → Library goes to 3.12. |
| Player | Tap a track → mini player shows. Drag up → 1.8. Up next / Lyrics pages. Drag down → collapsed. |
| Reader | Tap zones turn pages in R→L. Centre tap toggles menus. Last page → 2.10. |
| Sheets and dialogs | Filter sheets apply and cancel. Clear all data → back to O.1. |
| Back | System back from every screen goes where the Figma "BACK" link goes |
| Adult gating | Age 16 in O.7 → JAV and Hentai missing from 0.1 and O.5 |

### 12.4 Accessibility

- Accessibility checks enabled in Compose UI tests (touch target ≥ 48 dp, contrast, labels).
- `contentDescription` on every icon-only control. Headings marked with `semantics { heading() }`.
- Font scale 1.3 and 2.0, display size large: nothing clipped or overlapping.
- TalkBack walk through 1.1, 1.8, 2.7 and S.8.

### 12.5 Commands and CI

```bash
cd apps/android
./gradlew lint test verifyRoborazziDebug assembleDebug   # CI (GitHub Actions)
./gradlew connectedDebugAndroidTest                       # local, emulator running
```

`apps/android/MANUAL-TESTS.md` gets one row per screen: theme modes, dynamic colour, back, empty and error states,
font scale.

---

## 13. Definition of done

**For each screen**

- [ ] Matches the Figma frame side by side on `Pixel_8` (layout, spacing, type, colour roles, shapes, icons).
- [ ] Uses only tokens and `:designsystem` components. Every `M3E · …` / `Echo · …` layer in the frame has its
      matching component.
- [ ] Every prototype link from the frame works, and back matches Figma.
- [ ] Loading, empty and error states exist, and can be shown with `FakeConfig`.
- [ ] Looks right in Light, Dark, Pure black and with dynamic colour on.
- [ ] Previews and Roborazzi screenshots in the three themes. ViewModel unit test.
- [ ] Accessibility: labels, 48 dp targets, font scale 1.3.

**For each phase**

- [ ] `./gradlew lint test verifyRoborazziDebug assembleDebug` passes.
- [ ] Paired screenshots (emulator | Figma) for every screen in the phase, in the PR.
- [ ] Deliberate differences from Figma are listed in the PR, with the reason.

---

## 14. Open questions from Figma

These are differences inside the Figma file, to settle in Figma before the phase that needs them.

| # | Question | Plan until it's decided |
|---|---|---|
| 1 | DS · Colour and DS · Motion say theme switching and the Animations switch are on **S.9**, but they're on **S.8 Look and feel** (S.9 is Playback). | Follow the screens: S.8. Fix the DS text. |
| 2 | DS · Colour mentions **custom seed colour swatches** ("S.9 greys out the swatches"), but no screen has a colour picker. | Seed support is built into the theme (it's needed below Android 12) with `#6750A4`. Add a picker to S.8 only if Figma adds one. |
| 3 | The DS frames still mention `ANDROID.md`. | Ignore. This document replaces it. |
| 4 | The mini player is missing on Manga, JAV and Hentai screens and on 0.3. Is that because nothing is playing, or should audio stop showing there? | Show it on every screen with a nav bar while audio is queued. |
| 5 | `:core`'s `Section` enum has ASMR, MANGA and JAV, but Figma has a fourth group, **Hentai**. | The UI uses its own `Section` in `:data` with HENTAI. Align `:core` when the backend lands. |
| 6 | S.4 AI subtitles says "Android Phase 1 hides this", but it has a full screen. | Build the screen as UI only. Hide the S.1 row behind a flag. |
