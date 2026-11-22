package app.echo.designsystem.preview

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.tooling.preview.PreviewParameterProvider
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.theme.ThemeConfig
import app.echo.designsystem.theme.ThemeMode
import app.echo.designsystem.tokens.EchoSpacing

/** The three themes every component and screen is previewed and screenshot-tested in (design.md rule 5). */
enum class EchoPreviewTheme(val config: ThemeConfig) {
    Light(ThemeConfig(mode = ThemeMode.LIGHT, dynamicColor = false)),
    Dark(ThemeConfig(mode = ThemeMode.DARK, dynamicColor = false)),
    PureBlack(ThemeConfig(mode = ThemeMode.DARK, dynamicColor = false, pureBlack = true)),
}

/** For screen previews that want one image per theme. */
class EchoPreviewThemes : PreviewParameterProvider<EchoPreviewTheme> {
    override val values = EchoPreviewTheme.entries.asSequence()
    override fun getDisplayName(index: Int) = EchoPreviewTheme.entries[index].name
}

/**
 * A component preview at phone width. Wrap the body in [EchoThemesPreview] so one image shows the component in
 * Light, Dark and Pure black. Every @Preview in :designsystem is also a Roborazzi screenshot test.
 */
@Preview(widthDp = 412)
annotation class EchoPreviews

/** A screen preview at Pixel 8 size (412 × 915 dp), at font scale 1 and 1.3. */
@Preview(name = "Screen", device = "spec:width=412dp,height=915dp,dpi=420", showSystemUi = true)
@Preview(name = "Screen · font 1.3", device = "spec:width=412dp,height=915dp,dpi=420", fontScale = 1.3f, showSystemUi = true)
annotation class EchoScreenPreviews

/** Renders [content] three times: Light, Dark, Pure black, each labelled, on the theme's surface. */
@Composable
fun EchoThemesPreview(content: @Composable () -> Unit) {
    Column {
        EchoPreviewTheme.entries.forEach { theme ->
            EchoTheme(theme.config) {
                Surface(Modifier.fillMaxWidth()) {
                    Column(
                        Modifier.padding(vertical = EchoSpacing.m),
                        verticalArrangement = Arrangement.spacedBy(EchoSpacing.s),
                    ) {
                        Text(
                            theme.name,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin),
                        )
                        content()
                    }
                }
            }
        }
    }
}
