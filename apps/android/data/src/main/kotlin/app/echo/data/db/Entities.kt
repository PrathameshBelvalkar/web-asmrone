package app.echo.data.db

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/* Room tables, design.md §9.3. Times are epoch millis. */

/** A track listened to (one row per work: the last track played). */
@Entity(tableName = "history_listen")
data class ListenHistoryEntity(
    @PrimaryKey val workId: String,
    val sourceId: String,
    val trackId: String,
    val workTitle: String,
    val trackTitle: String,
    val artist: String,
    val coverUrl: String?,
    val positionMs: Long,
    val durationMs: Long,
    val updatedAt: Long,
    val finished: Boolean,
)

/** A gallery read. */
@Entity(tableName = "history_read")
data class ReadHistoryEntity(
    @PrimaryKey val galleryId: String,
    val sourceId: String,
    val title: String,
    val artist: String?,
    val coverUrl: String?,
    val page: Int,
    val pageCount: Int,
    val updatedAt: Long,
    val finished: Boolean,
)

enum class WatchKind { JAV, HENTAI }

/** A movie (JAV) or episode (Hentai) watched. */
@Entity(tableName = "history_watch", primaryKeys = ["kind", "id"])
data class WatchHistoryEntity(
    val kind: WatchKind,
    val id: String,
    val code: String?,
    val title: String,
    val studio: String?,
    val coverUrl: String?,
    val episode: Int?,
    val positionMs: Long,
    val durationMs: Long,
    val updatedAt: Long,
    val finished: Boolean,
)

enum class PlaylistPrivacy { PRIVATE, PUBLIC }

@Entity(tableName = "playlist")
data class PlaylistEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val privacy: PlaylistPrivacy,
    val createdAt: Long,
)

/** The track fields stored wherever a track is saved (playlist, liked, queue). */
data class TrackFields(
    val trackId: String,
    val workId: String,
    val sourceId: String,
    val title: String,
    val artist: String,
    val coverUrl: String?,
    val durationMs: Long,
)

@Entity(
    tableName = "playlist_track",
    primaryKeys = ["playlistId", "position"],
    foreignKeys = [ForeignKey(PlaylistEntity::class, ["id"], ["playlistId"], onDelete = ForeignKey.CASCADE)],
    indices = [Index("playlistId")],
)
data class PlaylistTrackEntity(
    val playlistId: Long,
    val position: Int,
    @androidx.room.Embedded val track: TrackFields,
)

@Entity(tableName = "liked_track")
data class LikedTrackEntity(
    @PrimaryKey val trackId: String,
    @androidx.room.Embedded(prefix = "t_") val track: TrackFields,
    val likedAt: Long,
)

@Entity(tableName = "queue_item")
data class QueueItemEntity(
    @PrimaryKey val position: Int,
    @androidx.room.Embedded val track: TrackFields,
)

/** Single row (id = 0): where playback is in the queue. */
@Entity(tableName = "queue_state")
data class QueueStateEntity(
    @PrimaryKey val id: Int = 0,
    val currentIndex: Int,
    val positionMs: Long,
    val playingFrom: String,
)

/** 2.8 "For this gallery" overrides of the reader defaults. Null = use the default. */
@Entity(tableName = "reader_prefs")
data class ReaderPrefsEntity(
    @PrimaryKey val galleryId: String,
    val mode: String?,
    val tapZones: String?,
    val scaleType: String?,
    val cropBorders: Boolean?,
    val dualPage: Boolean?,
)

@Entity(tableName = "search_history", primaryKeys = ["section", "query"])
data class SearchHistoryEntity(
    val section: String,
    val query: String,
    val searchedAt: Long,
)
