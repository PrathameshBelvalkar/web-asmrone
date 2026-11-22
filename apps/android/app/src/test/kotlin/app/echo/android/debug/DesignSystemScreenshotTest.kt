package app.echo.android.debug

import app.echo.designsystem.preview.EchoPreviewTheme
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.ParameterizedRobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Every section of the Design system debug screen (Figma 5 · Design system) in Light, Dark and Pure black.
 * Phone width, tall enough for a whole section, at 1× density to keep the baselines small.
 * The Phase 2 gallery is left out: its components have their own preview tests in :designsystem, and its wavy
 * progress line animates forever, so the screen never goes idle for a capture.
 */
@RunWith(ParameterizedRobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w412dp-h2600dp-mdpi")
class DesignSystemScreenshotTest(private val section: DsSection, private val theme: EchoPreviewTheme) {

    @Test
    fun section() = captureRoboImage("src/test/screenshots/ds/${section.name}_${theme.name}.png") {
        DesignSystemSection(section, theme.config)
    }

    companion object {
        @JvmStatic
        @ParameterizedRobolectricTestRunner.Parameters(name = "{0} {1}")
        fun params() = DsSection.entries.filter { it != DsSection.Gallery }.flatMap { s -> EchoPreviewTheme.entries.map { t -> arrayOf<Any>(s, t) } }
    }
}
