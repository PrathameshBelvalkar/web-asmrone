package app.echo.designsystem.theme

import android.app.UiModeManager
import android.content.Context
import android.os.Build
import android.provider.Settings
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.AnimationSpec
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialExpressiveTheme
import androidx.compose.material3.MotionScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalInspectionMode

/** What the theme resolved to, for components that need it (e.g. the pure black switch, system bars). */
@Immutable
data class EchoThemeState(val config: ThemeConfig, val isDark: Boolean)

val LocalEchoTheme = staticCompositionLocalOf { EchoThemeState(ThemeConfig(), isDark = false) }

/**
 * The Echo theme: M3 Expressive with the DS colour, type, shape and motion (design.md §6, §7).
 * Every colour role animates with the motion scheme's effects spec, so a theme switch fades.
 */
@Composable
fun EchoTheme(
    config: ThemeConfig = ThemeConfig(),
    content: @Composable () -> Unit,
) {
    val context = LocalContext.current
    val inPreview = LocalInspectionMode.current
    val dark = config.mode.isDark(isSystemInDarkTheme())
    val contrast = remember(context) { if (inPreview) 0.0 else systemContrast(context) }
    val target = resolveColorScheme(
        config = config,
        dark = dark,
        dynamicScheme = { d -> if (inPreview) null else dynamicSchemeOrNull(context, d) },
        contrastLevel = contrast,
    )
    val reduceMotion = !config.animations || (!inPreview && systemAnimationsOff(context))
    val motion: MotionScheme = if (reduceMotion) ReducedMotionScheme else EchoMotionScheme

    CompositionLocalProvider(LocalEchoTheme provides EchoThemeState(config, dark)) {
        MaterialExpressiveTheme(
            colorScheme = target.animated(motion.defaultEffectsSpec()),
            motionScheme = motion,
            shapes = EchoMaterialShapes,
            typography = EchoTypography,
            content = content,
        )
    }
}

/** Shorthand used by previews and screenshot tests. */
@Composable
fun EchoTheme(darkTheme: Boolean, dynamicColor: Boolean = false, pureBlack: Boolean = false, content: @Composable () -> Unit) =
    EchoTheme(
        config = ThemeConfig(
            mode = if (darkTheme) ThemeMode.DARK else ThemeMode.LIGHT,
            dynamicColor = dynamicColor,
            pureBlack = pureBlack,
        ),
        content = content,
    )

private fun dynamicSchemeOrNull(context: Context, dark: Boolean): ColorScheme? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
    } else {
        null
    }

/** System contrast (Android 14+): 0 standard, up to 1 high. Passed to seed schemes; dynamic ones follow it already. */
private fun systemContrast(context: Context): Double =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        context.getSystemService(UiModeManager::class.java)?.contrast?.toDouble()?.coerceIn(0.0, 1.0) ?: 0.0
    } else {
        0.0
    }

private fun systemAnimationsOff(context: Context): Boolean =
    Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f

/** Animates every role of the scheme towards this one. */
@Composable
private fun ColorScheme.animated(spec: AnimationSpec<Color>): ColorScheme {
    @Composable
    fun Color.a() = animateColorAsState(this, spec, label = "colour").value
    return copy(
        primary = primary.a(), onPrimary = onPrimary.a(),
        primaryContainer = primaryContainer.a(), onPrimaryContainer = onPrimaryContainer.a(),
        inversePrimary = inversePrimary.a(),
        secondary = secondary.a(), onSecondary = onSecondary.a(),
        secondaryContainer = secondaryContainer.a(), onSecondaryContainer = onSecondaryContainer.a(),
        tertiary = tertiary.a(), onTertiary = onTertiary.a(),
        tertiaryContainer = tertiaryContainer.a(), onTertiaryContainer = onTertiaryContainer.a(),
        background = background.a(), onBackground = onBackground.a(),
        surface = surface.a(), onSurface = onSurface.a(),
        surfaceVariant = surfaceVariant.a(), onSurfaceVariant = onSurfaceVariant.a(),
        surfaceTint = surfaceTint.a(),
        inverseSurface = inverseSurface.a(), inverseOnSurface = inverseOnSurface.a(),
        error = error.a(), onError = onError.a(),
        errorContainer = errorContainer.a(), onErrorContainer = onErrorContainer.a(),
        outline = outline.a(), outlineVariant = outlineVariant.a(),
        scrim = scrim.a(),
        surfaceBright = surfaceBright.a(), surfaceDim = surfaceDim.a(),
        surfaceContainer = surfaceContainer.a(),
        surfaceContainerHigh = surfaceContainerHigh.a(), surfaceContainerHighest = surfaceContainerHighest.a(),
        surfaceContainerLow = surfaceContainerLow.a(), surfaceContainerLowest = surfaceContainerLowest.a(),
    )
}
