package app.echo.designsystem.component.echo

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/** Where the player sheet rests. */
enum class PlayerSheetValue { Hidden, Collapsed, Expanded }

/**
 * State of the [PlayerSheet]: a single offset fraction (0 = expanded, 1 = collapsed, 2 = hidden) animated with the
 * motion scheme's default spatial spring. Hoist it in the shell so the back button can collapse the player.
 */
@Stable
class PlayerSheetState internal constructor(initial: PlayerSheetValue, private val scope: CoroutineScope) {
    internal val position = Animatable(initial.position)

    val currentValue: PlayerSheetValue
        get() = when {
            position.value <= 0.5f -> PlayerSheetValue.Expanded
            position.value <= 1.5f -> PlayerSheetValue.Collapsed
            else -> PlayerSheetValue.Hidden
        }

    /** 0 when collapsed, 1 when expanded: drives the mini ↔ full cross-fade. */
    val expandFraction: Float get() = (1f - position.value).coerceIn(0f, 1f)

    internal var spec: androidx.compose.animation.core.AnimationSpec<Float> = androidx.compose.animation.core.spring()

    fun animateTo(value: PlayerSheetValue) {
        scope.launch { position.animateTo(value.position, spec) }
    }

    fun expand() = animateTo(PlayerSheetValue.Expanded)
    fun collapse() = animateTo(PlayerSheetValue.Collapsed)
    fun hide() = animateTo(PlayerSheetValue.Hidden)

    internal fun settle(velocityPerHeight: Float) {
        val p = position.value
        val target = when {
            velocityPerHeight < -1.5f -> if (p > 1f) PlayerSheetValue.Collapsed else PlayerSheetValue.Expanded
            velocityPerHeight > 1.5f -> if (p < 1f) PlayerSheetValue.Collapsed else PlayerSheetValue.Hidden
            p < 0.5f -> PlayerSheetValue.Expanded
            p < 1.5f -> PlayerSheetValue.Collapsed
            else -> PlayerSheetValue.Hidden
        }
        animateTo(target)
    }

    private val PlayerSheetValue.position: Float
        get() = when (this) {
            PlayerSheetValue.Expanded -> 0f
            PlayerSheetValue.Collapsed -> 1f
            PlayerSheetValue.Hidden -> 2f
        }
}

@Composable
fun rememberPlayerSheetState(initial: PlayerSheetValue = PlayerSheetValue.Collapsed): PlayerSheetState {
    val scope = rememberCoroutineScope()
    return remember { PlayerSheetState(initial, scope) }
}

/**
 * The player (Figma "Echo · Mini player (Bottom sheet, collapsed)" ↔ 1.8 Full player, design.md §8.3): one
 * draggable sheet. Collapsed it shows [miniPlayer] [collapsedBottom] above the bottom of the screen (above the
 * navigation bar); expanded it fills the screen with [fullPlayer]. Drag up to expand, down to collapse, and down
 * again on the mini player to hide (stop). Put it last in the shell's Box so it draws on top.
 */
@Composable
fun PlayerSheet(
    state: PlayerSheetState,
    miniPlayer: @Composable () -> Unit,
    fullPlayer: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    collapsedBottom: Dp = 0.dp,
    collapsedHeight: Dp = MiniPlayerHeight,
) {
    state.spec = MaterialTheme.motionScheme.defaultSpatialSpec()
    val scope = rememberCoroutineScope()
    BoxWithConstraints(modifier.fillMaxSize()) {
        val density = LocalDensity.current
        val fullPx = with(density) { maxHeight.toPx() }
        val collapsedTop = with(density) { (maxHeight - collapsedBottom - collapsedHeight).toPx() }
        // position 0 → top 0, 1 → collapsedTop, 2 → off screen
        fun topFor(p: Float) = if (p <= 1f) collapsedTop * p else collapsedTop + (fullPx - collapsedTop) * (p - 1f)
        var dragStartTop by remember { mutableFloatStateOf(0f) }
        val draggable = Modifier.draggable(
            state = rememberDraggableState { delta ->
                val p = state.position.value
                val top = topFor(p) + delta
                val next = if (top <= collapsedTop) top / collapsedTop else 1f + (top - collapsedTop) / (fullPx - collapsedTop)
                scope.launch { state.position.snapTo(next.coerceIn(0f, 2f)) }
            },
            orientation = Orientation.Vertical,
            onDragStarted = { dragStartTop = topFor(state.position.value) },
            onDragStopped = { velocity -> state.settle(velocity / fullPx) },
        )
        val p = state.position.value
        val top = topFor(p)
        val expand = state.expandFraction
        Box(
            Modifier
                .offset { IntOffset(0, top.roundToInt()) }
                .fillMaxWidth()
                .then(draggable),
        ) {
            if (expand > 0f) {
                Surface(Modifier.fillMaxSize().graphicsLayer { alpha = expand }, color = MaterialTheme.colorScheme.surface) {
                    fullPlayer()
                }
            }
            if (expand < 1f) {
                Box(Modifier.fillMaxWidth().graphicsLayer { alpha = 1f - expand }, contentAlignment = Alignment.TopCenter) {
                    miniPlayer()
                }
            }
        }
    }
}

/** Mini player height in Figma (62 dp row + 22 dp progress). */
val MiniPlayerHeight = 84.dp
