package app.echo.designsystem.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color
import com.materialkolor.PaletteStyle
import com.materialkolor.dynamicColorScheme

/*
 * Figma 5 · Design system › DS · Colour (21:29040).
 * The roles in the Figma table are written out exactly. Roles the table doesn't list (secondary, tertiary,
 * surfaceDim …) keep the Compose defaults, which are the same M3 baseline scheme (seed #6750A4).
 */

/** Baseline light scheme, DS · Colour "Light" column. */
val BaselineLightColorScheme: ColorScheme = lightColorScheme(
    primary = Color(0xFF6750A4),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFEADDFF),
    onPrimaryContainer = Color(0xFF21005D),
    secondaryContainer = Color(0xFFE8DEF8),
    onSecondaryContainer = Color(0xFF1D192B),
    tertiaryContainer = Color(0xFFFFD8E4),
    error = Color(0xFFB3261E),
    background = Color(0xFFFEF7FF),
    surface = Color(0xFFFEF7FF),
    onSurface = Color(0xFF1D1B20),
    onBackground = Color(0xFF1D1B20),
    onSurfaceVariant = Color(0xFF49454F),
    surfaceContainerLow = Color(0xFFF7F2FA),
    surfaceContainer = Color(0xFFF3EDF7),
    surfaceContainerHigh = Color(0xFFECE6F0),
    surfaceContainerHighest = Color(0xFFE6E0E9),
    outline = Color(0xFF79747E),
    outlineVariant = Color(0xFFCAC4D0),
    inverseSurface = Color(0xFF322F35),
    scrim = Color(0xFF000000),
)

/** Baseline dark scheme, DS · Colour "Dark" column. */
val BaselineDarkColorScheme: ColorScheme = darkColorScheme(
    primary = Color(0xFFD0BCFF),
    onPrimary = Color(0xFF381E72),
    primaryContainer = Color(0xFF4F378B),
    onPrimaryContainer = Color(0xFFEADDFF),
    secondaryContainer = Color(0xFF4A4458),
    onSecondaryContainer = Color(0xFFE8DEF8),
    tertiaryContainer = Color(0xFF633B48),
    error = Color(0xFFF2B8B5),
    background = Color(0xFF141218),
    surface = Color(0xFF141218),
    onSurface = Color(0xFFE6E0E9),
    onBackground = Color(0xFFE6E0E9),
    onSurfaceVariant = Color(0xFFCAC4D0),
    surfaceContainerLow = Color(0xFF1D1B20),
    surfaceContainer = Color(0xFF211F26),
    surfaceContainerHigh = Color(0xFF2B2930),
    surfaceContainerHighest = Color(0xFF36343B),
    outline = Color(0xFF938F99),
    outlineVariant = Color(0xFF49454F),
    inverseSurface = Color(0xFFE6E0E9),
    scrim = Color(0xFF000000),
)

/** Pure black (AMOLED): background and surface #000000. Containers stay lifted so cards still separate. */
fun ColorScheme.pureBlack(): ColorScheme = copy(
    background = Color.Black,
    surface = Color.Black,
    surfaceDim = Color.Black,
)

/**
 * A full scheme from one seed colour (dynamic colour off or Android < 12, any seed but the baseline one;
 * also the player colours). [contrastLevel] follows the system: 0 standard, 0.5 medium, 1 high.
 */
fun schemeFromSeed(seed: Color, dark: Boolean, contrastLevel: Double = 0.0): ColorScheme =
    dynamicColorScheme(
        seedColor = seed,
        isDark = dark,
        isAmoled = false,
        style = PaletteStyle.TonalSpot,
        contrastLevel = contrastLevel,
    )

/**
 * Picks the colour scheme. Pure and unit-tested (design.md §7.3, §12.1). Order: dynamic → seed → pure black.
 *
 * @param dynamicScheme the wallpaper scheme for [dark], or null when the device has none (Android < 12).
 */
fun resolveColorScheme(
    config: ThemeConfig,
    dark: Boolean,
    dynamicScheme: (dark: Boolean) -> ColorScheme?,
    contrastLevel: Double = 0.0,
): ColorScheme {
    val base = (if (config.dynamicColor) dynamicScheme(dark) else null)
        ?: when {
            config.seed == BaselineSeed && contrastLevel == 0.0 ->
                if (dark) BaselineDarkColorScheme else BaselineLightColorScheme
            else -> schemeFromSeed(config.seed, dark, contrastLevel)
        }
    return if (dark && config.pureBlack) base.pureBlack() else base
}
