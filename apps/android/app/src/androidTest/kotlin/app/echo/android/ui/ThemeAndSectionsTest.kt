package app.echo.android.ui

import android.graphics.Color
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.isRoot
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.echo.data.model.ThemeMode
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** §12.3 Theme and Sections. */
@RunWith(AndroidJUnit4::class)
class ThemeAndSectionsTest : EchoUiTest() {

    /** The screen's background at the left margin, half-way down (always background on Home and S.8). */
    private fun backgroundPixel(): Int {
        compose.waitForIdle()
        val bitmap = compose.onAllNodes(isRoot())[0].captureToImage().asAndroidBitmap()
        return bitmap.getPixel(MARGIN_PX, bitmap.height / 2)
    }

    private fun luminance(color: Int) = (Color.red(color) * 0.299 + Color.green(color) * 0.587 + Color.blue(color) * 0.114) / 255

    @Test
    fun darkAndPureBlackApplyLiveAndSurviveARestart() {
        freshInstall()
        runBlocking { container.settings.updateTheme { copy(mode = ThemeMode.LIGHT, pureBlack = false) } }
        launch()
        waitForScreen("1.1")
        assertTrue("starts light", luminance(backgroundPixel()) > LIGHT)

        openSettings()
        tap("Look and feel")
        waitForScreen("S.8")
        tap("Dark")
        compose.waitUntil(TIMEOUT) { luminance(backgroundPixel()) < DARK }
        assertEquals(ThemeMode.DARK, runBlocking { container.settings.theme.first { it.mode == ThemeMode.DARK }.mode })

        // Pure black: the background is #000000.
        tap("Pure black")
        compose.waitUntil(TIMEOUT) { backgroundPixel() == Color.BLACK }

        restart()
        waitForScreen("1.1")
        compose.waitUntil(TIMEOUT) { backgroundPixel() == Color.BLACK }
        val theme = runBlocking { container.settings.theme.first() }
        assertEquals(ThemeMode.DARK, theme.mode)
        assertTrue(theme.pureBlack)
    }

    @Test
    fun switchingSectionsMovesHomeAndLibrary() {
        freshInstall()
        launch()
        waitForScreen("1.1")

        // 3hentai: Home is 2.1, Library is the shared 0.2.
        switchSource("3hentai")
        waitForScreen("2.1")
        tapNav("Library")
        waitForScreen("0.2")
        tapNav("Home")
        waitForScreen("2.1")

        // javdatabase: Home is 3.1, Library is 3.12.
        switchSource("javdatabase")
        waitForScreen("3.1")
        tapNav("Library")
        waitForScreen("3.12")

        // Hentai: Home H.1, Search H.6, Library H.9.
        tapNav("Home")
        switchSource("Hentai")
        waitForScreen("H.1")
        tapNav("Search")
        waitForScreen("H.6")
        tapNav("Library")
        waitForScreen("H.9")
    }

    private companion object {
        const val MARGIN_PX = 8
        const val LIGHT = 0.8
        const val DARK = 0.2
    }
}
