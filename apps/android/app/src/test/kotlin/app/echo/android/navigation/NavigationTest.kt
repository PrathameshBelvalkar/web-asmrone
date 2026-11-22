package app.echo.android.navigation

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.navigation.NavHostController
import androidx.navigation.compose.rememberNavController
import app.echo.android.shell.navigateToTab
import app.echo.data.model.Section
import app.echo.data.model.Sources
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.theme.EchoTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** Phase 4 done-when: every route opens (placeholders allowed) and back works everywhere (design.md §2). */
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w412dp-h915dp-420dpi")
class NavigationTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private lateinit var nav: NavHostController

    private val shell = object : ShellActions {
        override val profileInitial = "Pat"
        override fun open(route: Route) = nav.navigate(route)
        override fun back() { nav.popBackStack() }
        override fun openSourceSwitcher() = Unit
        override fun openProfile() = Unit
        override fun playSample() = Unit
        override fun play(tracks: List<app.echo.data.model.Track>, index: Int, playingFrom: String, source: app.echo.data.repository.PlaySource) = Unit
        override fun finishOnboarding() = Unit
        override fun sectionIcon(section: Section) = EchoIcons.MusicNote
    }

    private fun setUp(start: Route = Route.AsmrHome) {
        compose.setContent {
            nav = rememberNavController()
            EchoTheme(darkTheme = false) { EchoNavHost(nav, start, shell, Sources.asmrOne, PaddingValues()) }
        }
        compose.waitForIdle()
    }

    private fun assertScreen(code: String) = compose.onNodeWithTag("screen:$code").assertExists()

    private fun pressBack() {
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.waitForIdle()
    }

    @Test
    fun `every route opens and system back returns to the screen before it`() {
        setUp()
        assertScreen("1.1")
        ScreenSpecs.all.filter { it.sample != Route.AsmrHome }.forEach { spec ->
            compose.runOnUiThread { nav.navigate(spec.sample) }
            compose.waitForIdle()
            assertScreen(spec.code)
            pressBack()
            assertScreen("1.1")
        }
    }

    @Test
    fun `placeholder links open their targets and back comes back`() {
        setUp()
        ScreenSpecs.all.forEach { spec ->
            spec.links.forEach { target ->
                compose.runOnUiThread { nav.navigate(spec.sample) }
                compose.waitForIdle()
                compose.runOnUiThread { nav.navigate(target) }
                compose.waitForIdle()
                assertScreen(ScreenSpecs.of(target).code)
                pressBack()
                assertScreen(spec.code)
            }
        }
    }

    @Test
    fun `every frame code is unique and every route class is registered`() {
        val codes = ScreenSpecs.all.map { it.code }
        assertEquals(codes.size, codes.toSet().size)
        assertEquals(ScreenSpecs.all.size, ScreenSpecs.all.map { it.sample }.toSet().size)
    }

    @Test
    fun `tabs keep their own back stack`() {
        setUp()
        compose.runOnUiThread { nav.navigate(Route.Work("w1")) }
        compose.waitForIdle()
        assertScreen("1.5")
        compose.runOnUiThread { nav.navigateToTab(Section.ASMR, Tab.SEARCH) }
        compose.waitForIdle()
        assertScreen("1.2")
        compose.runOnUiThread { nav.navigateToTab(Section.ASMR, Tab.HOME) }
        compose.waitForIdle()
        // Home's stack (1.1 → 1.5) is restored.
        assertScreen("1.5")
        pressBack()
        assertScreen("1.1")
    }
}
