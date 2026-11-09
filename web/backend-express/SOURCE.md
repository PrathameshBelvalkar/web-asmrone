# Source and provenance

This package is a Node/Express port of `web/backend` (Kotlin/Ktor). It contains:

1. **HTTP server**: rewritten from `web/backend/server/src/main/kotlin/echo/web/`.
2. **asmr.one extension**: a TypeScript port of the vendored Kotlin extension in
   `web/backend/asmrone/`. Upstream: <https://github.com/rebelonion/echo-asmr-one>,
   commit `e0f56a9c1dc22ce668cf5a6a6aacc2bcbe611202` (the commit recorded in
   `web/backend/asmrone/SOURCE.txt`).
3. **Echo `common` slice**: models and client types ported from the Kotlin `common` module
   (`common/src/commonMain/kotlin/dev/brahmkshatriya/echo/common`).

The extension is under the Unabandon Public License (see `LICENSE.md`). Releasing this port
means publishing its source under the same terms.

## echo-web patches carried over

The Kotlin tree marks changes with `// echo-web patch N`. Each is kept here:

| # | Change | Where in this package |
|---|---|---|
| 1 | Mirror setting read on every call | `extension/asmrone/api/asmr-api.client.ts` (`baseUrl()`) |
| 2 | Metadata edit keeps the playlist's privacy | `extension/asmrone/features/playlist.feature.ts` |
| 3 | Empty artist and playlist radios return an empty list | `extension/asmrone/features/radio.feature.ts` |
| 4 | Translation errors keep the original text | `translation/translate-list.ts`, `api/asmr-api.client.ts` |
| 5 | Album share links use the album id | `features/account.feature.ts` (`onShare`) |
| 6 | "In playlist" compares work ids | `features/playlist.feature.ts` (`listEditablePlaylists`) |
| 7 | Default translation language is English in the displayed list | `settings-definitions.ts` |
| 8 | Pending likes are a concurrent-safe map | `mappers/works.ts` (`PendingLikes`) |
| 9 | A failing home shelf is skipped | `features/context.ts` (`shelfOrNull`) |
| 10 | Slow shelves time out after 4 s; HTTP errors are not retried | `features/context.ts`, `api/asmr-api.client.ts` |

## Deliberate differences from the Kotlin server

These are changes in behaviour, all made on purpose.

- **Playlist metadata edits work.** The Kotlin client could not send the nested `data` object,
  so edits and privacy changes never reached asmr.one. The body is now sent correctly.
- **Subtitle cue settings are accepted.** `00:01.000 --> 00:02.000 align:start` used to fail.
- **Unknown routes and wrong methods.** An unknown path returns a JSON 404. A known path with an
  unsupported method returns 405 with an `Allow` header, and the body is the JSON envelope. Kotlin
  returns an empty body for both, and for a `DELETE` on `/api/settings/{key}` it returns 404 where
  Node returns 405.
- **Dates with a `T` separator are accepted.**
- **Home "more" pages start at page 2.** The Kotlin version repeated page 1.
- **Caches are keyed by mirror and language.** The Kotlin caches were keyed by work id only, so
  changing the language could serve stale titles.
- **Default mirror is `asmr-100` everywhere.** The Kotlin fallback was `asmr-200`, which did not
  match the settings default.
- **A cached work tree keeps its folder ids.** The Kotlin deep copy reset them.
- **Malformed media items are a 400.** The Kotlin server returned a 500.
- **Invalid `PORT` stops startup.** The Kotlin server silently used 8080.
- **Upstream requests stop when the client disconnects.** This applies to the audio proxy.
- **`user.json` and `settings.json` are written with mode 0600.**
- **Recursive audio listing is the same algorithm.** An earlier review suggested Kotlin's
  `getAllAudioFiles(recursively = true)` duplicates deep files. Tracing it by hand found no
  duplicates, so the port keeps the Kotlin algorithm unchanged. (Not run against the Kotlin
  server.)

Known and kept as in Kotlin: the asmr.one bearer token is sent with subtitle downloads, even when
the download host is not asmr.one. Review this before relying on the port with other hosts.

## Matches Kotlin, with a caveat

- **Release dates keep the current time of day, as Kotlin does.** `Date(year, month, day)` in Kotlin
  replaces the date fields and keeps the time of day of the request. The port does the same, so the
  value changes with each request on both servers. Compare release dates by local day, not by
  milliseconds.
