package app.echo.android

import android.content.Context
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.mediacodec.MediaCodecSelector
import androidx.media3.exoplayer.mediacodec.MediaCodecUtil
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
import app.echo.data.repository.ReaderPrefsRepository
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
    private val appContext = context.applicationContext

    /** Lives as long as the process. */
    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    val sources: List<SourceId> = SourceId.entries

    private val data = DataModule(context)
    val settings: SettingsRepository = data.settings
    val profile: ProfileRepository = data.profile
    val library: LibraryRepository = data.library
    val playlists: PlaylistRepository = data.playlists
    val readerPrefs: ReaderPrefsRepository = data.readerPrefs

    val fakeConfig = FakeConfig()
    val asmr: AsmrRepository = FakeAsmrRepository(fakeConfig)
    val manga: MangaRepository = FakeMangaRepository(fakeConfig)
    val jav: JavRepository = FakeJavRepository(fakeConfig)
    val hentai: HentaiRepository = FakeHentaiRepository(fakeConfig)
    val player: PlayerController = FakePlayerController(appScope)

    /**
     * A video player for 3.7 / H.11 Theater. Its owner releases it. It takes audio focus as a movie (pausing other
     * audio, and pausing for calls) and pauses when headphones are unplugged.
     *
     * Decoders: the emulator's goldfish ones go last (they reject some streams' codec data, seen with HLS on API 37;
     * real devices don't have them), and a decoder that fails to start falls back to the next one.
     */
    @androidx.annotation.OptIn(UnstableApi::class)
    fun newVideoPlayer(): ExoPlayer = ExoPlayer.Builder(
        appContext,
        DefaultRenderersFactory(appContext)
            .setMediaCodecSelector { mimeType, secure, tunneling ->
                MediaCodecUtil.getDecoderInfos(mimeType, secure, tunneling).sortedBy { "goldfish" in it.name }
            }
            .setEnableDecoderFallback(true),
    )
        .setAudioAttributes(
            AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MOVIE).build(),
            /* handleAudioFocus = */ true,
        )
        .setHandleAudioBecomingNoisy(true)
        .build()

    /** S.7 Clear all data: Room, settings and profile. The caller restarts at O.1. */
    suspend fun clearAllData() = data.clearAllData()

    /** Debug builds: fill Room with the Figma rows on a fresh install. */
    fun seedFakeData() {
        appScope.launch { data.seedFakeData() }
    }
}
