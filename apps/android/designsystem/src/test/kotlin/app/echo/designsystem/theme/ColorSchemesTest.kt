package app.echo.designsystem.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertSame
import org.junit.Test

/** design.md §12.1 › Theme. */
class ColorSchemesTest {

    private val wallpaper = BaselineLightColorScheme.copy(primary = Color(0xFF00897B))
    private val wallpaperDark = BaselineDarkColorScheme.copy(primary = Color(0xFF4DB6AC))
    private val dynamic: (Boolean) -> ColorScheme? = { dark -> if (dark) wallpaperDark else wallpaper }
    private val noDynamic: (Boolean) -> ColorScheme? = { null }

    @Test
    fun `dynamic on uses the wallpaper scheme`() {
        val scheme = resolveColorScheme(ThemeConfig(dynamicColor = true), dark = false, dynamicScheme = dynamic)
        assertSame(wallpaper, scheme)
    }

    @Test
    fun `dynamic on without wallpaper colours falls back to the seed`() {
        val scheme = resolveColorScheme(ThemeConfig(dynamicColor = true), dark = false, dynamicScheme = noDynamic)
        assertSame(BaselineLightColorScheme, scheme)
    }

    @Test
    fun `dynamic off with the baseline seed is the exact Figma table`() {
        val light = resolveColorScheme(ThemeConfig(dynamicColor = false), dark = false, dynamicScheme = dynamic)
        val dark = resolveColorScheme(ThemeConfig(dynamicColor = false), dark = true, dynamicScheme = dynamic)
        // DS · Colour (21:29040), role by role.
        val figma = listOf(
            Triple("primary", light.primary to dark.primary, 0xFF6750A4 to 0xFFD0BCFF),
            Triple("onPrimary", light.onPrimary to dark.onPrimary, 0xFFFFFFFF to 0xFF381E72),
            Triple("primaryContainer", light.primaryContainer to dark.primaryContainer, 0xFFEADDFF to 0xFF4F378B),
            Triple("onPrimaryContainer", light.onPrimaryContainer to dark.onPrimaryContainer, 0xFF21005D to 0xFFEADDFF),
            Triple("secondaryContainer", light.secondaryContainer to dark.secondaryContainer, 0xFFE8DEF8 to 0xFF4A4458),
            Triple("onSecondaryContainer", light.onSecondaryContainer to dark.onSecondaryContainer, 0xFF1D192B to 0xFFE8DEF8),
            Triple("tertiaryContainer", light.tertiaryContainer to dark.tertiaryContainer, 0xFFFFD8E4 to 0xFF633B48),
            Triple("error", light.error to dark.error, 0xFFB3261E to 0xFFF2B8B5),
            Triple("surface", light.surface to dark.surface, 0xFFFEF7FF to 0xFF141218),
            Triple("onSurface", light.onSurface to dark.onSurface, 0xFF1D1B20 to 0xFFE6E0E9),
            Triple("onSurfaceVariant", light.onSurfaceVariant to dark.onSurfaceVariant, 0xFF49454F to 0xFFCAC4D0),
            Triple("surfaceContainerLow", light.surfaceContainerLow to dark.surfaceContainerLow, 0xFFF7F2FA to 0xFF1D1B20),
            Triple("surfaceContainer", light.surfaceContainer to dark.surfaceContainer, 0xFFF3EDF7 to 0xFF211F26),
            Triple("surfaceContainerHigh", light.surfaceContainerHigh to dark.surfaceContainerHigh, 0xFFECE6F0 to 0xFF2B2930),
            Triple("surfaceContainerHighest", light.surfaceContainerHighest to dark.surfaceContainerHighest, 0xFFE6E0E9 to 0xFF36343B),
            Triple("outline", light.outline to dark.outline, 0xFF79747E to 0xFF938F99),
            Triple("outlineVariant", light.outlineVariant to dark.outlineVariant, 0xFFCAC4D0 to 0xFF49454F),
            Triple("inverseSurface", light.inverseSurface to dark.inverseSurface, 0xFF322F35 to 0xFFE6E0E9),
            Triple("scrim", light.scrim to dark.scrim, 0xFF000000 to 0xFF000000),
        )
        figma.forEach { (role, actual, expected) ->
            assertEquals("$role light", Color(expected.first), actual.first)
            assertEquals("$role dark", Color(expected.second), actual.second)
        }
    }

    @Test
    fun `pure black sets surface and background to black in dark`() {
        val config = ThemeConfig(dynamicColor = false, pureBlack = true)
        val scheme = resolveColorScheme(config, dark = true, dynamicScheme = noDynamic)
        assertEquals(Color.Black, scheme.surface)
        assertEquals(Color.Black, scheme.background)
        // Containers stay lifted so cards still separate.
        assertEquals(BaselineDarkColorScheme.surfaceContainer, scheme.surfaceContainer)
    }

    @Test
    fun `pure black applies on top of dynamic colour`() {
        val config = ThemeConfig(dynamicColor = true, pureBlack = true)
        val scheme = resolveColorScheme(config, dark = true, dynamicScheme = dynamic)
        assertEquals(wallpaperDark.primary, scheme.primary)
        assertEquals(Color.Black, scheme.surface)
    }

    @Test
    fun `pure black is ignored in light`() {
        val config = ThemeConfig(dynamicColor = false, pureBlack = true)
        val scheme = resolveColorScheme(config, dark = false, dynamicScheme = noDynamic)
        assertSame(BaselineLightColorScheme, scheme)
    }

    @Test
    fun `a custom seed gives a different primary`() {
        val config = ThemeConfig(dynamicColor = false, seed = Color(0xFF2E7D32))
        val scheme = resolveColorScheme(config, dark = false, dynamicScheme = dynamic)
        assertNotEquals(BaselineLightColorScheme.primary, scheme.primary)
    }

    @Test
    fun `the seed is ignored while dynamic colour is on`() {
        val config = ThemeConfig(dynamicColor = true, seed = Color(0xFF2E7D32))
        assertSame(wallpaper, resolveColorScheme(config, dark = false, dynamicScheme = dynamic))
    }

    @Test
    fun `theme mode resolves against the system`() {
        assertEquals(true, ThemeMode.SYSTEM.isDark(systemDark = true))
        assertEquals(false, ThemeMode.SYSTEM.isDark(systemDark = false))
        assertEquals(false, ThemeMode.LIGHT.isDark(systemDark = true))
        assertEquals(true, ThemeMode.DARK.isDark(systemDark = false))
    }
}
