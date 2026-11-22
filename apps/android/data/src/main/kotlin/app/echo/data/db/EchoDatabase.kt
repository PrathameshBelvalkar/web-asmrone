package app.echo.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

/** `echo.db` (design.md §9.3). Bump [version] and add a migration for every schema change. */
@Database(
    entities = [
        ListenHistoryEntity::class, ReadHistoryEntity::class, WatchHistoryEntity::class,
        PlaylistEntity::class, PlaylistTrackEntity::class, LikedTrackEntity::class, LikedWorkEntity::class,
        QueueItemEntity::class, QueueStateEntity::class, ReaderPrefsEntity::class, SearchHistoryEntity::class,
    ],
    version = 1,
    exportSchema = true,
)
abstract class EchoDatabase : RoomDatabase() {
    abstract fun history(): HistoryDao
    abstract fun playlists(): PlaylistDao
    abstract fun queue(): QueueDao
    abstract fun readerPrefs(): ReaderPrefsDao
    abstract fun searchHistory(): SearchHistoryDao

    companion object {
        fun create(context: Context): EchoDatabase =
            Room.databaseBuilder(context.applicationContext, EchoDatabase::class.java, "echo.db").build()

        /** For tests and previews. */
        fun inMemory(context: Context): EchoDatabase =
            Room.inMemoryDatabaseBuilder(context.applicationContext, EchoDatabase::class.java).allowMainThreadQueries().build()
    }
}
