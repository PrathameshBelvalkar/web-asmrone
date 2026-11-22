package app.echo.designsystem.component.m3e

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.theme.EchoShapes
import app.echo.designsystem.tokens.EchoSpacing

/**
 * Dots under a pager (Figma "M3E · Page indicator", O.2–O.4): the current page is a 24 × 8 primary pill, the others
 * 8 dp outlineVariant dots, 6 dp apart. Animates with the fast spatial spring.
 */
@Composable
fun PageIndicator(count: Int, current: Int, modifier: Modifier = Modifier) {
    Row(
        modifier.semantics { contentDescription = "Page ${current + 1} of $count" },
        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s - EchoSpacing.xxs),
    ) {
        repeat(count) { index ->
            val selected = index == current
            val width by animateDpAsState(if (selected) 24.dp else 8.dp, MaterialTheme.motionScheme.fastSpatialSpec(), label = "dot")
            val color by animateColorAsState(
                if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant,
                MaterialTheme.motionScheme.fastEffectsSpec<Color>(),
                label = "dotColor",
            )
            Box(Modifier.width(width).height(8.dp).clip(EchoShapes.Full).background(color))
        }
    }
}

@EchoPreviews
@Composable
private fun PageIndicatorPreview() = EchoThemesPreview {
    Row(Modifier.then(Modifier), horizontalArrangement = Arrangement.spacedBy(EchoSpacing.xxxl)) {
        Box(Modifier.width(EchoSpacing.screenMargin))
        PageIndicator(3, 0)
        PageIndicator(3, 2)
    }
}
