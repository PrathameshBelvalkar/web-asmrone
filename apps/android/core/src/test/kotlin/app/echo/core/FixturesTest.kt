package app.echo.core

import app.echo.core.testing.Fixtures
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class FixturesTest {
    @Test
    fun `every source with fixtures has a non-empty folder`() {
        SourceId.entries.filter { it.hasFixtures }.forEach { source ->
            val dir = File(Fixtures.root, source.id)
            assertTrue(dir.isDirectory, "missing fixture folder $dir")
            assertTrue(dir.listFiles().orEmpty().isNotEmpty(), "empty fixture folder $dir")
        }
    }

    @Test
    fun `no fixture folder belongs to an unknown source`() {
        val unknown = Fixtures.root.listFiles().orEmpty()
            .filter { it.isDirectory && SourceId.fromId(it.name) == null }
            .map { it.name }
        assertEquals(emptyList(), unknown)
    }

    @Test
    fun `fixtures are read as text`() {
        assertTrue(Fixtures.read("javguru", "rest-search-dldss-575.json").isNotBlank())
    }
}
