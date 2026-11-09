# Echo Web (asmr.one)

A browser version of Echo that plays only the **asmr.one** extension
([rebelonion/echo-asmr-one](https://github.com/rebelonion/echo-asmr-one)).

- `backend/` – Kotlin + Ktor server. It runs the extension in-process, keeps
  paging state, stores settings and the login, and proxies audio.
- `frontend/` – React + Vite + TypeScript app (Tailwind, TanStack Query, Zustand).

Runs on your Mac, for one user. The server listens on `127.0.0.1` only.

## Requirements

- JDK 17: `brew install openjdk@17`, then `export JAVA_HOME=/opt/homebrew/opt/openjdk@17`
- Gradle: `brew install gradle` (the backend has no wrapper; see below)
- Node.js 20+ and npm

## Run it

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

## Accounts

Browsing, search and playback work without an account. To see playlists and
favourites, log in under **Settings → Account** with your asmr.one username and
password. The password is sent only to asmr.one. The login is kept in
`~/.echo-web/user.json`.

## Tests

```bash
cd web/backend && gradle :server:test
cd web/frontend && npm run typecheck
```

## Layout of the backend

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

## Licence

The vendored extension is under the **Unabandon Public License** (GPLv3 plus a
requirement to publish source for derivative works). This is fine for personal
local use. Publishing or hosting this for other people means releasing your
source under the same terms.
