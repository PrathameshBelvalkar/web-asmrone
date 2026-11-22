package app.echo.android

import app.echo.core.SourceId
import app.echo.designsystem.theme.EchoTheme
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Phase 0 check that the Roborazzi pipeline works in `:app` at Pixel 8 size (412 × 915 dp, 420 dpi).
 * Removed when the placeholder screen is replaced by the app shell (Phase 4).
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w412dp-h915dp-420dpi")
class PlaceholderScreenshotTest {

    @Test
    fun placeholder() = captureRoboImage {
        EchoTheme(darkTheme = false, dynamicColor = false) { PlaceholderScreen(SourceId.entries) }
    }
}
