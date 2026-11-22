package app.echo.android.feature.asmr

import app.cash.turbine.test
import app.echo.android.feature.asmr.playlist.AsmrPlaylistViewModel
import app.echo.android.feature.asmr.playlists.AsmrPlaylistsViewModel
import app.echo.android.feature.asmr.playlists.PlaylistsTab
import app.echo.android.testing.FakeLibrary
import app.echo.android.testing.FakePlaylists
import app.echo.android.testing.MainDispatcherRule
import app.echo.data.fake.FakeCatalog
import app.echo.data.fake.FakePlayerController
import app.echo.data.model.PlaylistPrivacy
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class AsmrPlaylistViewModelsTest {
    @get:Rule val main = MainDispatcherRule()
    private val tracks = FakeCatalog.works.first().tracks.take(3)

    @Test
    fun `1_12 lists playlists, switches tabs, creates`() = runTest {
        val repo = FakePlaylists().apply { create("Sleep queue", PlaylistPrivacy.PRIVATE) }
        val vm = AsmrPlaylistsViewModel(repo, FakeLibrary())
        vm.state.test {
            var s = awaitItem()
            while (s.playlists.isEmpty()) s = awaitItem()
            vm.setTab(PlaylistsTab.LIKED)
            while (s.tab != PlaylistsTab.LIKED) s = awaitItem()
            var created = -1L
            vm.create("  Rain  ") { created = it }.join()
            while (s.playlists.size < 2) s = awaitItem()
            assertEquals("Rain", s.playlists.last().name)
            assertEquals(s.playlists.last().id, created)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `1_7 reorder is saved, privacy toggles, rename keeps privacy`() = runTest {
        val repo = FakePlaylists()
        val id = repo.create("Sleep queue", PlaylistPrivacy.PRIVATE)
        tracks.forEach { repo.add(id, it) }
        val vm = AsmrPlaylistViewModel(id, repo, FakePlayerController(backgroundScope))
        vm.state.test {
            var s = awaitItem()
            while (s.tracks.size < 3) s = awaitItem()
            vm.move(0, 2).join()
            assertEquals(listOf(tracks[1], tracks[2], tracks[0]).map { it.id }, repo.tracks(id).first().map { it.id })
            vm.togglePrivacy().join()
            while (s.playlist?.privacy != PlaylistPrivacy.PUBLIC) s = awaitItem()
            vm.rename("Night queue").join()
            while (s.playlist?.name != "Night queue") s = awaitItem()
            assertEquals(PlaylistPrivacy.PUBLIC, s.playlist?.privacy)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `1_7 missing playlist loads as not found`() = runTest {
        val vm = AsmrPlaylistViewModel(99, FakePlaylists(), FakePlayerController(backgroundScope))
        vm.state.test {
            var s = awaitItem()
            while (!s.loaded) s = awaitItem()
            assertEquals(null, s.playlist)
            cancelAndIgnoreRemainingEvents()
        }
    }
}
