package app.echo.android.theme

import androidx.compose.ui.graphics.Color
import app.echo.data.model.ThemeMode
import app.echo.data.model.ThemeSettings
import app.echo.designsystem.theme.BaselineSeed
import app.echo.designsystem.theme.ThemeConfig
import org.junit.Assert.assertEquals
import org.junit.Test
import app.echo.designsystem.theme.ThemeMode as UiThemeMode

/** Stored theme settings ↔ the design system's ThemeConfig. */
class ThemeMappingTest {
    @Test
    fun `defaults map to the design system defaults`() {
        assertEquals(ThemeConfig(), ThemeSettings().toThemeConfig())
        assertEquals(BaselineSeed, ThemeSettings().toThemeConfig().seed)
    }

    @Test
    fun `every field maps`() {
        val config = ThemeSettings(
            mode = ThemeMode.DARK, dynamicColor = false, pureBlack = true, seedColor = 0xFF2E7D32,
            dynamicPlayerColor = false, animations = false,
        ).toThemeConfig()
        assertEquals(UiThemeMode.DARK, config.mode)
        assertEquals(false, config.dynamicColor)
        assertEquals(true, config.pureBlack)
        assertEquals(Color(0xFF2E7D32), config.seed)
        assertEquals(false, config.dynamicPlayerColor)
        assertEquals(false, config.animations)
    }

    @Test
    fun `UI edits round-trip and keep fields the design system doesn't know`() {
        val stored = ThemeSettings(biggerCovers = true, blurredPlayerBackground = false)
        val edited = stored.toThemeConfig().copy(mode = UiThemeMode.LIGHT, seed = Color(0xFF2E7D32))
        val back = stored.with(edited)
        assertEquals(ThemeMode.LIGHT, back.mode)
        assertEquals(0xFF2E7D32, back.seedColor)
        assertEquals(true, back.biggerCovers)
        assertEquals(false, back.blurredPlayerBackground)
        assertEquals(edited, back.toThemeConfig())
    }
}
