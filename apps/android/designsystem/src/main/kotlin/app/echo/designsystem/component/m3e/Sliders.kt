package app.echo.designsystem.component.m3e

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RangeSlider
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.SliderState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import app.echo.designsystem.R
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.theme.EchoShapes
import app.echo.designsystem.tokens.EchoSizes
import app.echo.designsystem.tokens.EchoSpacing
import kotlin.math.PI
import kotlin.math.roundToInt
import kotlin.math.sin

/** Figma slider track sizes: XS (16 dp track, seek and page sliders) and the default S. */
enum class SliderSize { XS, S }

/**
 * Standard M3 Expressive slider (Figma "M3E · Slider (Standard, XS)", "(… with stops)"): 44 dp handle, a 16 dp track
 * at [SliderSize.XS]. [steps] adds stops (reader page slider).
 */
@Composable
fun EchoSlider(
    value: Float,
    onValueChange: (Float) -> Unit,
    modifier: Modifier = Modifier,
    valueRange: ClosedFloatingPointRange<Float> = 0f..1f,
    steps: Int = 0,
    size: SliderSize = SliderSize.XS,
    enabled: Boolean = true,
    onValueChangeFinished: (() -> Unit)? = null,
) {
    val state = remember(steps, valueRange) { SliderState(value, steps, valueRange) }
    state.value = value
    Slider(
        state = state,
        onValueChange = onValueChange,
        modifier = modifier,
        enabled = enabled,
        onValueChangeFinished = onValueChangeFinished,
        track = { sliderState ->
            val trackModifier = if (size == SliderSize.XS) Modifier.height(EchoSizes.sliderTrackXs) else Modifier
            if (steps > MAX_VISIBLE_STOPS) {
                // Many stops (pages, ages) would draw a dotted line; Figma shows a plain track then.
                SliderDefaults.Track(sliderState = sliderState, modifier = trackModifier, enabled = enabled, drawTick = { _, _ -> })
            } else {
                SliderDefaults.Track(sliderState = sliderState, modifier = trackModifier, enabled = enabled)
            }
        },
    )
}

/** Range slider (Figma "M3E · Slider (Range)", H.4 filters: year range). */
@Composable
fun EchoRangeSlider(
    value: ClosedFloatingPointRange<Float>,
    onValueChange: (ClosedFloatingPointRange<Float>) -> Unit,
    valueRange: ClosedFloatingPointRange<Float>,
    modifier: Modifier = Modifier,
    steps: Int = 0,
) = RangeSlider(value = value, onValueChange = onValueChange, valueRange = valueRange, steps = steps, modifier = modifier)

/**
 * The seek slider of the player (Figma "M3E · Slider (wavy active track …)", 1.8 / 1.10 / 1.11): a wavy active
 * track up to a 6 × 36 handle, then a flat 6 dp inactive track. The wave moves while [animateWave] (playing).
 * Drag or tap to seek; [onSeek] gets the new fraction when the drag ends.
 */
@Composable
fun SeekSlider(
    progress: () -> Float,
    onSeek: (Float) -> Unit,
    modifier: Modifier = Modifier,
    animateWave: Boolean = false,
) {
    val active = MaterialTheme.colorScheme.primary
    val inactive = MaterialTheme.colorScheme.secondaryContainer
    var dragFraction by remember { mutableFloatStateOf(-1f) }
    var widthPx by remember { mutableFloatStateOf(1f) }
    val currentOnSeek by rememberUpdatedState(onSeek)
    val phase = if (animateWave) {
        rememberInfiniteTransition(label = "wave").animateFloat(
            0f, 1f, infiniteRepeatable(tween(WAVE_PERIOD_MS, easing = LinearEasing)), label = "phase",
        ).value
    } else {
        0f
    }
    val description = stringResource(R.string.echo_cd_seek)
    Canvas(
        modifier
            .fillMaxWidth()
            .height(SeekHeight)
            .onSizeChanged { widthPx = it.width.toFloat().coerceAtLeast(1f) }
            .semantics {
                contentDescription = description
                progressBarRangeInfo = ProgressBarRangeInfo(progress(), 0f..1f)
                setProgress { currentOnSeek(it.coerceIn(0f, 1f)); true }
            }
            .pointerInput(Unit) { detectTapGestures { currentOnSeek((it.x / widthPx).coerceIn(0f, 1f)) } }
            .pointerInput(Unit) {
                detectHorizontalDragGestures(
                    onDragStart = { dragFraction = (it.x / widthPx).coerceIn(0f, 1f) },
                    onDragEnd = { currentOnSeek(dragFraction); dragFraction = -1f },
                    onDragCancel = { dragFraction = -1f },
                    onHorizontalDrag = { change, _ -> dragFraction = (change.position.x / widthPx).coerceIn(0f, 1f) },
                )
            },
    ) {
        val fraction = if (dragFraction >= 0f) dragFraction else progress().coerceIn(0f, 1f)
        val handleW = 6.dp.toPx()
        val gap = 6.dp.toPx()
        val stroke = 4.dp.toPx()
        val amplitude = 3.dp.toPx()
        val wavelength = 24.dp.toPx()
        val cy = size.height / 2
        val handleX = (size.width - handleW) * fraction
        val waveEnd = (handleX - gap).coerceAtLeast(0f)
        if (waveEnd > 0f) {
            val path = Path()
            var x = 0f
            path.moveTo(0f, cy)
            while (x <= waveEnd) {
                val y = cy + amplitude * sin(2 * PI * (x / wavelength - phase)).toFloat()
                path.lineTo(x, y)
                x += 2f
            }
            drawPath(path, active, style = Stroke(stroke, cap = StrokeCap.Round))
        }
        val trackStart = handleX + handleW + gap
        if (trackStart < size.width) {
            val h = 6.dp.toPx()
            drawRoundRect(inactive, Offset(trackStart, cy - h / 2), Size(size.width - trackStart, h), CornerRadius(h / 2))
        }
        drawRoundRect(active, Offset(handleX, 0f), Size(handleW, size.height), CornerRadius(handleW / 2))
    }
}

private val SeekHeight = 36.dp
private const val MAX_VISIBLE_STOPS = 10
private const val WAVE_PERIOD_MS = 1200

/**
 * Slider with a value indicator bubble and min / marker / max labels under it (Figma "M3E · Slider (Standard,
 * with value indicator) — age", O.7). [marker] is drawn as a stop on the track and labelled (e.g. 18).
 */
@Composable
fun ValueIndicatorSlider(
    value: Int,
    onValueChange: (Int) -> Unit,
    range: IntRange,
    modifier: Modifier = Modifier,
    marker: Int? = null,
    maxLabel: String = range.last.toString(),
) {
    Column(modifier) {
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val fraction = (value - range.first).toFloat() / (range.last - range.first)
            val bubbleWidth = 48.dp
            val x = (maxWidth - bubbleWidth) * fraction
            Surface(
                modifier = Modifier.offset { IntOffset(x.roundToPx(), 0) },
                shape = EchoShapes.Full,
                color = MaterialTheme.colorScheme.inverseSurface,
            ) {
                Text(
                    value.toString(),
                    style = MaterialTheme.typography.titleMediumEmphasized,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.width(bubbleWidth).padding(vertical = EchoSpacing.s),
                )
            }
        }
        EchoSlider(
            value = value.toFloat(),
            onValueChange = { onValueChange(it.roundToInt()) },
            valueRange = range.first.toFloat()..range.last.toFloat(),
            steps = range.last - range.first - 1,
            size = SliderSize.XS,
        )
        Box(Modifier.fillMaxWidth()) {
            Row(Modifier.fillMaxWidth()) {
                Text(range.first.toString(), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Box(Modifier.weight(1f))
                Text(maxLabel, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (marker != null) {
                BoxWithConstraints(Modifier.fillMaxWidth()) {
                    val f = (marker - range.first).toFloat() / (range.last - range.first)
                    Text(
                        marker.toString(),
                        style = MaterialTheme.typography.labelMedium,
                        modifier = Modifier.offset { IntOffset(((maxWidth - 16.dp) * f).roundToPx(), 0) },
                    )
                }
            }
        }
    }
}

@EchoPreviews
@Composable
private fun SlidersPreview() = EchoThemesPreview {
    Column(Modifier.padding(horizontal = EchoSpacing.screenMargin)) {
        SeekSlider(progress = { 0.4f }, onSeek = {})
        EchoSlider(0.6f, {})
        EchoSlider(34f, {}, valueRange = 1f..52f, steps = 50)
        EchoRangeSlider(1990f..2020f, {}, valueRange = 1960f..2026f)
        ValueIndicatorSlider(24, {}, 13..80, marker = 18, maxLabel = "80+")
    }
}
