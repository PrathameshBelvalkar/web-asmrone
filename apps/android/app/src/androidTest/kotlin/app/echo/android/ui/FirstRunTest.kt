package app.echo.android.ui

import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.echo.data.model.Section
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** §12.3 First run: O.1 → O.9 → Home. Restart → straight to Home. Answers saved. */
@RunWith(AndroidJUnit4::class)
class FirstRunTest : EchoUiTest() {
    @Test
    fun firstRunGoesFromSplashToHomeAndIsNotShownAgain() {
        freshInstall(onboarded = false)
        launch()

        // O.1 hands over to the welcome pager.
        waitForScreen("O.2")
        tap("Next")
        waitForScreen("O.3")
        tap("Next")
        waitForScreen("O.4")
        tap("Get started")

        // O.5: ASMR and Manga start ticked.
        waitForScreen("O.5")
        tap("Continue · 2 selected")

        // O.6: a name.
        waitForScreen("O.6")
        compose.onNode(hasSetTextAction()).performTextReplacement("Tester")
        tap("Continue")

        // O.7: 18 + 6 = 24.
        waitForScreen("O.7")
        repeat(6) { compose.onNodeWithContentDescription("One year older").performClick() }
        tap("Continue")

        // O.8 → Home, with the O.9 tour over it.
        waitForScreen("O.8")
        tap("Start exploring")
        waitForScreen("1.1")
        waitForTag("overlay:O.9")
        tap("Skip tips")
        compose.waitUntil(TIMEOUT) { gone("overlay:O.9") }

        val profile = runBlocking { container.profile.profile.first { it.firstRunTipShown } }
        assertEquals("Tester", profile.name)
        assertEquals(24, profile.age)
        assertTrue(profile.onboardingDone)
        assertEquals(setOf(Section.ASMR, Section.MANGA), profile.enabledSections)

        // A restart opens Home: no splash pager, no tour.
        restart()
        waitForScreen("1.1")
        assertTrue(gone("screen:O.2"))
        assertTrue(gone("overlay:O.9"))
    }
}
