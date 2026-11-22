package app.echo.data.repository

import app.echo.data.db.EchoDatabase
import app.echo.data.db.LikedTrackEntity
import app.echo.data.db.ListenHistoryEntity
import app.echo.data.db.PlaylistEntity
import app.echo.data.db.ReadHistoryEntity
import app.echo.data.db.SearchHistoryEntity
import app.echo.data.db.TrackFields
import app.echo.data.db.WatchHistoryEntity
import app.echo.data.db.WatchKind
import app.echo.data.model.ContinueItem
import app.echo.data.model.Playlist
import app.echo.data.model.PlaylistPrivacy
import app.echo.data.model.Section
import app.echo.data.model.Track
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import app.echo.data.db.PlaylistPrivacy as DbPrivacy

/**
 * History and "continue" lists across sections (0.2 Library, 0.3 History, the Continue shelves, 3.12, H.9),
 * plus search history. Backed by Room.
 */
interface LibraryRepository {
    /** Unfinished items of every section, newest first (0.2 "Continue"). */
    val continueAll: Flow<List<ContinueItem>>
    fun continueIn(section: Section): Flow<List<ContinueItem>>
    fun history(section: Section): Flow<List<ContinueItem>>

    suspend fun clearHistory(section: Section)
    suspend fun removeWatched(section: Section, id: String)

    fun recentSearches(section: Section): Flow<List<String>>
    suspend fun addSearch(section: Section, query: String)
    suspend fun removeSearch(section: Section, query: String)
}

/** Playlists and liked tracks (1.7, 1.12, P.1). */
interface PlaylistRepository {
    val playlists: Flow<List<Playlist>>
    val liked: Flow<List<Track>>
    fun tracks(playlistId: Long): Flow<List<Track>>
    fun isLiked(trackId: String): Flow<Boolean>

    suspend fun create(name: String, privacy: PlaylistPrivacy): Long
    suspend fun rename(id: Long, name: String, privacy: PlaylistPrivacy)
    suspend fun delete(id: Long)
    suspend fun add(playlistId: Long, track: Track)
    suspend fun move(playlistId: Long, from: Int, to: Int)
    suspend fun remove(playlistId: Long, position: Int)
    suspend fun setLiked(track: Track, liked: Boolean)
}

class RoomLibraryRepository(private val db: EchoDatabase, private val now: () -> Long = System::currentTimeMillis) : LibraryRepository {
    private val h = db.history()

    override val continueAll: Flow<List<ContinueItem>> =
        combine(h.continueListening(), h.continueReading(), h.continueWatching()) { l, r, w ->
            (l.map { it.toItem() } + r.map { it.toItem() } + w.map { it.toItem() }).sortedByDescending { it.updatedAt }
        }

    override fun continueIn(section: Section): Flow<List<ContinueItem>> = when (section) {
        Section.ASMR -> h.continueListening().map { list -> list.map { it.toItem() } }
        Section.MANGA -> h.continueReading().map { list -> list.map { it.toItem() } }
        Section.JAV, Section.HENTAI -> h.continueWatching().map { list -> list.filter { it.kind == section.kind }.map { it.toItem() } }
    }

    override fun history(section: Section): Flow<List<ContinueItem>> = when (section) {
        Section.ASMR -> h.listen().map { list -> list.map { it.toItem() } }
        Section.MANGA -> h.read().map { list -> list.map { it.toItem() } }
        Section.JAV, Section.HENTAI -> h.watch(section.kind).map { list -> list.map { it.toItem() } }
    }

    override suspend fun clearHistory(section: Section) = when (section) {
        Section.ASMR -> h.clearListen()
        Section.MANGA -> h.clearRead()
        Section.JAV, Section.HENTAI -> h.clearWatch(section.kind)
    }

    override suspend fun removeWatched(section: Section, id: String) = h.removeWatch(section.kind, id)

    override fun recentSearches(section: Section): Flow<List<String>> =
        db.searchHistory().recent(section.name).map { list -> list.map { it.query } }

    override suspend fun addSearch(section: Section, query: String) {
        if (query.isNotBlank()) db.searchHistory().add(SearchHistoryEntity(section.name, query.trim(), now()))
    }

    override suspend fun removeSearch(section: Section, query: String) = db.searchHistory().remove(section.name, query)

    private val Section.kind get() = if (this == Section.HENTAI) WatchKind.HENTAI else WatchKind.JAV
}

class RoomPlaylistRepository(private val db: EchoDatabase, private val now: () -> Long = System::currentTimeMillis) : PlaylistRepository {
    private val dao = db.playlists()

    override val playlists: Flow<List<Playlist>> = dao.playlists().map { list ->
        list.map { Playlist(it.id, it.name, it.privacy.toModel(), it.trackCount) }
    }
    override val liked: Flow<List<Track>> = dao.liked().map { list -> list.map { it.track.toTrack() } }
    override fun tracks(playlistId: Long): Flow<List<Track>> = dao.tracks(playlistId).map { list -> list.map { it.track.toTrack() } }
    override fun isLiked(trackId: String): Flow<Boolean> = dao.isLiked(trackId)

    override suspend fun create(name: String, privacy: PlaylistPrivacy): Long =
        dao.insert(PlaylistEntity(name = name, privacy = privacy.toDb(), createdAt = now()))
    override suspend fun rename(id: Long, name: String, privacy: PlaylistPrivacy) = dao.update(id, name, privacy.toDb())
    override suspend fun delete(id: Long) = dao.delete(id)
    override suspend fun add(playlistId: Long, track: Track) = dao.add(playlistId, track.toFields())
    override suspend fun move(playlistId: Long, from: Int, to: Int) = dao.move(playlistId, from, to)
    override suspend fun remove(playlistId: Long, position: Int) = dao.remove(playlistId, position)
    override suspend fun setLiked(track: Track, liked: Boolean) {
        if (liked) dao.like(LikedTrackEntity(track.id, track.toFields(), now())) else dao.unlike(track.id)
    }
}

private fun ListenHistoryEntity.toItem() = ContinueItem(
    section = Section.ASMR, id = workId, title = workTitle, subtitle = "$trackTitle · $artist", coverUrl = coverUrl,
    positionMs = positionMs, durationMs = durationMs, updatedAt = updatedAt, finished = finished,
)

private fun ReadHistoryEntity.toItem() = ContinueItem(
    section = Section.MANGA, id = galleryId, title = title, subtitle = artist, coverUrl = coverUrl,
    page = page, pageCount = pageCount, updatedAt = updatedAt, finished = finished,
)

private fun WatchHistoryEntity.toItem() = ContinueItem(
    section = if (kind == WatchKind.HENTAI) Section.HENTAI else Section.JAV, id = id, title = title, code = code,
    subtitle = studio, coverUrl = coverUrl, positionMs = positionMs, durationMs = durationMs, updatedAt = updatedAt, finished = finished,
)

internal fun TrackFields.toTrack() = Track(trackId, workId, sourceId, title, artist, coverUrl, durationMs)
internal fun Track.toFields() = TrackFields(id, workId, sourceId, title, artist, coverUrl, durationMs)
private fun DbPrivacy.toModel() = if (this == DbPrivacy.PUBLIC) PlaylistPrivacy.PUBLIC else PlaylistPrivacy.PRIVATE
private fun PlaylistPrivacy.toDb() = if (this == PlaylistPrivacy.PUBLIC) DbPrivacy.PUBLIC else DbPrivacy.PRIVATE
