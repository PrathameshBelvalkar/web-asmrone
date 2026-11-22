package app.echo.data

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import app.echo.data.model.Profile
import app.echo.data.model.Section
import app.echo.data.model.Settings
import app.echo.data.model.ThemeMode
import app.echo.data.model.ThemeSettings
import app.echo.data.prefs.DataStoreProfileRepository
import app.echo.data.prefs.DataStoreSettingsRepository
import app.cash.turbine.test
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

/** design.md §12.1 › Settings and profile: DataStore repositories on a temp file. */
class SettingsRepositoryTest {
    @get:Rule val tmp = TemporaryFolder()

    private fun store(file: File, scope: CoroutineScope) = PreferenceDataStoreFactory.create(scope = scope) { file }

    @Test
    fun `defaults before anything is written`() = runTest {
        val scope = CoroutineScope(UnconfinedTestDispatcher(testScheduler) + SupervisorJob())
        val repo = DataStoreSettingsRepository(store(tmp.newFile("s.preferences_pb").also { it.delete() }, scope))
        assertEquals(Settings(), repo.settings.first())
        assertEquals(ThemeSettings(), repo.theme.first())
        scope.cancel()
    }

    @Test
    fun `theme updates are emitted live`() = runTest {
        val scope = CoroutineScope(UnconfinedTestDispatcher(testScheduler) + SupervisorJob())
        val repo = DataStoreSettingsRepository(store(File(tmp.root, "s.preferences_pb"), scope))
        repo.theme.test {
            assertEquals(ThemeMode.SYSTEM, awaitItem().mode)
            repo.updateTheme { copy(mode = ThemeMode.DARK) }
            assertEquals(ThemeMode.DARK, awaitItem().mode)
            repo.updateTheme { copy(pureBlack = true, dynamicColor = false) }
            val t = awaitItem()
            assertTrue(t.pureBlack)
            assertFalse(t.dynamicColor)
            cancelAndIgnoreRemainingEvents()
        }
        scope.cancel()
    }

    @Test
    fun `theme survives a restart`() = runTest {
        val file = File(tmp.root, "restart.preferences_pb")
        val first = CoroutineScope(UnconfinedTestDispatcher(testScheduler) + SupervisorJob())
        DataStoreSettingsRepository(store(file, first)).updateTheme {
            copy(mode = ThemeMode.DARK, dynamicColor = false, pureBlack = true, seedColor = 0xFF2E7D32)
        }
        first.cancel()

        // A new process: a new DataStore on the same file.
        val second = CoroutineScope(UnconfinedTestDispatcher(testScheduler) + SupervisorJob())
        val theme = DataStoreSettingsRepository(store(file, second)).theme.first()
        assertEquals(ThemeMode.DARK, theme.mode)
        assertFalse(theme.dynamicColor)
        assertTrue(theme.pureBlack)
        assertEquals(0xFF2E7D32, theme.seedColor)
        second.cancel()
    }

    @Test
    fun `other groups keep their values when one changes`() = runTest {
        val scope = CoroutineScope(UnconfinedTestDispatcher(testScheduler) + SupervisorJob())
        val repo = DataStoreSettingsRepository(store(File(tmp.root, "g.preferences_pb"), scope))
        repo.updatePlayback { copy(defaultSpeed = 1.5f) }
        repo.updateTheme { copy(mode = ThemeMode.LIGHT) }
        val s = repo.settings.first()
        assertEquals(1.5f, s.playback.defaultSpeed)
        assertEquals(ThemeMode.LIGHT, s.theme.mode)
        repo.clear()
        assertEquals(Settings(), repo.settings.first())
        scope.cancel()
    }

    @Test
    fun `profile round trip and clear`() = runTest {
        val scope = CoroutineScope(UnconfinedTestDispatcher(testScheduler) + SupervisorJob())
        val repo = DataStoreProfileRepository(store(File(tmp.root, "p.preferences_pb"), scope))
        assertEquals(Profile(), repo.profile.first())
        repo.update { copy(name = "Mika", age = 24, showAdultSources = true, enabledSections = setOf(Section.ASMR, Section.MANGA), onboardingDone = true) }
        val p = repo.profile.first()
        assertEquals("Mika", p.name)
        assertEquals(24, p.age)
        assertEquals(setOf(Section.ASMR, Section.MANGA), p.enabledSections)
        assertTrue(p.onboardingDone)
        repo.update { copy(age = null) }
        assertEquals(null, repo.profile.first().age)
        repo.clear()
        assertEquals(Profile(), repo.profile.first())
        scope.cancel()
    }
}
