package app.echo.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
interface HistoryDao {
    @Upsert suspend fun upsertListen(entry: ListenHistoryEntity)
    @Upsert suspend fun upsertRead(entry: ReadHistoryEntity)
    @Upsert suspend fun upsertWatch(entry: WatchHistoryEntity)

    @Query("SELECT * FROM history_listen ORDER BY updatedAt DESC")
    fun listen(): Flow<List<ListenHistoryEntity>>

    @Query("SELECT * FROM history_listen WHERE finished = 0 ORDER BY updatedAt DESC LIMIT :limit")
    fun continueListening(limit: Int = 20): Flow<List<ListenHistoryEntity>>

    @Query("SELECT * FROM history_listen WHERE workId = :workId")
    fun listenFor(workId: String): Flow<ListenHistoryEntity?>

    @Query("SELECT * FROM history_read ORDER BY updatedAt DESC")
    fun read(): Flow<List<ReadHistoryEntity>>

    @Query("SELECT * FROM history_read WHERE finished = 0 ORDER BY updatedAt DESC LIMIT :limit")
    fun continueReading(limit: Int = 20): Flow<List<ReadHistoryEntity>>

    @Query("SELECT * FROM history_read WHERE galleryId = :galleryId")
    fun readFor(galleryId: String): Flow<ReadHistoryEntity?>

    @Query("SELECT * FROM history_watch WHERE kind = :kind ORDER BY updatedAt DESC")
    fun watch(kind: WatchKind): Flow<List<WatchHistoryEntity>>

    @Query("SELECT * FROM history_watch ORDER BY updatedAt DESC")
    fun watchAll(): Flow<List<WatchHistoryEntity>>

    @Query("SELECT * FROM history_watch WHERE finished = 0 ORDER BY updatedAt DESC LIMIT :limit")
    fun continueWatching(limit: Int = 20): Flow<List<WatchHistoryEntity>>

    @Query("DELETE FROM history_listen") suspend fun clearListen()
    @Query("DELETE FROM history_read") suspend fun clearRead()
    @Query("DELETE FROM history_watch WHERE kind = :kind") suspend fun clearWatch(kind: WatchKind)
    @Query("DELETE FROM history_watch WHERE kind = :kind AND id = :id") suspend fun removeWatch(kind: WatchKind, id: String)
}

/** A playlist with its track count, for 1.12. */
data class PlaylistSummary(val id: Long, val name: String, val privacy: PlaylistPrivacy, val createdAt: Long, val trackCount: Int)

@Dao
interface PlaylistDao {
    @Insert suspend fun insert(playlist: PlaylistEntity): Long

    @Query("UPDATE playlist SET name = :name, privacy = :privacy WHERE id = :id")
    suspend fun update(id: Long, name: String, privacy: PlaylistPrivacy)

    @Query("DELETE FROM playlist WHERE id = :id") suspend fun delete(id: Long)

    @Query(
        "SELECT p.id, p.name, p.privacy, p.createdAt, COUNT(t.position) AS trackCount FROM playlist p " +
            "LEFT JOIN playlist_track t ON t.playlistId = p.id GROUP BY p.id ORDER BY p.createdAt",
    )
    fun playlists(): Flow<List<PlaylistSummary>>

    @Query("SELECT * FROM playlist_track WHERE playlistId = :playlistId ORDER BY position")
    fun tracks(playlistId: Long): Flow<List<PlaylistTrackEntity>>

    @Query("SELECT COALESCE(MAX(position) + 1, 0) FROM playlist_track WHERE playlistId = :playlistId")
    suspend fun nextPosition(playlistId: Long): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertTracks(tracks: List<PlaylistTrackEntity>)

    @Query("DELETE FROM playlist_track WHERE playlistId = :playlistId") suspend fun clearTracks(playlistId: Long)

    @Query("SELECT * FROM playlist_track WHERE playlistId = :playlistId ORDER BY position")
    suspend fun tracksOnce(playlistId: Long): List<PlaylistTrackEntity>

    suspend fun add(playlistId: Long, track: TrackFields) =
        insertTracks(listOf(PlaylistTrackEntity(playlistId, nextPosition(playlistId), track)))

    /** 1.7 drag to reorder: move [from] to [to] and renumber 0…n. */
    @Transaction
    suspend fun move(playlistId: Long, from: Int, to: Int) {
        val list = tracksOnce(playlistId).toMutableList()
        if (from !in list.indices || to !in list.indices) return
        list.add(to, list.removeAt(from))
        clearTracks(playlistId)
        insertTracks(list.mapIndexed { i, t -> t.copy(position = i) })
    }

    @Transaction
    suspend fun remove(playlistId: Long, position: Int) {
        val list = tracksOnce(playlistId).filterNot { it.position == position }
        clearTracks(playlistId)
        insertTracks(list.mapIndexed { i, t -> t.copy(position = i) })
    }

    @Query("SELECT * FROM liked_work ORDER BY likedAt DESC") fun likedWorks(): Flow<List<LikedWorkEntity>>
    @Query("SELECT EXISTS(SELECT 1 FROM liked_work WHERE workId = :workId)") fun isWorkLiked(workId: String): Flow<Boolean>
    @Upsert suspend fun likeWork(entry: LikedWorkEntity)
    @Query("DELETE FROM liked_work WHERE workId = :workId") suspend fun unlikeWork(workId: String)

    @Query("SELECT * FROM liked_track ORDER BY likedAt DESC") fun liked(): Flow<List<LikedTrackEntity>>
    @Query("SELECT EXISTS(SELECT 1 FROM liked_track WHERE trackId = :trackId)") fun isLiked(trackId: String): Flow<Boolean>
    @Upsert suspend fun like(entry: LikedTrackEntity)
    @Query("DELETE FROM liked_track WHERE trackId = :trackId") suspend fun unlike(trackId: String)
}

@Dao
interface QueueDao {
    @Query("SELECT * FROM queue_item ORDER BY position") fun items(): Flow<List<QueueItemEntity>>
    @Query("SELECT * FROM queue_state WHERE id = 0") fun state(): Flow<QueueStateEntity?>
    @Query("DELETE FROM queue_item") suspend fun clearItems()
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertItems(items: List<QueueItemEntity>)
    @Upsert suspend fun saveState(state: QueueStateEntity)

    @Transaction
    suspend fun replace(items: List<TrackFields>, state: QueueStateEntity) {
        clearItems()
        insertItems(items.mapIndexed { i, t -> QueueItemEntity(i, t) })
        saveState(state)
    }
}

@Dao
interface ReaderPrefsDao {
    @Query("SELECT * FROM reader_prefs WHERE galleryId = :galleryId") fun forGallery(galleryId: String): Flow<ReaderPrefsEntity?>
    @Upsert suspend fun save(prefs: ReaderPrefsEntity)
    @Query("DELETE FROM reader_prefs WHERE galleryId = :galleryId") suspend fun reset(galleryId: String)
}

@Dao
interface SearchHistoryDao {
    @Query("SELECT * FROM search_history WHERE section = :section ORDER BY searchedAt DESC LIMIT :limit")
    fun recent(section: String, limit: Int = 10): Flow<List<SearchHistoryEntity>>

    @Upsert suspend fun add(entry: SearchHistoryEntity)
    @Query("DELETE FROM search_history WHERE section = :section AND `query` = :query") suspend fun remove(section: String, query: String)
    @Query("DELETE FROM search_history WHERE section = :section") suspend fun clear(section: String)
}
