package app.echo.designsystem.theme

import android.graphics.Bitmap
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.palette.graphics.Palette

/** Figma's example cover seed for the dynamic player colour (DS · Colour › Theme modes). */
val SamplePlayerSeed = Color(0xFF904A43)

/**
 * Dynamic player colour: the player sheet only (design.md §7.2). Cover → Palette → seed → scheme,
 * in its own MaterialTheme. Off ([ThemeConfig.dynamicPlayerColor]) or no seed → the app theme as is.
 */
@Composable
fun PlayerTheme(seed: Color?, content: @Composable () -> Unit) {
    val state = LocalEchoTheme.current
    if (seed == null || !state.config.dynamicPlayerColor) {
        content()
        return
    }
    val scheme = remember(seed, state.isDark, state.config.pureBlack) {
        schemeFromSeed(seed, state.isDark).let { if (state.isDark && state.config.pureBlack) it.pureBlack() else it }
    }
    MaterialTheme(
        colorScheme = scheme,
        motionScheme = MaterialTheme.motionScheme,
        shapes = MaterialTheme.shapes,
        typography = MaterialTheme.typography,
        content = content,
    )
}

/** The seed colour of a cover: vibrant swatch first, then dominant. Run off the main thread. */
fun seedFromCover(cover: Bitmap): Color? {
    val palette = Palette.from(cover).maximumColorCount(16).generate()
    val swatch = palette.vibrantSwatch ?: palette.dominantSwatch ?: return null
    return Color(swatch.rgb)
}
