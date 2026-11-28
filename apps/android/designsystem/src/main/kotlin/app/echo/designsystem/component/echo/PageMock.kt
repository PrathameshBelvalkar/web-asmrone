package app.echo.designsystem.component.echo

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.theme.BaselineLightColorScheme
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.tokens.EchoSpacing

/** The paper border round a [PageMock], as a fraction of its shorter side: what the reader's "Crop borders" trims. */
const val PageMockMargin = 0.03f

/**
 * A manga page stand-in (Figma "Panel 1…5" page mocks in 2.5–2.10): five outlined panels with two speech bubbles,
 * until the sources give real page images. Scales to any size (reader page, thumbnail, end-of-gallery stack).
 */
@Composable
fun PageMock(modifier: Modifier = Modifier) {
    // A page is an image of paper, not UI: always the light baseline greys with dark ink (Figma draws it light even
    // in the dark reader).
    val page = BaselineLightColorScheme
    val paper = page.surfaceContainerLowest
    val panelA = page.surfaceContainerHigh
    val panelB = page.surfaceContainer
    val ink = page.onSurface
    Canvas(modifier) {
        drawRect(paper)
        val m = size.minDimension * PageMockMargin
        val stroke = (size.minDimension * 0.008f).coerceAtLeast(1f)
        val w = size.width - 2 * m
        val h = size.height - 2 * m
        val rowH = (h - 2 * m) / 3
        fun panel(x: Float, y: Float, pw: Float, ph: Float, fill: androidx.compose.ui.graphics.Color) {
            drawRect(fill, Offset(x, y), Size(pw, ph))
            drawRect(ink, Offset(x, y), Size(pw, ph), style = Stroke(stroke))
        }
        // Row 1: one wide panel. Row 2: 55 / 45. Row 3: 40 / 60 (Figma "Page" mock).
        panel(m, m, w, rowH, panelA)
        val y2 = m + rowH + m
        panel(m, y2, w * 0.55f - m / 2, rowH, panelB)
        panel(m + w * 0.55f + m / 2, y2, w * 0.45f - m / 2, rowH, panelA)
        val y3 = y2 + rowH + m
        panel(m, y3, w * 0.4f - m / 2, rowH, panelB)
        panel(m + w * 0.4f + m / 2, y3, w * 0.6f - m / 2, rowH, panelA)
        // Speech bubbles in panels 2 and 5.
        val bw = w * 0.2f
        val bh = rowH * 0.16f
        listOf(Offset(m * 2, y2 + m), Offset(m + w * 0.4f + m * 1.5f, y3 + m)).forEach { o ->
            drawOval(paper, o, Size(bw, bh))
            drawOval(ink, o, Size(bw, bh), style = Stroke(stroke))
        }
    }
}

@EchoPreviews
@Composable
private fun PageMockPreview() = EchoThemesPreview {
    Row(Modifier.padding(horizontal = EchoSpacing.screenMargin)) {
        PageMock(Modifier.width(140.dp).aspectRatio(0.7f))
        PageMock(Modifier.padding(start = EchoSpacing.m).width(48.dp).aspectRatio(0.7f))
    }
}
