# Developing Echo

How to build, run, test and release Echo. For using the app, see the [README](../README.md).

## Desktop app

```bash
cd web/backend-express && npm ci && npm run build      # the server
cd web/frontend && npm ci && npm run build             # the web UI
cd apps/desktop && npm ci && npm run typecheck && npm test
```

Run the desktop app from this repository. It uses the tools in `apps/desktop/resources/bin/<target>` when they are
built, and Homebrew's otherwise:

```bash
cd apps/desktop && npm run dev
```

Build the tools for your Mac (once):

```bash
brew install cmake nasm pkg-config
cd apps/desktop
WHISPER_REF=v1.9.5 bash scripts/build-whisper.sh mac-arm64 metal
FFMPEG_REF=n9.0.2 bash scripts/build-ffmpeg.sh mac-arm64
WHISPER_REF=v1.9.5 bash scripts/self-test.sh mac-arm64 metal
```

Package it:

```bash
cd apps/desktop
npm run pack   # unpacked app in release/; its smoke test: release/mac-arm64/Echo.app/Contents/MacOS/Echo --smoke-test
npm run e2e    # launches the packaged app and checks the first start
npm run dist   # installers in release/
```

The tools for both Mac types (Apple chip and Intel) are built by the **tools** workflow on GitHub (Actions → tools → Run workflow).
After it publishes a release, copy its `SHA256SUMS` into `apps/desktop/tools.lock.json`. The app checks its
downloads against that file.

The manual test checklist before a release is in [`apps/desktop/MANUAL-TESTS.md`](../apps/desktop/MANUAL-TESTS.md).

## Releasing a version

```bash
cd apps/desktop && npm version 0.1.0 --no-git-tag-version
git commit -am "Release 0.1.0" && git tag v0.1.0 && git push personal main v0.1.0
```

The tag starts the **release** workflow. It creates a **draft** release, builds the two Mac installers into it, and
writes the release notes from [`.github/release-notes.md`](../.github/release-notes.md): a download table, the
changes since the last version, and SHA-256 checksums. Open the draft on GitHub, test one installer, replace the
"Highlights" placeholder with a few lines about the release, and publish.

## Android app

A native Kotlin app in `apps/android/`. The UI build plan is [`android/design/design.md`](android/design/design.md).

### Requirements

- **Android Studio** (latest stable). It installs the SDK, the emulator and a JDK.
- **A JDK to run Gradle.** On the command line, use Android Studio's:
  `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`. The code itself is compiled
  with a **JDK 17 toolchain**, which Gradle downloads once if the machine doesn't have one.
- **`apps/android/local.properties`** with `sdk.dir=/Users/<you>/Library/Android/sdk`. Android Studio writes it when
  you open the project; it is not committed. Setting `ANDROID_HOME` works too.
- An emulator: Device Manager → **Pixel 8**, newest stable image, arm64-v8a on Apple chips ([`design.md` §4](android/design/design.md#4-emulator-setup)).

### Build and run

Open `apps/android` in Android Studio and press Run, or:

```bash
cd apps/android
./gradlew test                      # all JVM tests: :core, :services and every :source-* module
./gradlew :source-javguru:test      # one source
./gradlew installDebug              # emulator or connected phone
./gradlew lint assembleDebug
./gradlew test -PliveTests          # also the @Tag("live") checks against the real sites (by hand, not in CI)
```

Starting the emulator without Android Studio:

```bash
~/Library/Android/sdk/emulator/emulator -avd Pixel_8 &
~/Library/Android/sdk/platform-tools/adb devices
```

### Layout

| Module | Folder | What |
|---|---|---|
| `:core` | `core/` | Models, HTTP lanes, cache, back-off, content rules. `testFixtures` has `Fixtures`, the test helper for the shared fixtures. |
| `:source-<id>` | `sources/<id>/` | One per site: `asmrone`, `hasmr`, `jasmr`, `jnet`, `threehentai`, `javdatabase`, `javguru` |
| `:services` | `services/` | `AsmrService`, `MangaService`, `JavService`, `JavStreamService`, `SourceRouter` |
| `:app` | `app/` | The Android app (Compose, Material 3) |
| | `build-logic/` | The `echo.jvm.library` Gradle plugin that every backend module applies |
| | `gradle/libs.versions.toml` | Every library version |

The backend modules are plain Kotlin/JVM with no Android code, so their tests run on the JVM without an emulator.

### Shared fixtures

The Kotlin parser tests read the same recorded pages as the TypeScript tests, from
`web/backend-express/tests/fixtures/`. The path is set once in `apps/android/gradle.properties` (`echoFixtures`) and
reaches tests as the `echo.fixtures` system property:

```kotlin
val html = Fixtures.read("javguru", "post-dldss-575.html")   // testImplementation(testFixtures(project(":core")))
```

When a site changes, re-record the fixture once and fix both versions of the scraper.

## Echo Web (the browser version)

A browser version of Echo that plays only the **asmr.one** extension
([rebelonion/echo-asmr-one](https://github.com/rebelonion/echo-asmr-one)).

- `backend/` – Kotlin + Ktor server. It runs the extension in-process, keeps
  paging state, stores settings and the login, and proxies audio.
- `frontend/` – React + Vite + TypeScript app (Tailwind, TanStack Query, Zustand).

Runs on your Mac, for one user. The server listens on `127.0.0.1` only.

### Requirements

- JDK 17: `brew install openjdk@17`, then `export JAVA_HOME=/opt/homebrew/opt/openjdk@17`
- Gradle: `brew install gradle` (the backend has no wrapper; see below)
- Node.js 20+ and npm

### Run it

```bash
# 1. Build the UI
cd web/frontend
npm install
npm run build

# 2. Start the server (serves the UI on http://127.0.0.1:8080)
cd ../backend
gradle :server:run
```

Open <http://127.0.0.1:8080>.

For UI development with hot reload, run the server as above and, in another
terminal:

```bash
cd web/frontend && npm run dev     # http://127.0.0.1:5173, proxies /api to :8080
```

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | Server port |
| `ECHO_WEB_DATA` | `~/.echo-web` | Settings and saved login |
| `ECHO_WEB_DIST` | auto-detected `web/frontend/dist` | Built UI to serve |
| `ECHO_WEB_API` | `http://127.0.0.1:8080` | Dev-server proxy target (frontend) |

### Accounts

Browsing, search and playback work without an account. To see playlists and
favourites, log in under **Settings → Account** with your asmr.one username and
password. The password is sent only to asmr.one. The login is kept in
`~/.echo-web/user.json`.

### Tests

```bash
cd web/backend && gradle :server:test
cd web/frontend && npm run typecheck
```

### Layout of the backend

| File | Role |
|---|---|
| `asmrone/` | Vendored extension source (see `asmrone/SOURCE.txt`) with `echo-web patch` edits |
| `server/.../Host.kt` | Starts the extension in the same order as the Android app |
| `server/.../Feeds.kt` | Opens feeds and pages them by continuation token |
| `server/.../Routes.kt` | HTTP API (`/api/...`) and the audio/image proxy |
| `server/.../Storage.kt` | Settings file, saved login, expiring id registries, proxy allow-list |
| `server/.../Codec.kt` | JSON for the polymorphic models and the shelves |

### Patches to the extension

Each change is marked `// echo-web patch N` in `asmrone/`:

1. The site-mirror setting is read on each call (it was fixed at startup).
2. Editing a playlist keeps its privacy setting.
3. Empty artist and playlist radios return an empty list instead of crashing.
4. Translation errors keep the original text instead of failing the page.
5. Album share links use the album's id.
6. "In playlist" checks compare work ids, not file hashes.
7. The default translation language index matches the sorted list.
8. The pending-likes map is thread-safe.

### Proxy safety

`/api/proxy` only serves URLs the extension has returned in this session, so
it can't be used as an open proxy.

### Licence

The vendored extension is under the **Unabandon Public License** (GPLv3 plus a
requirement to publish source for derivative works). This is fine for personal
local use. Publishing or hosting this for other people means releasing your
source under the same terms.
