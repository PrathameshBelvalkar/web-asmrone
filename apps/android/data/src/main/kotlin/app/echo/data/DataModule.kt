package app.echo.data

import android.content.Context
import app.echo.data.db.EchoDatabase
import app.echo.data.db.FakeSeeder
import app.echo.data.prefs.DataStoreProfileRepository
import app.echo.data.prefs.DataStoreSettingsRepository
import app.echo.data.prefs.EchoDataStores
import app.echo.data.repository.LibraryRepository
import app.echo.data.repository.PlaylistRepository
import app.echo.data.repository.ReaderPrefsRepository
import app.echo.data.repository.RoomReaderPrefsRepository
import app.echo.data.repository.ProfileRepository
import app.echo.data.repository.RoomLibraryRepository
import app.echo.data.repository.RoomPlaylistRepository
import app.echo.data.repository.SettingsRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Everything stored on the device, built once. `:app` only sees the repository interfaces; DataStore and Room stay
 * inside `:data`.
 */
class DataModule(context: Context) {
    private val database = EchoDatabase.create(context)

    val settings: SettingsRepository = DataStoreSettingsRepository(EchoDataStores.settings(context))
    val profile: ProfileRepository = DataStoreProfileRepository(EchoDataStores.profile(context))
    val library: LibraryRepository = RoomLibraryRepository(database)
    val playlists: PlaylistRepository = RoomPlaylistRepository(database)
    val readerPrefs: ReaderPrefsRepository = RoomReaderPrefsRepository(database)

    /** Debug builds: fill Room with the Figma rows on a fresh install. */
    suspend fun seedFakeData() = withContext(Dispatchers.IO) { FakeSeeder(database).seedIfEmpty() }

    /** S.7 Clear all data: every table and both DataStores. The caller clears the image cache and restarts at O.1. */
    suspend fun clearAllData() = withContext(Dispatchers.IO) {
        database.clearAllTables()
        settings.clear()
        profile.clear()
    }
}
