package app.echo.designsystem.component.echo

import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import app.echo.designsystem.tokens.EchoSpacing
import kotlin.math.roundToInt

/** What a first-run tip points at (O.9). */
enum class TipTarget { SOURCE, SEARCH, PROFILE }

/**
 * Where the tip targets are on screen. The search app bar reports them (see [tipAnchor]); the shell reads them to
 * draw the tour. Empty while no section Home is showing.
 */
@Stable
class TipAnchors {
    private val rects = mutableStateMapOf<TipTarget, Rect>()
    operator fun get(target: TipTarget): Rect? = rects[target]
    fun put(target: TipTarget, rect: Rect) { rects[target] = rect }
    fun clear() = rects.clear()
}

/** The shell's [TipAnchors]; null where there's no tour (previews, tests). */
val LocalTipAnchors = staticCompositionLocalOf<TipAnchors?> { null }

/** Reports this element's bounds as [target]'s anchor. */
fun Modifier.tipAnchor(anchors: TipAnchors?, target: TipTarget): Modifier =
    if (anchors == null) this else onGloballyPositioned { anchors.put(target, it.boundsInRoot()) }

/** Long-pressing the source pill (O.9 "Long-press for source settings"); the shell opens Settings. */
val LocalSourceLongPress = staticCompositionLocalOf<(() -> Unit)?> { null }

/** One tour step: what it points at, its title and body. */
data class TourStep(val target: TipTarget, val title: String, val body: String)

/**
 * O.9 First-run tip (Figma 29:28321): a scrim with a ringed hole around [anchor], and a card under it with the
 * step's title and body, "1 of 3", Skip tips · Next (Got it on the last step). Tapping the scrim skips;
 * tapping the highlighted target runs [onTarget].
 */
@Composable
fun FirstRunTour(
    step: TourStep,
    anchor: Rect,
    index: Int,
    count: Int,
    progressLabel: String,
    skipLabel: String,
    nextLabel: String,
    onSkip: () -> Unit,
    onNext: () -> Unit,
    modifier: Modifier = Modifier,
    /** Tapping the highlighted target (Figma: the tip → 0.1): it does its own job and the tour ends. */
    onTarget: () -> Unit = onSkip,
) {
    val density = LocalDensity.current
    val ringColor = MaterialTheme.colorScheme.surface
    val pad = with(density) { HOLE_PADDING.toPx() }
    val hole = Rect(anchor.left - pad, anchor.top - pad, anchor.right + pad, anchor.bottom + pad)
    BoxWithConstraints(
        modifier.fillMaxSize().testTag("overlay:O.9")
            .pointerInput(hole) { detectTapGestures { at -> if (hole.contains(at)) onTarget() else onSkip() } },
    ) {
        Canvas(Modifier.fillMaxSize().graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }) {
            drawRect(Color.Black.copy(alpha = SCRIM_ALPHA))
            val radius = CornerRadius(hole.height / 2, hole.height / 2)
            drawRoundRect(Color.Transparent, hole.topLeft, hole.size, radius, blendMode = BlendMode.Clear)
            drawRoundRect(ringColor, hole.topLeft, hole.size, radius, style = Stroke(RING_WIDTH.toPx()))
        }
        val cardWidth = with(density) { (maxWidth - EchoSpacing.screenMargin * 2).coerceAtMost(CARD_MAX_WIDTH).toPx() }
        val margin = with(density) { EchoSpacing.screenMargin.toPx() }
        val screenWidth = with(density) { maxWidth.toPx() }
        // Under the anchor, lined up with it, kept on screen.
        val x = hole.left.coerceIn(margin, (screenWidth - margin - cardWidth).coerceAtLeast(margin))
        val y = hole.bottom + with(density) { EchoSpacing.s.toPx() }
        Surface(
            shape = MaterialTheme.shapes.large,
            color = MaterialTheme.colorScheme.surfaceContainerLowest,
            shadowElevation = 6.dp,
            modifier = Modifier.offset { IntOffset(x.roundToInt(), y.roundToInt()) }
                .widthIn(max = with(density) { cardWidth.toDp() })
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {},
        ) {
            Column(Modifier.padding(start = EchoSpacing.l, end = EchoSpacing.s, top = EchoSpacing.l, bottom = EchoSpacing.xs)) {
                Text(step.title, style = MaterialTheme.typography.titleMediumEmphasized, modifier = Modifier.padding(end = EchoSpacing.s))
                Text(
                    step.body,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = EchoSpacing.xs, end = EchoSpacing.s),
                )
                Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    Text(progressLabel, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.weight(1f))
                    if (index < count - 1) TextButton(onClick = onSkip) { Text(skipLabel) }
                    TextButton(onClick = onNext) { Text(nextLabel) }
                }
            }
        }
    }
}

private const val SCRIM_ALPHA = 0.5f
private val HOLE_PADDING = 4.dp
private val RING_WIDTH = 3.dp
private val CARD_MAX_WIDTH = 312.dp
