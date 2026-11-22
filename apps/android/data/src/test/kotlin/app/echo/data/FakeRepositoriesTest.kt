package app.echo.data

import app.cash.turbine.test
import app.echo.data.fake.FakeAsmrRepository
import app.echo.data.fake.FakeConfig
import app.echo.data.fake.ForcedState
import app.echo.data.repository.ErrorKind
import app.echo.data.repository.Load
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** The fake catalogue serves every Figma state: Loading → Content / Empty / Error. */
class FakeRepositoriesTest {
    @Test
    fun `loading then content`() = runTest {
        FakeAsmrRepository(FakeConfig()).work("w1").test {
            assertEquals(Load.Loading, awaitItem())
            val content = awaitItem()
            assertTrue(content is Load.Content && content.value.title == "Whispered bedtime story")
            awaitComplete()
        }
    }

    @Test
    fun `unknown id is not found, no match is empty`() = runTest {
        val repo = FakeAsmrRepository(FakeConfig(latencyMs = 0))
        repo.work("nope").test { awaitItem(); assertEquals(Load.Error(ErrorKind.NOT_FOUND), awaitItem()); awaitComplete() }
        repo.search("zzz").test { awaitItem(); assertEquals(Load.Empty, awaitItem()); awaitComplete() }
    }

    @Test
    fun `forced error wins over content`() = runTest {
        val config = FakeConfig(latencyMs = 0, forced = ForcedState.Error(ErrorKind.OFFLINE))
        FakeAsmrRepository(config).home(0).test {
            assertEquals(Load.Loading, awaitItem())
            assertEquals(Load.Error(ErrorKind.OFFLINE), awaitItem())
            awaitComplete()
        }
    }
}
