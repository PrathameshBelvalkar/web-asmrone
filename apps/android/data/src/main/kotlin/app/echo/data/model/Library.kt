package app.echo.data.model

/** Something to pick up again, from any section (0.2 "Continue", the Continue shelves). */
data class ContinueItem(
    val section: Section,
    val id: String,
    val title: String,
    /** "42 min left", "p. 34 / 52", "Resume 42:07" — formatted by the UI from the fields below. */
    val positionMs: Long = 0,
    val durationMs: Long = 0,
    val page: Int = 0,
    val pageCount: Int = 0,
    val code: String? = null,
    val subtitle: String? = null,
    val coverUrl: String? = null,
    val updatedAt: Long,
    val finished: Boolean,
    /** ASMR only: the last track listened to, so 0.2 and 0.3 can play it (1.8). */
    val track: Track? = null,
    /** Hentai only: the episode being watched (H.9 "EPISODE 2"). */
    val episode: Int? = null,
) {
    /** 0…1 for progress bars. */
    val progress: Float
        get() = when {
            pageCount > 0 -> page.toFloat() / pageCount
            durationMs > 0 -> positionMs.toFloat() / durationMs
            else -> 0f
        }.coerceIn(0f, 1f)
}

/** A saved track: in a playlist, liked, or queued. */
data class Track(
    val id: String,
    val workId: String,
    val sourceId: String,
    val title: String,
    val artist: String,
    val coverUrl: String? = null,
    val durationMs: Long,
)

enum class PlaylistPrivacy { PRIVATE, PUBLIC }

data class Playlist(val id: Long, val name: String, val privacy: PlaylistPrivacy, val trackCount: Int)
