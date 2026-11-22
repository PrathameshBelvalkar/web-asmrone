package app.echo.android.feature.shared

import app.echo.android.feature.shared.history.DayLabel
import app.echo.android.feature.shared.history.SharedHistoryViewModel
import app.echo.android.feature.shared.history.groupByDay
import app.echo.android.feature.shared.library.LibraryFilter
import app.echo.android.feature.shared.library.SharedLibraryViewModel
import app.echo.android.testing.FakeLibrary
import app.echo.android.testing.MainDispatcherRule
import app.echo.data.model.ContinueItem
import app.echo.data.model.Section
import app.echo.data.model.Track
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneOffset

class SharedScreensViewModelTest {
    @get:Rule val main = MainDispatcherRule()

    private val today = LocalDate.of(2026, 11, 22)
    private fun at(date: LocalDate) = date.atTime(9, 30).toInstant(ZoneOffset.UTC).toEpochMilli()

    private val track = Track("t1", "w1", "asmrone", "Ear cleaning", "Circle Aoi", null, 1_122_000)
    private val listenUnfinished = ContinueItem(Section.ASMR, "w1", "Whispered bedtime story", positionMs = 1, durationMs = 10, updatedAt = 4, finished = false, track = track)
    private val listenFinished = ContinueItem(Section.ASMR, "w2", "Rain on a tin roof", positionMs = 10, durationMs = 10, updatedAt = 3, finished = true, track = track)
    private val galleryUnfinished = ContinueItem(Section.MANGA, "g1", "Gallery title", page = 34, pageCount = 52, updatedAt = 2, finished = false)
    private val movie = ContinueItem(Section.JAV, "m1", "ABC-101", code = "ABC-101", positionMs = 1, durationMs = 10, updatedAt = 1, finished = false)

    @Test
    fun `history rows group by day, newest day first, with Today and Yesterday named`() {
        val rows = listOf(
            listenUnfinished.copy(updatedAt = at(today)),
            galleryUnfinished.copy(updatedAt = at(today.minusDays(1))),
            movie.copy(updatedAt = at(LocalDate.of(2026, 11, 17))),
        )
        val days = groupByDay(rows, today, ZoneOffset.UTC)

        assertEquals(
            listOf(DayLabel.Today, DayLabel.Yesterday, DayLabel.On(LocalDate.of(2026, 11, 17))),
            days.map { it.label },
        )
        assertEquals(listOf("w1"), days[0].items.map { it.id })
    }

    @Test
    fun `library shows everything under All, and the chips filter the shelves`() = runTest {
        val library = FakeLibrary(listOf(listenUnfinished, listenFinished, galleryUnfinished, movie))
        val vm = SharedLibraryViewModel(library)

        val all = vm.state.first { it.filter == LibraryFilter.ALL && it.continueItems.isNotEmpty() }
        assertEquals(listOf(Section.ASMR, Section.MANGA, Section.JAV), all.continueItems.map { it.section })
        assertEquals(listOf("w1", "w2"), all.listening.map { it.id })
        assertEquals(listOf("m1"), all.watching.map { it.id })

        vm.setFilter(LibraryFilter.LISTENING)
        val listening = vm.state.first { it.filter == LibraryFilter.LISTENING }
        assertEquals(listOf(Section.ASMR), listening.continueItems.map { it.section })
        assertEquals(listOf("w1", "w2"), listening.listening.map { it.id })
        assertTrue(listening.watching.isEmpty())

        vm.setFilter(LibraryFilter.READING)
        val reading = vm.state.first { it.filter == LibraryFilter.READING }
        assertEquals(listOf(Section.MANGA), reading.continueItems.map { it.section })
        assertTrue(reading.listening.isEmpty())
        assertTrue(reading.watching.isEmpty())
    }

    @Test
    fun `history switches section and removes one row`() = runTest {
        val library = FakeLibrary(listOf(listenUnfinished, galleryUnfinished))
        val vm = SharedHistoryViewModel(library, today = { today })

        val asmr = vm.state.first { it.section == Section.ASMR && it.days.isNotEmpty() }
        assertEquals(listOf("w1"), asmr.days.flatMap { it.items }.map { it.id })

        vm.setSection(Section.MANGA)
        val manga = vm.state.first { it.section == Section.MANGA && it.days.isNotEmpty() }
        assertEquals(listOf("g1"), manga.days.flatMap { it.items }.map { it.id })

        vm.remove(galleryUnfinished)
        val after = vm.state.first { it.section == Section.MANGA }
        assertTrue(after.days.flatMap { it.items }.isEmpty())
    }
}
