package app.echo.android.ui

import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import androidx.compose.ui.test.onNodeWithTag
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.espresso.Espresso
import app.echo.android.AppContainer
import app.echo.android.EchoApp
import app.echo.android.MainActivity
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Rule

/**
 * Base of the §12.3 device tests: every test starts from cleared data (as after installing), sets up what it needs,
 * then launches [MainActivity] as a user would. Waits are on screen tags ("screen:1.1"), which every screen carries.
 */
abstract class EchoUiTest {
    @get:Rule val compose = createEmptyComposeRule()

    protected val container: AppContainer get() = ApplicationProvider.getApplicationContext<EchoApp>().container
    private var scenario: ActivityScenario<MainActivity>? = null

    /**
     * Clears everything (Room and both DataStores, like S.7). [onboarded] skips onboarding, the first-run tour and
     * the update offer, with an adult profile so every section is available.
     */
    protected fun freshInstall(onboarded: Boolean = true) = runBlocking {
        container.clearAllData()
        if (onboarded) {
            container.profile.update {
                copy(onboardingDone = true, firstRunTipShown = true, age = ADULT_AGE, showAdultSources = true)
            }
            container.settings.updateUpdates { copy(autoCheck = false) }
        }
    }

    protected fun launch() {
        scenario = ActivityScenario.launch(MainActivity::class.java)
    }

    /** Closes the app and opens it again (a cold start of the activity). */
    protected fun restart() {
        scenario?.close()
        launch()
    }

    @After
    fun closeApp() {
        scenario?.close()
    }

    protected fun waitForTag(tag: String, timeoutMs: Long = TIMEOUT) =
        compose.waitUntil(timeoutMs) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }

    protected fun waitForScreen(code: String) = waitForTag("screen:$code")

    protected fun waitFor(matcher: SemanticsMatcher, timeoutMs: Long = TIMEOUT) =
        compose.waitUntil(timeoutMs) { compose.onAllNodes(matcher).fetchSemanticsNodes().isNotEmpty() }

    protected fun gone(tag: String): Boolean = compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isEmpty()

    /** Waits for [text], scrolls it into view if it sits in a list, then taps the first node showing it. */
    protected fun tap(text: String, substring: Boolean = false): SemanticsNodeInteraction {
        waitFor(hasText(text, substring = substring))
        val node = compose.onAllNodes(hasText(text, substring = substring))[0]
        runCatching { node.performScrollTo() }
        return node.also { it.performClick() }
    }

    /** Swipes [screen] up until [matcher] is on screen (Home is a plain scrolling column, not a lazy list). */
    protected fun swipeUntil(screen: String, matcher: SemanticsMatcher) {
        repeat(MAX_SWIPES) {
            if (runCatching { compose.onAllNodes(matcher)[0].assertIsDisplayed() }.isSuccess) return
            compose.onNodeWithTag("screen:$screen").performTouchInput { swipeUp(startY = height * 0.7f, endY = height * 0.4f) }
        }
        compose.onAllNodes(matcher)[0].assertIsDisplayed()
    }

    /** A navigation bar item (Home · Search · Library), not a title with the same word. */
    protected fun tapNav(label: String) {
        val item = hasText(label) and hasAnyAncestor(hasTestTag("navbar"))
        waitFor(item)
        compose.onAllNodes(item)[0].performClick()
    }

    /** The source pill (0.1), then the source. */
    protected fun switchSource(name: String) {
        waitFor(hasContentDescriptionStarting(SWITCH_SOURCE))
        compose.onAllNodes(hasContentDescriptionStarting(SWITCH_SOURCE))[0].performClick()
        tap(name)
    }

    protected fun openSettings() {
        compose.onNodeWithContentDescription(PROFILE).performClick()
        tap("Settings")
        waitForScreen("S.1")
    }

    protected fun pressBack() {
        compose.waitForIdle()
        Espresso.pressBack()
        compose.waitForIdle()
    }

    private fun hasContentDescriptionStarting(prefix: String) = SemanticsMatcher("content description starts with $prefix") { node ->
        node.config.getOrElseNullable(androidx.compose.ui.semantics.SemanticsProperties.ContentDescription) { null }
            ?.any { it.startsWith(prefix) } == true
    }

    companion object {
        const val TIMEOUT = 10_000L
        const val ADULT_AGE = 24
        const val MAX_SWIPES = 8
        const val SWITCH_SOURCE = "Switch source"
        const val PROFILE = "Your profile"
    }
}
