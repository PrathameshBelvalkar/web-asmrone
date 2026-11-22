package app.echo.android.feature.manga

import app.echo.android.feature.manga.browse.MangaBrowseViewModel
import app.echo.android.testing.FakeLibrary
import app.echo.android.testing.MainDispatcherRule
import app.echo.data.fake.FakeConfig
import app.echo.data.fake.FakeMangaRepository
import app.echo.data.model.ReaderSettings
import app.echo.data.model.ReadingMode
import app.echo.data.model.Tag
import app.echo.data.model.TapZones
import app.echo.data.repository.GalleryReaderPrefs
import app.echo.data.repository.Load
import app.echo.data.repository.withOverrides
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class MangaScreensTest {
    @get:Rule val main = MainDispatcherRule()

    @Test
    fun `the language filter keeps only galleries in that language`() = runTest {
        val vm = MangaBrowseViewModel(FakeMangaRepository(FakeConfig(latencyMs = 0)), FakeLibrary())
        vm.setLanguage(MangaLanguage.ENGLISH)
        val state = vm.state.first { it.language == MangaLanguage.ENGLISH && it.galleries is Load.Content }
        val list = (state.galleries as Load.Content).value
        assertTrue(list.isNotEmpty())
        assertTrue(list.all { it.language == "EN" })
    }

    @Test
    fun `A to Z groups tags by their first letter`() {
        val groups = groupTags(
            listOf(Tag("1", "Banana", 1), Tag("2", "Apple", 2), Tag("3", "Avocado", 3)),
            query = "", sort = TagSort.AZ,
        )
        assertEquals(listOf("A", "B"), groups.map { it.letter })
        assertEquals(listOf("Apple", "Avocado"), groups[0].items.map { it.name })
    }

    @Test
    fun `Popular is one list by gallery count, with no letter groups`() {
        val groups = groupTags(
            listOf(Tag("1", "Banana", 1), Tag("2", "Apple", 2), Tag("3", "Avocado", 30)),
            query = "", sort = TagSort.POPULAR,
        )
        assertEquals(1, groups.size)
        assertEquals("", groups[0].letter)
        assertEquals(listOf("Avocado", "Apple", "Banana"), groups[0].items.map { it.name })
    }

    @Test
    fun `the query filters tags by name, ignoring case`() {
        val groups = groupTags(listOf(Tag("1", "Banana", 1), Tag("2", "Apple", 2)), query = "ANA", sort = TagSort.AZ)
        assertEquals(listOf("Banana"), groups.flatMap { it.items }.map { it.name })
    }

    @Test
    fun `a gallery's overrides replace only the fields they set`() {
        val defaults = ReaderSettings(readingMode = ReadingMode.PAGED_RTL, tapZones = TapZones.DEFAULT, cropBorders = false)
        val merged = defaults.withOverrides(GalleryReaderPrefs(mode = ReadingMode.PAGED_LTR, cropBorders = true))
        assertEquals(ReadingMode.PAGED_LTR, merged.readingMode)
        assertTrue(merged.cropBorders)
        assertEquals(TapZones.DEFAULT, merged.tapZones)
        assertEquals(defaults, defaults.withOverrides(null))
    }
}
