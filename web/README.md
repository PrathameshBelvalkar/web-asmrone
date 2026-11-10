# Echo Web (asmr.one)

A browser version of Echo that plays only the **asmr.one** extension
([rebelonion/echo-asmr-one](https://github.com/rebelonion/echo-asmr-one)).

- `backend-express/` – Node.js + Express server, the default. It runs the extension in-process,
  keeps paging state, stores settings and the login, proxies audio, and serves the built UI.
- `backend/` – Kotlin + Ktor server. It does the same job and is kept as an alternative.
- `frontend/` – React + Vite + TypeScript app (Tailwind, TanStack Query, Zustand).

Runs on your Mac, for one user. Both servers listen on `127.0.0.1` only.

## Requirements

- Node.js 20+ and npm
- For the Kotlin server only: JDK 17 (`brew install openjdk@17`, then
  `export JAVA_HOME=/opt/homebrew/opt/openjdk@17`) and Gradle (`brew install gradle`; the
  backend has no wrapper)

## Run it

```bash
# 1. Build the UI
cd web/frontend
npm install
npm run build

# 2. Start the server (serves the UI on http://127.0.0.1:8080)
cd ../backend-express
npm install
npm run dev        # or: npm run build && npm start
```

Open <http://127.0.0.1:8080>.

For UI development with hot reload, keep the server running and, in another terminal:

```bash
cd web/frontend && npm run dev     # http://127.0.0.1:5173, proxies /api to :8080
```

### Kotlin server instead

```bash
cd web/backend
gradle :server:run
```

It serves the same API and UI on the same port. Don't run it and the Express server at the
same time.

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | Server port |
| `ECHO_WEB_DATA` | `~/.echo-web` | Settings and saved login |
| `ECHO_WEB_DIST` | auto-detected `web/frontend/dist` | Built UI to serve (both servers) |
| `LOG_LEVEL` | `info` | Express server log level |
| `ECHO_WEB_API` | `http://127.0.0.1:8080` | Dev-server proxy target (frontend) |
| `JASMR_CRAWL_DELAY_MS` | `10000` | Express only: gap between japaneseasmr.com page requests |

## Sources

Pick the source in **Settings → Music source**: **asmr.one** (with accounts, playlists and likes) or **Japanese ASMR** (japaneseasmr.com: browse, search of loaded listings, and playback of its works by chapter). The choice is remembered in the browser. Japanese ASMR has no accounts, library or radio. Its works play through the server, which fetches its HLS streams with the site's `Referer`. Use only with a licence that covers the works you play.

## Accounts

Browsing, search and playback work without an account. To see playlists and
favourites, log in under **Settings → Account** with your asmr.one username and
password. The password is sent only to asmr.one. The login is kept in
`~/.echo-web/user.json`.

## Tests

```bash
cd web/backend-express && npm test
cd web/backend && gradle :server:test
cd web/frontend && npm run typecheck
```

## Layout of the Kotlin backend

The Express server's layout is in [backend-express/README.md](backend-express/README.md).

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
