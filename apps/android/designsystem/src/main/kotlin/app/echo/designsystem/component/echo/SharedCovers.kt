package app.echo.designsystem.component.echo

import androidx.compose.animation.AnimatedVisibilityScope
import androidx.compose.animation.ExperimentalSharedTransitionApi
import androidx.compose.animation.SharedTransitionScope
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect

/** The shell's [SharedTransitionScope] around the NavHost; null in previews and tests. */
@OptIn(ExperimentalSharedTransitionApi::class)
val LocalSharedTransitionScope = staticCompositionLocalOf<SharedTransitionScope?> { null }

/** The current destination's enter / exit animation; each NavHost destination provides it. */
val LocalNavAnimatedScope = staticCompositionLocalOf<AnimatedVisibilityScope?> { null }

/**
 * Phase 12 shared-element transition for a cover: a card's cover and the same item's cover on its page share [key]
 * ("work-RJ01234560"), so the cover moves and resizes between them with the slow spatial spring. A no-op where
 * there's no shared scope (previews, tests) or no key.
 */
@OptIn(ExperimentalSharedTransitionApi::class, ExperimentalMaterial3ExpressiveApi::class)
@Composable
fun sharedCover(key: String?): Modifier {
    val shared = LocalSharedTransitionScope.current
    val animated = LocalNavAnimatedScope.current
    if (key == null || shared == null || animated == null) return Modifier
    val spec = MaterialTheme.motionScheme.slowSpatialSpec<Rect>()
    return with(shared) {
        Modifier.sharedElement(
            sharedContentState = rememberSharedContentState(key),
            animatedVisibilityScope = animated,
            boundsTransform = { _, _ -> spec },
        )
    }
}

/** Keys shared by a card and its page. */
object CoverKeys {
    fun work(id: String) = "work-$id"
    fun gallery(id: String) = "gallery-$id"
    fun movie(id: String) = "movie-$id"
    fun title(id: String) = "hentai-$id"
}
