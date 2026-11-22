package app.echo.designsystem.theme

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

/** Light / Dark / follow the system. Figma DS · Colour › Theme modes. */
enum class ThemeMode {
    SYSTEM,
    LIGHT,
    DARK,
    ;

    fun isDark(systemDark: Boolean): Boolean = when (this) {
        SYSTEM -> systemDark
        LIGHT -> false
        DARK -> true
    }
}

/**
 * Everything the user can change about the look of the app (S.8 Look and feel, O.8 Make it yours).
 * Stored in DataStore from Phase 3; until then the defaults are used.
 *
 * @param dynamicColor wallpaper colours on Android 12+. The seed is ignored while it is on.
 * @param pureBlack AMOLED: background and surface #000000. Only applies when the mode resolves to dark.
 * @param seed fallback seed when dynamic colour is off or unavailable. [BaselineSeed] gives the exact Figma scheme.
 * @param dynamicPlayerColor the player sheet takes its colours from the cover ([PlayerTheme]).
 * @param animations off = reduced motion ([ReducedMotionScheme]). The system animator scale 0 also turns it off.
 */
@Immutable
data class ThemeConfig(
    val mode: ThemeMode = ThemeMode.SYSTEM,
    val dynamicColor: Boolean = true,
    val pureBlack: Boolean = false,
    val seed: Color = BaselineSeed,
    val dynamicPlayerColor: Boolean = true,
    val animations: Boolean = true,
)

/** The M3 baseline seed. Figma's whole DS · Colour table is generated from it. */
val BaselineSeed = Color(0xFF6750A4)
