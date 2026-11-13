# Echo

Echo plays asmr.one and Japanese ASMR tracks on your Mac. For tracks that have no subtitles,
Echo can write them itself with AI: it runs on your computer, it is free, and nothing is uploaded.

## Download

| Computer | File |
|---|---|
| Mac with an Apple chip (M1 or newer) | `Echo-<version>-mac-arm64.dmg` |
| Mac with an Intel chip | `Echo-<version>-mac-x64.dmg` |

Get them from the [latest release](https://github.com/PrathameshBelvalkar/web-asmrone/releases/latest).

### The first time you open it

The app is not signed yet, so macOS asks you once. Open the `.dmg`, drag Echo to Applications and
open it. If macOS blocks it, go to System Settings → Privacy & Security and click **Open Anyway**. As a
fallback, run `xattr -cr /Applications/Echo.app` in Terminal.

## AI subtitles

Open **Settings** and turn on **AI subtitles**. Echo then downloads what it needs by itself (190 to 550 MB,
once) and tells you when it is ready. You can:

- **pause** a download and resume it later, or **cancel** it (this deletes the partial file);
- see the models you have, pick one, run a speed test, and **delete** a model you no longer need.

Deleting the model in use switches to another downloaded model. If it was the last one, AI subtitles are turned off.

## Where your data is

Everything is in `~/Library/Application Support/Echo`. Settings, your login, the saved queue, subtitles and the models are in that folder. The log is in its
`logs` folder (**Help → Open log folder**). Your data stays on your computer.

## Updates

Echo tells you when a new version is out and opens the download page. **Help → Check for updates…**
checks now.

## Licence

Echo is released under the Unabandon Public License (see `LICENSE.md`). The bundled FFmpeg is LGPL 2.1; its
licence texts are in the app (**Help → Licences**). The source is this repository.

## For developers

### Desktop app

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

The manual test checklist before a release is in [`apps/desktop/MANUAL-TESTS.md`](apps/desktop/MANUAL-TESTS.md).

### Releasing a version

```bash
cd apps/desktop && npm version 0.1.0 --no-git-tag-version
git commit -am "Release 0.1.0" && git tag v0.1.0 && git push personal main v0.1.0
```

The tag starts the **release** workflow. It builds the two Mac installers and creates a **draft** release. Open the
draft on GitHub, test one installer, edit the notes and publish.

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
