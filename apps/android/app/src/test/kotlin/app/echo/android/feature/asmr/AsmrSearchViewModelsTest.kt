package app.echo.android.feature.asmr

import app.cash.turbine.test
import app.echo.android.feature.asmr.results.AsmrResultsViewModel
import app.echo.android.feature.asmr.results.ResultsFilter
import app.echo.android.feature.asmr.search.AsmrSearchViewModel
import app.echo.android.testing.FakeLibrary
import app.echo.android.testing.FakePlaylists
import app.echo.android.testing.MainDispatcherRule
import app.echo.data.fake.FakeAsmrRepository
import app.echo.data.fake.FakeConfig
import app.echo.data.fake.FakePlayerController
import app.echo.data.model.PlaylistPrivacy
import app.echo.data.model.Section
import app.echo.data.repository.Load
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class AsmrSearchViewModelsTest {
    @get:Rule val main = MainDispatcherRule()

    @Test
    fun `1_2 shows trending and recent, suggestions only while typing`() = runTest {
        val library = FakeLibrary().apply { addSearch(Section.ASMR, "Circle Aoi") }
        val vm = AsmrSearchViewModel(FakeAsmrRepository(FakeConfig(latencyMs = 0)), library)
        vm.state.test {
            var s = awaitItem()
            while (s.trending.isEmpty() || s.recent.isEmpty()) s = awaitItem()
            assertEquals(listOf("Circle Aoi"), s.recent)
            assertTrue(s.suggestions.isEmpty())
            vm.setQuery("rain")
            while (s.suggestions.isEmpty()) s = awaitItem()
            assertTrue(s.suggestions.all { "rain" in it || " " in it })
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `1_2 submitting saves to recent, newest first`() = runTest {
        val library = FakeLibrary().apply { addSearch(Section.ASMR, "Circle Aoi") }
        val vm = AsmrSearchViewModel(FakeAsmrRepository(FakeConfig(latencyMs = 0)), library)
        vm.submit("rain").join()
        assertEquals(listOf("rain", "Circle Aoi"), library.recentSearches(Section.ASMR).first())
        vm.removeRecent("Circle Aoi").join()
        assertEquals(listOf("rain"), library.recentSearches(Section.ASMR).first())
    }

    @Test
    fun `1_3 loads all kinds, filters and matching playlists`() = runTest {
        val playlists = FakePlaylists().apply { create("Rain collection", PlaylistPrivacy.PUBLIC); create("For the train", PlaylistPrivacy.PRIVATE) }
        val vm = AsmrResultsViewModel("rain", FakeAsmrRepository(FakeConfig(latencyMs = 0)), playlists, FakePlayerController(backgroundScope))
        vm.state.test {
            var s = awaitItem()
            while (s.results !is Load.Content) s = awaitItem()
            val r = (s.results as Load.Content).value
            assertTrue(r.works.isNotEmpty() && r.artists.isNotEmpty() && r.tracks.isNotEmpty())
            assertEquals(listOf("Rain collection"), s.playlists.map { it.name })
            vm.setFilter(ResultsFilter.TRACKS)
            while (s.filter != ResultsFilter.TRACKS) s = awaitItem()
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `1_3 no matches is empty`() = runTest {
        val vm = AsmrResultsViewModel("zzzz", FakeAsmrRepository(FakeConfig(latencyMs = 0)), FakePlaylists(), FakePlayerController(backgroundScope))
        vm.state.test {
            var s = awaitItem()
            while (s.results == Load.Loading) s = awaitItem()
            assertEquals(Load.Empty, s.results)
            cancelAndIgnoreRemainingEvents()
        }
    }
}
