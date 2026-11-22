package app.echo.designsystem.theme

import android.graphics.Bitmap
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import coil3.SingletonImageLoader
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.request.allowHardware
import coil3.toBitmap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import androidx.compose.ui.graphics.Color
import androidx.palette.graphics.Palette

/** Figma's example cover seed for the dynamic player colour (DS · Colour › Theme modes). Previews only. */
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

/**
 * The seed colour of [cover] for [PlayerTheme], or null while it loads, when it fails, or when there is no cover
 * (then the player keeps the app colours). Loads through Coil off the main thread.
 */
@Composable
fun rememberCoverSeed(cover: Any?): Color? {
    val context = LocalContext.current
    val seed by produceState<Color?>(initialValue = null, cover) {
        value = if (cover == null) {
            null
        } else {
            withContext(Dispatchers.Default) {
                runCatching {
                    val request = ImageRequest.Builder(context).data(cover).allowHardware(false).size(COVER_SAMPLE_PX).build()
                    val result = SingletonImageLoader.get(context).execute(request) as? SuccessResult
                    result?.image?.toBitmap()?.let(::seedFromCover)
                }.getOrNull()
            }
        }
    }
    return seed
}

private const val COVER_SAMPLE_PX = 128

/** The seed colour of a cover: vibrant swatch first, then dominant. Run off the main thread. */
fun seedFromCover(cover: Bitmap): Color? {
    val palette = Palette.from(cover).maximumColorCount(16).generate()
    val swatch = palette.vibrantSwatch ?: palette.dominantSwatch ?: return null
    return Color(swatch.rgb)
}
