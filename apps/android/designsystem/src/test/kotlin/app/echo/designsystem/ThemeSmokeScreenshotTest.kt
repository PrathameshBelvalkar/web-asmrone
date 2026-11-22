package app.echo.designsystem

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.echo.designsystem.theme.EchoTheme
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Phase 0 check that the Roborazzi pipeline works in `:designsystem`.
 * Phase 2 replaces it with one test per component in Light, Dark and Pure black.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w412dp-h200dp-420dpi")
class ThemeSmokeScreenshotTest {

    @Test
    fun light() = captureRoboImage { Sample(darkTheme = false) }

    @Test
    fun dark() = captureRoboImage { Sample(darkTheme = true) }

    @Composable
    private fun Sample(darkTheme: Boolean) {
        EchoTheme(darkTheme = darkTheme, dynamicColor = false) {
            Surface {
                Column(Modifier.padding(16.dp)) {
                    Text("Echo", style = MaterialTheme.typography.headlineMedium)
                    Button(onClick = {}) { Text("Play") }
                }
            }
        }
    }
}
