package app.echo.android.theme

import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import app.echo.data.model.ThemeSettings
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.theme.ThemeConfig
import app.echo.data.model.ThemeMode as DataThemeMode
import app.echo.designsystem.theme.ThemeMode as UiThemeMode

/** Stored theme settings → the design system's [ThemeConfig] (the only place the two meet). */
fun ThemeSettings.toThemeConfig(): ThemeConfig = ThemeConfig(
    mode = when (mode) {
        DataThemeMode.SYSTEM -> UiThemeMode.SYSTEM
        DataThemeMode.LIGHT -> UiThemeMode.LIGHT
        DataThemeMode.DARK -> UiThemeMode.DARK
    },
    dynamicColor = dynamicColor,
    pureBlack = pureBlack,
    seed = Color(seedColor.toInt()),
    dynamicPlayerColor = dynamicPlayerColor,
    animations = animations,
)

/** [ThemeConfig] edits from the UI → stored settings (keeps the fields the design system doesn't know). */
fun ThemeSettings.with(config: ThemeConfig): ThemeSettings = copy(
    mode = when (config.mode) {
        UiThemeMode.SYSTEM -> DataThemeMode.SYSTEM
        UiThemeMode.LIGHT -> DataThemeMode.LIGHT
        UiThemeMode.DARK -> DataThemeMode.DARK
    },
    dynamicColor = config.dynamicColor,
    pureBlack = config.pureBlack,
    seedColor = config.seed.toArgb().toLong() and 0xFFFFFFFFL,
    dynamicPlayerColor = config.dynamicPlayerColor,
    animations = config.animations,
)

/**
 * [EchoTheme] from stored settings, plus system bars that follow the resolved dark mode (design.md §7.3): status and
 * navigation bar icons stay readable after a switch, without a restart.
 */
@Composable
fun ComponentActivity.AppTheme(settings: ThemeSettings, content: @Composable () -> Unit) {
    val config = settings.toThemeConfig()
    val dark = config.mode.isDark(isSystemInDarkTheme())
    LaunchedEffect(dark) {
        val style = SystemBarStyle.auto(Color.Transparent.toArgb(), Color.Transparent.toArgb()) { dark }
        enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
    }
    EchoTheme(config, content)
}
