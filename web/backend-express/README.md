# Echo Web backend (Express)

Node.js port of `web/backend` (Kotlin/Ktor). It serves the Echo Web `/api` for the asmr.one
extension, runs the extension in-process, and serves the built web UI from `web/frontend/dist`,
so one process runs the whole app.

The JSON contract matches the Kotlin server, so the same `web/frontend` works with either. See
`SOURCE.md` for provenance, the echo-web patches carried over, and the deliberate differences.

## Requirements

- Node.js 20 or newer (developed on Node 24)

## Run

```bash
cd web/backend-express
npm install
npm run dev            # http://127.0.0.1:8080 with reload
# or
npm run build && npm start
```

The server binds to `127.0.0.1` only. It is for one local user, like the Kotlin server.

It also serves the built web UI. Build it first with `npm run build` in `web/frontend`. Then
`http://127.0.0.1:8080` opens the app. Without a build, `/` shows a short hint and the API still
works. The folder is found automatically, or set `ECHO_WEB_DIST`.

### Environment

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | Port (1–65535). An invalid value stops startup. |
| `ECHO_WEB_DATA` | `~/.echo-web` | Holds `settings.json` and `user.json`. The format matches the Kotlin server, so an existing login carries over. |
| `ECHO_WEB_DIST` | `web/frontend/dist` (auto) | Built UI to serve at `/`. If set but not a directory, the UI is not served and a warning is logged. |
| `LOG_LEVEL` | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent` |
| `WHISPER_SERVER_BIN` | `whisper-server` | whisper.cpp server for AI subtitles (name on `PATH` or a full path) |
| `FFMPEG_BIN` | `ffmpeg` | Used to read and resample audio for AI subtitles |
| `WHISPER_MODEL` | `<data>/models/ggml-large-v3-turbo-q5_0.bin` | Whisper model file |
| `WHISPER_VAD_MODEL` | `<data>/models/ggml-silero-v5.1.2.bin` | Voice-activity model; skipped if the file is missing |
| `JASMR_CRAWL_DELAY_MS` | `10000` | Minimum gap between two japaneseasmr.com page requests (robots.txt asks for 10 s). Stream and image requests are not delayed. |

Do not run this server and the Kotlin server on the same port or data directory at once.

## AI subtitles

Tracks without a subtitle file get subtitles made on this computer with
[whisper.cpp](https://github.com/ggml-org/whisper.cpp), for free and offline. One-time setup:

```bash
brew install whisper-cpp ffmpeg
npm run setup:whisper   # downloads about 550 MB of models into ~/.echo-web/models
```

How it works:

- When `/api/lyrics` finds no subtitle file, the server starts decoding the track with ffmpeg
  (asmr.one's smaller low-quality copy when there is one) and transcribes it **while it downloads**,
  in pieces of about 20–28 s cut at quiet moments, so lines appear within seconds.
- `whisper-server` is started on first use on a free local port and keeps the model loaded.
- The client sends `positionMs` with each poll. The next piece always starts where the listener is,
  so seeking ahead moves the work there; earlier gaps are filled in afterwards.
- One piece runs at a time. The most recently requested track goes first (the playing track is
  polled; the next one in the queue is asked for once). Up to 3 tracks are kept in progress.
- The response's `extras.aiStatus` is `running` (with `aiPhase`, `aiCoveredMs`, `aiCovered` ranges,
  and `aiTotalMs`/`aiProgress` when the length is known), `done`, `failed` or `unavailable` (with
  `aiMessage`). Lines are Japanese from Whisper, translated with the existing translator.
- Finished transcripts are saved in `<data>/ai-subtitles/`, so each track is transcribed once.
- The **Auto-generate AI subtitles** setting turns this off.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Run from source with reload |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled server |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint, including the MVC layering rules |
| `npm test` | Unit and integration tests (no network) |
| `npm run test:live` | Live checks against asmr.one (needs network) |
| `npm run setup:whisper` | Download the Whisper models for AI subtitles |

## Architecture (MVC)

```
routes/        map method and path to a controller (no logic)
controllers/   read the validated request, call one service, pick the status, render a view
services/      application logic; return domain objects, never touch HTTP
views/         pure JSON presenters (domain → wire shape)
schemas/       request bodies and wire → domain parsing (zod)
models/        domain types (Echo common slice), PagedData, Feed, errors, the extension port
extension/     the asmr.one implementation of the port (API client, features, mappers)
repositories/  settings.json and user.json (atomic writes)
stores/        expiring feed and page registries; the issued-URL allow-list
middlewares/   body parsing, error envelope, 405 with Allow, JSON 404, built UI with SPA fallback
lib/           HTTP dispatcher, LRU cache, mutex, atomic file writes, logger
container.ts   composition root: builds every object once
app.ts         Express app (no listen); server.ts starts it
```

Dependency rule (enforced by ESLint `no-restricted-imports`):
`routes → controllers → services → models / stores / repositories / extension`. Views and
middlewares are leaves. Nothing imports upward.

## Endpoints

All paths are under `/api`. Errors use `{ "type": string, "message": string | null }`.

| Method | Path | Notes |
|---|---|---|
| GET | `/home`, `/library` | Opens a feed (`FeedDto`). `/library` is asmr.one only |
| GET | `/search?q=` | Opens a search feed |
| GET | `/quicksearch?q=` | Suggestions; blank `q` gives `[]` |

`/home`, `/search` and `/quicksearch` take `source=asmrone` (default) or `source=jasmr`. Any other value is a 400.
| GET | `/feeds/:id/open?tab=` | Reopen a feed at a tab; 410 if expired |
| GET | `/pages/:id?cont=` | Next page; 410 if expired |
| POST | `/album/load`, `/album/feed`, `/album/tracks` | Body `{item: Album}` |
| POST | `/artist/load`, `/artist/feed` | Body `{item: Artist}` |
| POST | `/playlist/load`, `/playlist/feed`, `/playlist/tracks` | Body `{item: Playlist}` |
| POST | `/track/load`, `/track/media` | Body `{item: Track}`; media lists the stream URLs |
| POST | `/lyrics` | Body `{item: Track}`; `null` when there are none |
| POST | `/radio` | Body `{item, context?}` |
| POST | `/share` | Body `{item}`; returns `{url}` |
| POST | `/like`, `/like/status` | `shouldLike` defaults to true |
| POST | `/playlists/editable`, `/create`, `/delete`, `/edit`, `/privacy`, `/add-tracks`, `/remove-tracks` | Playlist editing |
| GET | `/auth/forms` | Login form definition |
| POST | `/auth/login`, `/auth/logout` | Login saves `user.json` |
| GET | `/auth/me` | Current user or `null` |
| GET | `/settings` | Settings with resolved values |
| PUT | `/settings/:key` | Body `{value}`; `null` removes the value |
| GET | `/proxy?url=` | Streams an issued URL; forwards `Range`; 403 if not issued |

An unknown `/api` path returns `404 {"type":"not_found","message":null}`. A known path with a method it doesn't support returns `405 {"type":"method_not_allowed","message":null}` with an `Allow` header.

## Sources

Four sources run side by side. Each source's ids carry its prefix, and asmr.one owns every id without one:

| Source | Prefix | Work (album) | Track | Artist |
|---|---|---|---|---|
| asmr.one | (none) | `<id>` | `<hash>` | `<id>` |
| japaneseasmr.com | `jasmr:` | `jasmr:<id>` | `jasmr:<id>#<n>` (offset in the work's HLS file) | `jasmr:cat:<slug>` |
| jasmr.net | `jnet:` | `jnet:<RJ code>` | `jnet:<RJ code>#<n>` (offset in the work's one audio file) | `jnet:circle:<name>` |
| hentaiasmr.moe | `hasmr:` | `hasmr:<rj code, lowercase>` | `hasmr:<rj code>#<n>` (one MP3 each) | `hasmr:cat:<slug>`, `hasmr:actor:<slug>` |

- **japaneseasmr.com** has no public API, so its pages are read as HTML. A Cloudflare bot check makes it answer 503 and it is never bypassed. Requests are spaced by `JASMR_CRAWL_DELAY_MS`.
- **jasmr.net** uses its JSON API (`/api/v1/…`). Requests are spaced by `LIMITS.jnetRequestGapMs` (1 s), responses are kept for 30 minutes, and a block or bot-check answer pauses requests for 15 minutes, doubling on repeats. Its audio is one file per work; a work's tracks take their offsets from the track lengths, and if those don't add up to the file's length the work plays as one track.
- **hentaiasmr.moe** is WordPress HTML. Only catalogue addresses are requested (listings, works, tags, actors, search): anything else is refused before any request is made, including the site's hidden trap pages. Requests are spaced by `LIMITS.hasmrRequestGapMs` (3 s). Audio comes from the site's own audio host only, with the `Referer` the player sends.
- Every request identifies itself as `EchoASMR/1.0`. There is no browser impersonation and no bypass of any block page: a block only pauses requests.
- Login, library, playlists, likes, radio and the sites' own lyrics are asmr.one or unsupported (`not_supported`, 501) for these sources. AI subtitles are made locally for all of them.
- The translation switch and language (`jasmrTranslateTitles`, `translationLanguage`) apply to every non-asmr.one source.

## Serving the UI

When a build exists, `GET` and `HEAD` requests outside `/api` get the files in `frontend/dist`.
Any other path gets `index.html`, so client-side routes such as `/work/123` load. Hashed files under
`/assets/` are cached for a year (`immutable`). `index.html` is `no-cache`. Other methods outside
`/api` get a plain 404. The UI is only served after the `/api` routes, so API paths never return HTML.

## Tests

- `tests/unit`: stores, repositories, paging, translation chunking, lyric parsers, media tree,
  wire parsing and view shapes.
- `tests/integration`: every route through supertest against a fake extension; the japaneseasmr routes against recorded pages; the built UI and its fallback; the proxy
  against a real local upstream (Range, redirects, errors); the asmr.one extension against
  undici `MockAgent` fixtures.
- `tests/live`: real asmr.one and Google translate, only with `LIVE=1`.

Run `npm test` for the offline suite.
