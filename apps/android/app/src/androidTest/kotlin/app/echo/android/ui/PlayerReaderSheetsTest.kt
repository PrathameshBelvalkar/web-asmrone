package app.echo.android.ui

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.click
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeDown
import androidx.compose.ui.test.swipeUp
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** §12.3 Player, Reader, Sheets and dialogs. */
@RunWith(AndroidJUnit4::class)
class PlayerReaderSheetsTest : EchoUiTest() {

    @Test
    fun playerOpensCollapsesAndExpandsWithItsPages() {
        freshInstall()
        launch()
        waitForScreen("1.1")

        // A trending track plays and opens the full player.
        swipeUntil("1.1", hasText("01 · Opening, whispered"))
        tap("01 · Opening, whispered")
        waitForScreen("1.8")

        // Up next and Lyrics.
        tap("Up next")
        waitForScreen("1.9")
        tap("Lyrics")
        waitForScreen("1.10")
        pressBack()
        waitForScreen("1.8")

        // Drag down → the mini player; drag it up → the full player again.
        compose.onNodeWithTag("screen:1.8").performTouchInput { swipeDown(startY = height * 0.3f, endY = height * 0.9f) }
        compose.waitUntil(TIMEOUT) { runCatching { compose.onNodeWithTag("miniplayer").assertIsDisplayed() }.isSuccess }
        // From the mini player most of the way up the screen, as a thumb would.
        compose.onNodeWithTag("miniplayer").performTouchInput { swipeUp(startY = centerY, endY = centerY - DRAG_UP_PX) }
        compose.waitUntil(TIMEOUT) { runCatching { compose.onNodeWithTag("screen:1.8").assertIsDisplayed() }.isSuccess }
    }

    @Test
    fun readerTapZonesTurnPagesCentreShowsMenusLastPageEnds() {
        freshInstall()
        launch()
        waitForScreen("1.1")
        switchSource("3hentai")
        waitForScreen("2.1")
        tap("Gallery title placeholder", substring = true)
        waitForScreen("2.5")

        // Open the reader on page 1: menus show "1 / N".
        tap("Read")
        waitForScreen("2.6")
        val reader = compose.onNodeWithTag("screen:2.6")
        waitFor(hasText("1 / ", substring = true))

        // R → L: the left third is the next page. Menus hide on a page turn; the centre shows them again.
        reader.performTouchInput { click(Offset(width * LEFT, height / 2f)) }
        waitFor(hasText("2 / ", substring = true))
        reader.performTouchInput { click(center) }
        waitFor(hasText("Pages"))

        // The pages sheet → Last page, then one more turn → 2.10 End of gallery.
        tap("Pages")
        tap("Last page")
        compose.waitUntil(TIMEOUT) { compose.onAllNodes(hasText("Last page")).fetchSemanticsNodes().isEmpty() }
        reader.performTouchInput { click(Offset(width * LEFT, height / 2f)) }
        waitForScreen("2.10")
    }

    @Test
    fun filterSheetAppliesAndCancels() {
        freshInstall()
        launch()
        waitForScreen("1.1")
        switchSource("javdatabase")
        waitForScreen("3.1")
        tap("Idols")
        waitForScreen("3.8")

        // Apply: Active becomes a filter chip.
        compose.onNodeWithContentDescription("Filters").performClick()
        tap("Active")
        tap("Show ", substring = true)
        waitFor(hasText("Active"))

        // Cancel: Retired isn't applied.
        compose.onNodeWithContentDescription("Filters").performClick()
        tap("Retired")
        tap("Cancel")
        compose.waitForIdle()
        assertTrue(compose.onAllNodes(hasText("Retired")).fetchSemanticsNodes().isEmpty())
        assertTrue(compose.onAllNodes(hasText("Active")).fetchSemanticsNodes().isNotEmpty())
    }

    @Test
    fun clearAllDataGoesBackToOnboarding() {
        freshInstall()
        launch()
        waitForScreen("1.1")
        openSettings()
        tap("Storage")
        waitForScreen("S.6")
        tap("Clear all data")
        // The dialog's own button (the second "Clear all data").
        compose.waitUntil(TIMEOUT) { compose.onAllNodes(hasText("Clear all data")).fetchSemanticsNodes().size >= 2 }
        compose.onAllNodes(hasText("Clear all data"))[1].performClick()
        waitForScreen("O.2")
        assertTrue(runBlocking { !container.profile.profile.first().onboardingDone })
    }

    private companion object {
        const val LEFT = 0.15f
        const val DRAG_UP_PX = 1_400f
    }
}
