package app.echo.data

import androidx.test.core.app.ApplicationProvider
import app.echo.data.db.EchoDatabase
import app.echo.data.db.FakeSeeder
import app.echo.data.db.ReadHistoryEntity
import app.echo.data.model.PlaylistPrivacy
import app.echo.data.model.Section
import app.echo.data.model.Track
import app.echo.data.repository.RoomLibraryRepository
import app.echo.data.repository.RoomPlaylistRepository
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/** design.md §12.1 › Room: DAOs on an in-memory database. */
@RunWith(RobolectricTestRunner::class)
class DatabaseTest {
    private val db = EchoDatabase.inMemory(ApplicationProvider.getApplicationContext())
    private var clock = 1_000_000L
    private val library = RoomLibraryRepository(db) { clock }
    private val playlists = RoomPlaylistRepository(db) { clock }

    @After fun close() = db.close()

    private fun read(id: String, page: Int, count: Int, at: Long, finished: Boolean = false) =
        ReadHistoryEntity(id, "threehentai", "Gallery $id", null, null, page, count, at, finished)

    @Test
    fun `history is newest first and continue leaves out finished`() = runTest {
        db.history().upsertRead(read("a", 3, 10, at = 1))
        db.history().upsertRead(read("b", 10, 10, at = 3, finished = true))
        db.history().upsertRead(read("c", 5, 10, at = 2))
        assertEquals(listOf("b", "c", "a"), library.history(Section.MANGA).first().map { it.id })
        assertEquals(listOf("c", "a"), library.continueIn(Section.MANGA).first().map { it.id })
        assertEquals(0.5f, library.continueIn(Section.MANGA).first().first().progress)
    }

    @Test
    fun `reading again updates the same row`() = runTest {
        db.history().upsertRead(read("a", 3, 10, at = 1))
        db.history().upsertRead(read("a", 7, 10, at = 2))
        val all = library.history(Section.MANGA).first()
        assertEquals(1, all.size)
        assertEquals(7, all.single().page)
    }

    @Test
    fun `clear history only clears that section`() = runTest {
        FakeSeeder(db) { clock }.seedIfEmpty()
        library.clearHistory(Section.MANGA)
        assertTrue(library.history(Section.MANGA).first().isEmpty())
        assertTrue(library.history(Section.ASMR).first().isNotEmpty())
        assertTrue(library.history(Section.JAV).first().isNotEmpty())
    }

    @Test
    fun `seeder fills Figma rows once`() = runTest {
        val seeder = FakeSeeder(db) { clock }
        seeder.seedIfEmpty()
        seeder.seedIfEmpty()
        assertEquals(5, playlists.playlists.first().size)
        assertEquals(18, playlists.playlists.first().first { it.name == "Sleep queue" }.trackCount)
        assertEquals("Gallery title placeholder", library.continueIn(Section.MANGA).first().first().title)
        assertEquals(listOf("ABC-101", "ABC-102", "ABC-103", "ABC-104", "ABC-105"), library.continueIn(Section.JAV).first().map { it.code })
    }

    @Test
    fun `playlist reorder renumbers positions`() = runTest {
        val id = playlists.create("Mix", PlaylistPrivacy.PRIVATE)
        listOf("one", "two", "three").forEach { playlists.add(id, Track(it, "w", "asmrone", it, "A", null, 1000)) }
        playlists.move(id, from = 0, to = 2)
        assertEquals(listOf("two", "three", "one"), playlists.tracks(id).first().map { it.id })
        playlists.remove(id, position = 1)
        assertEquals(listOf("two", "one"), playlists.tracks(id).first().map { it.id })
        assertEquals(2, playlists.playlists.first().single().trackCount)
    }

    @Test
    fun `like and unlike`() = runTest {
        val t = Track("t1", "w", "asmrone", "Track", "A", null, 1000)
        assertFalse(playlists.isLiked("t1").first())
        playlists.setLiked(t, true)
        assertTrue(playlists.isLiked("t1").first())
        assertEquals(listOf("t1"), playlists.liked.first().map { it.id })
        playlists.setLiked(t, false)
        assertFalse(playlists.isLiked("t1").first())
    }

    @Test
    fun `recent searches are per section, newest first, without duplicates`() = runTest {
        library.addSearch(Section.ASMR, "rain"); clock++
        library.addSearch(Section.ASMR, "ear cleaning"); clock++
        library.addSearch(Section.ASMR, "rain"); clock++
        library.addSearch(Section.MANGA, "vanilla")
        assertEquals(listOf("rain", "ear cleaning"), library.recentSearches(Section.ASMR).first())
        assertEquals(listOf("vanilla"), library.recentSearches(Section.MANGA).first())
    }
}
