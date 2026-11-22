package app.echo.android.feature.asmr

import app.cash.turbine.test
import app.echo.android.feature.asmr.home.AsmrHomeUiState
import app.echo.android.feature.asmr.home.AsmrHomeViewModel
import app.echo.android.testing.FakeLibrary
import app.echo.android.testing.MainDispatcherRule
import app.echo.data.fake.FakeAsmrRepository
import app.echo.data.fake.FakeCatalog
import app.echo.data.fake.FakeConfig
import app.echo.data.fake.FakePlayerController
import app.echo.data.fake.ForcedState
import app.echo.data.model.ContinueItem
import app.echo.data.model.Section
import app.echo.data.repository.ErrorKind
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class AsmrHomeViewModelTest {
    @get:Rule val main = MainDispatcherRule()

    private val continueItem = ContinueItem(Section.ASMR, "w1", "Whispered bedtime story", positionMs = 1, durationMs = 10, updatedAt = 1, finished = false)

    @Test
    fun `loading then the feed with continue listening`() = runTest {
        val vm = AsmrHomeViewModel(FakeAsmrRepository(FakeConfig(latencyMs = 0)), FakeLibrary(listOf(continueItem)), FakePlayerController(backgroundScope))
        vm.state.test {
            var s = awaitItem()
            if (s is AsmrHomeUiState.Loading) s = awaitItem()
            s as AsmrHomeUiState.Content
            assertEquals(4, s.featured.size)
            assertEquals(listOf("w1"), s.continueListening.map { it.id })
            assertTrue(s.trending.isNotEmpty())
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `offline shows the error, retry reloads`() = runTest {
        val config = FakeConfig(latencyMs = 0, forced = ForcedState.Error(ErrorKind.OFFLINE))
        val vm = AsmrHomeViewModel(FakeAsmrRepository(config), FakeLibrary(), FakePlayerController(backgroundScope))
        vm.state.test {
            var s = awaitItem()
            while (s is AsmrHomeUiState.Loading) s = awaitItem()
            assertEquals(AsmrHomeUiState.Error(ErrorKind.OFFLINE), s)
            config.force(ForcedState.None)
            vm.retry()
            while (s !is AsmrHomeUiState.Content) s = awaitItem()
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `the playing track is marked`() = runTest {
        val player = FakePlayerController(backgroundScope)
        val vm = AsmrHomeViewModel(FakeAsmrRepository(FakeConfig(latencyMs = 0)), FakeLibrary(), player)
        vm.state.test {
            var s = awaitItem()
            while (s !is AsmrHomeUiState.Content) s = awaitItem()
            val track = s.trending[1]
            player.play(s.trending, 1)
            while ((s as? AsmrHomeUiState.Content)?.playingTrackId != track.id) s = awaitItem()
            cancelAndIgnoreRemainingEvents()
        }
        assertEquals("w1", FakeCatalog.works.first().id)
    }
}
