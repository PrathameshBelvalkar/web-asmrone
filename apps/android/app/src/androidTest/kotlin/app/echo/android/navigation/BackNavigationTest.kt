package app.echo.android.navigation

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.navigation.NavHostController
import androidx.navigation.compose.rememberNavController
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.echo.data.model.Section
import app.echo.data.model.Sources
import app.echo.data.model.Track
import app.echo.data.repository.PlaySource
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.theme.EchoTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * §12.3 Back, on the device: every screen in the registry opens over 1.1, and system Back returns to 1.1
 * (Figma's "BACK" link goes to the screen before). Screens are the real ones with the fake catalogue.
 */
@RunWith(AndroidJUnit4::class)
class BackNavigationTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private lateinit var nav: NavHostController

    private val shell = object : ShellActions {
        override val profileInitial = "P"
        override fun open(route: Route) = nav.navigate(route)
        override fun back() { nav.popBackStack() }
        override fun openSourceSwitcher() = Unit
        override fun openProfile() = Unit
        override fun playSample() = Unit
        override fun play(tracks: List<Track>, index: Int, playingFrom: String, source: PlaySource) = Unit
        override fun finishOnboarding() = Unit
        override fun sectionIcon(section: Section) = EchoIcons.MusicNote
    }

    private fun waitForScreen(code: String) =
        compose.waitUntil(TIMEOUT) { compose.onAllNodesWithTag("screen:$code").fetchSemanticsNodes().isNotEmpty() }

    @Test
    fun systemBackFromEveryScreenReturnsToTheScreenBefore() {
        compose.setContent {
            nav = rememberNavController()
            EchoTheme(darkTheme = false) { EchoNavHost(nav, Route.AsmrHome, shell, Sources.asmrOne, PaddingValues()) }
        }
        waitForScreen("1.1")
        ScreenSpecs.all.filter { it.sample != Route.AsmrHome }.forEach { spec ->
            compose.runOnUiThread { nav.navigate(spec.sample) }
            waitForScreen(spec.code)
            compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
            waitForScreen("1.1")
        }
    }

    private companion object {
        const val TIMEOUT = 10_000L
    }
}
