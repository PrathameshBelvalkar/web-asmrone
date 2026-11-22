package app.echo.designsystem.preview

import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.tooling.preview.PreviewParameterProvider
import app.echo.designsystem.theme.ThemeConfig
import app.echo.designsystem.theme.ThemeMode

/** The three themes every component and screen is previewed and screenshot-tested in (design.md rule 5). */
enum class EchoPreviewTheme(val config: ThemeConfig) {
    Light(ThemeConfig(mode = ThemeMode.LIGHT, dynamicColor = false)),
    Dark(ThemeConfig(mode = ThemeMode.DARK, dynamicColor = false)),
    PureBlack(ThemeConfig(mode = ThemeMode.DARK, dynamicColor = false, pureBlack = true)),
}

/**
 * Use with [EchoPreviews]:
 * ```
 * @EchoPreviews @Composable
 * private fun ShelfHeaderPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) =
 *     EchoTheme(theme.config) { ShelfHeader(…) }
 * ```
 */
class EchoPreviewThemes : PreviewParameterProvider<EchoPreviewTheme> {
    override val values = EchoPreviewTheme.entries.asSequence()
    override fun getDisplayName(index: Int) = EchoPreviewTheme.entries[index].name
}

/** A component preview. One per theme comes from [EchoPreviewThemes]. */
@Preview(showBackground = true)
annotation class EchoPreviews

/** A screen preview at Pixel 8 size (412 × 915 dp), at font scale 1 and 1.3. */
@Preview(name = "Screen", device = "spec:width=412dp,height=915dp,dpi=420", showSystemUi = true)
@Preview(name = "Screen · font 1.3", device = "spec:width=412dp,height=915dp,dpi=420", fontScale = 1.3f, showSystemUi = true)
annotation class EchoScreenPreviews
