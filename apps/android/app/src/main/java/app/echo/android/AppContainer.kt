package app.echo.android

import android.content.Context
import app.echo.core.SourceId
import app.echo.data.DataModule
import app.echo.data.fake.FakeAsmrRepository
import app.echo.data.fake.FakeConfig
import app.echo.data.fake.FakeHentaiRepository
import app.echo.data.fake.FakeJavRepository
import app.echo.data.fake.FakeMangaRepository
import app.echo.data.fake.FakePlayerController
import app.echo.data.repository.AsmrRepository
import app.echo.data.repository.HentaiRepository
import app.echo.data.repository.JavRepository
import app.echo.data.repository.LibraryRepository
import app.echo.data.repository.MangaRepository
import app.echo.data.repository.PlayerController
import app.echo.data.repository.PlaylistRepository
import app.echo.data.repository.ProfileRepository
import app.echo.data.repository.SettingsRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Hand-made DI (design.md §5.4): builds the long-lived objects once and hands them to ViewModels.
 * Device data (settings, profile, library, playlists) is real; the catalogue and the player are fakes until the
 * real services plug in behind the same interfaces.
 */
class AppContainer(context: Context) {
    /** Lives as long as the process. */
    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    val sources: List<SourceId> = SourceId.entries

    private val data = DataModule(context)
    val settings: SettingsRepository = data.settings
    val profile: ProfileRepository = data.profile
    val library: LibraryRepository = data.library
    val playlists: PlaylistRepository = data.playlists

    val fakeConfig = FakeConfig()
    val asmr: AsmrRepository = FakeAsmrRepository(fakeConfig)
    val manga: MangaRepository = FakeMangaRepository(fakeConfig)
    val jav: JavRepository = FakeJavRepository(fakeConfig)
    val hentai: HentaiRepository = FakeHentaiRepository(fakeConfig)
    val player: PlayerController = FakePlayerController(appScope)

    /** Debug builds: fill Room with the Figma rows on a fresh install. */
    fun seedFakeData() {
        appScope.launch { data.seedFakeData() }
    }
}
