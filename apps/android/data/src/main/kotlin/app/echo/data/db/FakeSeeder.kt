package app.echo.data.db

import androidx.room.withTransaction
import kotlinx.coroutines.flow.first

/**
 * Fills an empty database with the rows shown in Figma (0.2 Library, 0.3 History, 1.12 Playlists, 3.12 JAV
 * library), so Library and History look like Figma on a fresh debug install. Does nothing when any history exists.
 */
class FakeSeeder(private val db: EchoDatabase, private val now: () -> Long = System::currentTimeMillis) {

    suspend fun seedIfEmpty() {
        val h = db.history()
        if (h.listen().first().isNotEmpty() || h.read().first().isNotEmpty() || h.watchAll().first().isNotEmpty()) return
        val t = now()
        val min = 60_000L
        val day = 24 * 60 * min
        db.withTransaction {
            // 0.2 Continue / Listening, 1.1 Continue listening
            h.upsertListen(listen("w1", "Whispered bedtime story", "01 · Opening, whispered", "Circle Aoi", 18 * min, 60 * min, t - 5 * min))
            h.upsertListen(listen("w2", "Rain on a tin roof", "Rain on a tin roof", "Studio Komorebi", 20 * min, 90 * min, t - 2 * 60 * min))
            h.upsertListen(listen("w3", "Soft tapping", "Soft tapping", "Circle Aoi", 30 * min, 38 * min, t - 6 * 60 * min))
            h.upsertListen(listen("w4", "Ear cleaning (left → right)", "02 · Ear cleaning (left → right)", "Circle Aoi", 7 * min + 42_000, 18 * min + 40_000, t - day))
            h.upsertListen(listen("w5", "Rain collection", "Rain on a tin roof", "Studio Komorebi", 40 * min, 40 * min, t - 2 * day, finished = true))
            // 0.2 Reading, 0.3 Manga, 2.1 Continue reading
            h.upsertRead(read("g1", "Gallery title placeholder", 34, 52, t - 10 * min))
            h.upsertRead(read("g2", "Another gallery title", 40, 40, t - 3 * 60 * min, finished = true))
            h.upsertRead(read("g3", "Gallery title placeholder", 12, 40, t - day - 60 * min))
            h.upsertRead(read("g4", "Gallery title placeholder", 5, 24, t - 5 * day))
            h.upsertRead(read("g5", "Gallery title placeholder", 24, 24, t - 5 * day - 60 * min, finished = true))
            // 0.2 Watching, 3.12 JAV library, H.9
            (1..5).forEach { i ->
                h.upsertWatch(
                    WatchHistoryEntity(
                        kind = WatchKind.JAV, id = "m$i", code = "ABC-10$i", title = "Movie title placeholder", studio = "Example Studio",
                        coverUrl = null, episode = null, positionMs = (10 + 7 * i) * min + i * 1000L, durationMs = 120 * min,
                        updatedAt = t - i * 30 * min, finished = false,
                    ),
                )
            }
            h.upsertWatch(
                WatchHistoryEntity(
                    kind = WatchKind.HENTAI, id = "h1", code = null, title = "Title placeholder", studio = "Studio Name",
                    coverUrl = null, episode = 1, positionMs = 10 * min, durationMs = 23 * min + 1000, updatedAt = t - 4 * 60 * min,
                    finished = false,
                ),
            )
            // 1.12 Playlists
            val p = db.playlists()
            listOf(
                Triple("Sleep queue", PlaylistPrivacy.PRIVATE, 18), Triple("Rain collection", PlaylistPrivacy.PUBLIC, 42),
                Triple("Morning wind-down", PlaylistPrivacy.PRIVATE, 9), Triple("Ear cleaning best of", PlaylistPrivacy.PUBLIC, 27),
                Triple("For the train", PlaylistPrivacy.PRIVATE, 6),
            ).forEachIndexed { i, (name, privacy, count) ->
                val id = p.insert(PlaylistEntity(name = name, privacy = privacy, createdAt = t - (10 - i) * day))
                p.insertTracks(
                    (0 until count).map { n ->
                        PlaylistTrackEntity(id, n, track("t$i-$n", "w${n % 5 + 1}", "%02d · Track placeholder".format(n + 1)))
                    },
                )
            }
            p.like(LikedTrackEntity("t-liked", track("t-liked", "w4", "02 · Ear cleaning (left → right)"), t))
            // 1.2 RECENT
            listOf("Circle Aoi", "ear cleaning binaural", "rain on window").forEachIndexed { i, q ->
                db.searchHistory().add(SearchHistoryEntity("ASMR", q, t - (3 - i) * min))
            }
        }
    }

    private fun listen(
        workId: String, work: String, track: String, artist: String, pos: Long, dur: Long, at: Long, finished: Boolean = false,
    ) = ListenHistoryEntity(workId, "asmrone", "$workId-t", work, track, artist, null, pos, dur, at, finished)

    private fun read(id: String, title: String, page: Int, count: Int, at: Long, finished: Boolean = false) =
        ReadHistoryEntity(id, "threehentai", title, "Artist Name", null, page, count, at, finished)

    private fun track(id: String, workId: String, title: String) =
        TrackFields(id, workId, "asmrone", title, "Circle Aoi", null, 12 * 60_000L)
}
