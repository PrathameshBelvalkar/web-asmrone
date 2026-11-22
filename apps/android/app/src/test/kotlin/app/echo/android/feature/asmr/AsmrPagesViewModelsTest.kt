package app.echo.android.feature.asmr

import app.cash.turbine.test
import app.echo.android.feature.asmr.artist.AsmrArtistViewModel
import app.echo.android.feature.asmr.feed.AsmrFeedViewModel
import app.echo.android.feature.asmr.work.AsmrWorkViewModel
import app.echo.android.testing.FakePlaylists
import app.echo.android.testing.MainDispatcherRule
import app.echo.data.fake.FakeAsmrRepository
import app.echo.data.fake.FakeConfig
import app.echo.data.fake.FakePlayerController
import app.echo.data.model.FeedPeriod
import app.echo.data.model.PlaylistPrivacy
import app.echo.data.repository.ErrorKind
import app.echo.data.repository.Load
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class AsmrPagesViewModelsTest {
    @get:Rule val main = MainDispatcherRule()
    private val asmr = FakeAsmrRepository(FakeConfig(latencyMs = 0))

    @Test
    fun `1_4 feed reloads when the period changes`() = runTest {
        val vm = AsmrFeedViewModel(tab = 1, asmr)
        vm.state.test {
            var s = awaitItem()
            while (s.works !is Load.Content) s = awaitItem()
            val week = (s.works as Load.Content).value.map { it.id }
            vm.setPeriod(FeedPeriod.ALL)
            while (s.period != FeedPeriod.ALL || s.works !is Load.Content) s = awaitItem()
            assertNotEquals(week, (s.works as Load.Content).value.map { it.id })
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `1_5 work, like is stored, add to playlist adds every track`() = runTest {
        val playlists = FakePlaylists()
        val id = playlists.create("Sleep queue", PlaylistPrivacy.PRIVATE)
        val vm = AsmrWorkViewModel("w1", asmr, playlists, FakePlayerController(backgroundScope))
        vm.state.test {
            var s = awaitItem()
            while (s.work !is Load.Content || s.similar.isEmpty()) s = awaitItem()
            val work = (s.work as Load.Content).value
            vm.toggleLike()
            while (!s.liked) s = awaitItem()
            vm.addToPlaylist(id).join()
            assertEquals(work.tracks.size, playlists.tracks(id).first().size)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `1_5 unknown work is not found`() = runTest {
        val vm = AsmrWorkViewModel("nope", asmr, FakePlaylists(), FakePlayerController(backgroundScope))
        vm.state.test {
            var s = awaitItem()
            while (s.work == Load.Loading) s = awaitItem()
            assertEquals(Load.Error(ErrorKind.NOT_FOUND), s.work)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `1_6 artist by name has works and co-artists`() = runTest {
        val vm = AsmrArtistViewModel("Aoi Mizuno", asmr)
        vm.state.test {
            var s = awaitItem()
            while (s !is Load.Content) s = awaitItem()
            assertEquals("a3", s.value.artist.id)
            assertTrue(s.value.popular.isNotEmpty())
            assertTrue(s.value.appearsWith.none { it.name == "Aoi Mizuno" })
            cancelAndIgnoreRemainingEvents()
        }
    }
}
