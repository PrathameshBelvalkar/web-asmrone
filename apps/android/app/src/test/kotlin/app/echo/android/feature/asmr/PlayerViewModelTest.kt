package app.echo.android.feature.asmr

import app.cash.turbine.test
import app.echo.android.feature.asmr.player.PlayerViewModel
import app.echo.android.feature.asmr.player.SleepChoice
import app.echo.android.feature.asmr.player.formatSpeed
import app.echo.android.testing.FakePlaylists
import app.echo.android.testing.MainDispatcherRule
import app.echo.data.fake.FakeAsmrRepository
import app.echo.data.fake.FakeCatalog
import app.echo.data.fake.FakeConfig
import app.echo.data.fake.FakePlayerController
import app.echo.data.model.PlaylistPrivacy
import app.echo.data.repository.PlaySource
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/** 1.8–1.11. */
class PlayerViewModelTest {
    @get:Rule val main = MainDispatcherRule()
    private val tracks = FakeCatalog.works.first().tracks

    @Test
    fun `like follows the current track and is stored`() = runTest {
        val player = FakePlayerController(backgroundScope)
        val playlists = FakePlaylists()
        val vm = PlayerViewModel(player, playlists, FakeAsmrRepository(FakeConfig(latencyMs = 0)))
        player.play(tracks, 1, "Whispered bedtime story", PlaySource.WORK)
        vm.state.test {
            var s = awaitItem()
            while (s.player.current == null) s = awaitItem()
            vm.toggleLike()
            while (!s.liked) s = awaitItem()
            assertTrue(playlists.isLiked(tracks[1].id).first())
            player.next()
            while (s.player.index != 2 || s.liked) s = awaitItem()
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `the lyric line follows the position`() = runTest {
        val player = FakePlayerController(backgroundScope)
        val vm = PlayerViewModel(player, FakePlaylists(), FakeAsmrRepository(FakeConfig(latencyMs = 0)))
        player.play(tracks, 0)
        player.playPause()
        vm.state.test {
            var s = awaitItem()
            while (s.lyrics.isEmpty()) s = awaitItem()
            assertEquals(0, s.lyricIndex)
            player.seekTo(30_000)
            while (s.player.positionMs != 30_000L) s = awaitItem()
            assertEquals(2, s.lyricIndex)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `sleep choices and add to playlist`() = runTest {
        val player = FakePlayerController(backgroundScope)
        val playlists = FakePlaylists()
        val id = playlists.create("Sleep queue", PlaylistPrivacy.PRIVATE)
        val vm = PlayerViewModel(player, playlists, FakeAsmrRepository(FakeConfig(latencyMs = 0)))
        player.play(tracks, 0)
        vm.setSleep(SleepChoice.MIN_30)
        assertNotNull(player.state.value.sleepAt)
        vm.setSleep(SleepChoice.END_OF_TRACK)
        assertTrue(player.state.value.sleepAtEndOfTrack)
        vm.setSleep(SleepChoice.OFF)
        assertNull(player.state.value.sleepAt)
        vm.state.test {
            var s = awaitItem()
            while (s.player.current == null) s = awaitItem()
            vm.addCurrentTo(id).join()
            cancelAndIgnoreRemainingEvents()
        }
        assertEquals(listOf(tracks[0].id), playlists.tracks(id).first().map { it.id })
    }

    @Test
    fun `speed labels match Figma`() {
        assertEquals("1.0×", formatSpeed(1f))
        assertEquals("1.25×", formatSpeed(1.25f))
        assertEquals("0.75×", formatSpeed(0.75f))
    }
}
