package app.echo.data.repository

import app.echo.data.model.HentaiTitle
import app.echo.data.model.Movie
import app.echo.data.db.EchoDatabase
import app.echo.data.db.LikedTrackEntity
import app.echo.data.db.LikedWorkEntity
import app.echo.data.db.ListenHistoryEntity
import app.echo.data.db.PlaylistEntity
import app.echo.data.db.ReadHistoryEntity
import app.echo.data.db.SearchHistoryEntity
import app.echo.data.db.TrackFields
import app.echo.data.db.WatchHistoryEntity
import app.echo.data.db.WatchKind
import app.echo.data.model.ContinueItem
import app.echo.data.model.Gallery
import app.echo.data.model.Sources
import app.echo.data.model.Playlist
import app.echo.data.model.PlaylistPrivacy
import app.echo.data.model.Section
import app.echo.data.model.Track
import app.echo.data.model.Work
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
    /** Removes one row from [section]'s history (the X on a 0.3 row). */
    suspend fun removeHistory(section: Section, id: String)

    /** Records the page a gallery is on (2.7 turns, 2.10 when finished). */
    suspend fun saveReadProgress(gallery: Gallery, page: Int, finished: Boolean)

    /** Records where a JAV movie is (3.7 Theater); 3.12 and 0.2 read it back. */
    suspend fun saveWatchProgress(movie: Movie, positionMs: Long, durationMs: Long, finished: Boolean)

    /** Records where a Hentai episode is (H.11 Theater); H.9, H.7 and 0.2 read it back. */
    suspend fun saveEpisodeProgress(title: HentaiTitle, episode: Int, positionMs: Long, durationMs: Long, finished: Boolean)

    fun recentSearches(section: Section): Flow<List<String>>
    suspend fun addSearch(section: Section, query: String)
    suspend fun removeSearch(section: Section, query: String)
}

/** Playlists and liked tracks (1.7, 1.12, P.1). */
interface PlaylistRepository {
    val playlists: Flow<List<Playlist>>
    val liked: Flow<List<Track>>
    /** 1.12 Favourites: liked works. */
    val likedWorks: Flow<List<Work>>
    fun tracks(playlistId: Long): Flow<List<Track>>
    fun isLiked(trackId: String): Flow<Boolean>
    fun isWorkLiked(workId: String): Flow<Boolean>

    suspend fun create(name: String, privacy: PlaylistPrivacy): Long
    suspend fun rename(id: Long, name: String, privacy: PlaylistPrivacy)
    suspend fun delete(id: Long)
    suspend fun add(playlistId: Long, track: Track)
    suspend fun move(playlistId: Long, from: Int, to: Int)
    suspend fun remove(playlistId: Long, position: Int)
    suspend fun setLiked(track: Track, liked: Boolean)
    suspend fun setWorkLiked(work: Work, liked: Boolean)
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

    override suspend fun saveWatchProgress(movie: Movie, positionMs: Long, durationMs: Long, finished: Boolean) {
        h.upsertWatch(
            WatchHistoryEntity(
                kind = WatchKind.JAV, id = movie.id, code = movie.code, title = movie.title, studio = movie.studio,
                coverUrl = movie.coverUrl, episode = null, positionMs = positionMs, durationMs = durationMs,
                updatedAt = now(), finished = finished,
            ),
        )
    }

    override suspend fun saveEpisodeProgress(title: HentaiTitle, episode: Int, positionMs: Long, durationMs: Long, finished: Boolean) {
        h.upsertWatch(
            WatchHistoryEntity(
                kind = WatchKind.HENTAI, id = title.id, code = null, title = title.title, studio = title.studio,
                coverUrl = title.coverUrl, episode = episode, positionMs = positionMs, durationMs = durationMs,
                updatedAt = now(), finished = finished,
            ),
        )
    }

    override suspend fun saveReadProgress(gallery: Gallery, page: Int, finished: Boolean) {
        h.upsertRead(
            ReadHistoryEntity(
                galleryId = gallery.id, sourceId = Sources.threeHentai.id, title = gallery.title, artist = gallery.artist,
                coverUrl = gallery.coverUrl, page = page, pageCount = gallery.pageCount, updatedAt = now(), finished = finished,
            ),
        )
    }

    override suspend fun removeHistory(section: Section, id: String) = when (section) {
        Section.ASMR -> h.removeListen(id)
        Section.MANGA -> h.removeRead(id)
        Section.JAV, Section.HENTAI -> h.removeWatch(section.kind, id)
    }

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
    override val likedWorks: Flow<List<Work>> = dao.likedWorks().map { list ->
        list.map { Work(id = it.workId, title = it.title, circle = it.circle, coverUrl = it.coverUrl) }
    }
    override fun tracks(playlistId: Long): Flow<List<Track>> = dao.tracks(playlistId).map { list -> list.map { it.track.toTrack() } }
    override fun isLiked(trackId: String): Flow<Boolean> = dao.isLiked(trackId)
    override fun isWorkLiked(workId: String): Flow<Boolean> = dao.isWorkLiked(workId)

    override suspend fun create(name: String, privacy: PlaylistPrivacy): Long =
        dao.insert(PlaylistEntity(name = name, privacy = privacy.toDb(), createdAt = now()))
    override suspend fun rename(id: Long, name: String, privacy: PlaylistPrivacy) = dao.update(id, name, privacy.toDb())
    override suspend fun delete(id: Long) = dao.delete(id)
    override suspend fun add(playlistId: Long, track: Track) = dao.add(playlistId, track.toFields())
    override suspend fun move(playlistId: Long, from: Int, to: Int) = dao.move(playlistId, from, to)
    override suspend fun remove(playlistId: Long, position: Int) = dao.remove(playlistId, position)
    override suspend fun setWorkLiked(work: Work, liked: Boolean) {
        if (liked) dao.likeWork(LikedWorkEntity(work.id, work.title, work.circle, work.coverUrl, now())) else dao.unlikeWork(work.id)
    }

    override suspend fun setLiked(track: Track, liked: Boolean) {
        if (liked) dao.like(LikedTrackEntity(track.id, track.toFields(), now())) else dao.unlike(track.id)
    }
}

private fun ListenHistoryEntity.toItem() = ContinueItem(
    section = Section.ASMR, id = workId, title = workTitle, subtitle = "$trackTitle · $artist", coverUrl = coverUrl,
    positionMs = positionMs, durationMs = durationMs, updatedAt = updatedAt, finished = finished,
    track = Track(trackId, workId, sourceId, trackTitle, artist, coverUrl, durationMs),
)

private fun ReadHistoryEntity.toItem() = ContinueItem(
    section = Section.MANGA, id = galleryId, title = title, subtitle = artist, coverUrl = coverUrl,
    page = page, pageCount = pageCount, updatedAt = updatedAt, finished = finished,
)

private fun WatchHistoryEntity.toItem() = ContinueItem(
    section = if (kind == WatchKind.HENTAI) Section.HENTAI else Section.JAV, id = id, title = title, code = code,
    subtitle = studio, coverUrl = coverUrl, positionMs = positionMs, durationMs = durationMs, updatedAt = updatedAt, finished = finished,
    episode = episode,
)

internal fun TrackFields.toTrack() = Track(trackId, workId, sourceId, title, artist, coverUrl, durationMs)
internal fun Track.toFields() = TrackFields(id, workId, sourceId, title, artist, coverUrl, durationMs)
private fun DbPrivacy.toModel() = if (this == DbPrivacy.PUBLIC) PlaylistPrivacy.PUBLIC else PlaylistPrivacy.PRIVATE
private fun PlaylistPrivacy.toDb() = if (this == PlaylistPrivacy.PUBLIC) DbPrivacy.PUBLIC else DbPrivacy.PRIVATE
