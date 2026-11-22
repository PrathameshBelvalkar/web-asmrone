package app.echo.designsystem.component.m3e

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Badge
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.tokens.EchoSpacing

/** What a badge marks. */
enum class BadgeStyle {
    /** NEW / BETA / UNCENSORED: tertiaryContainer. */
    Accent,

    /** Counts and filter totals: error / onError (M3 default). */
    Count,

    /** Over a cover (pages, language, EP 1): inverse surface so it reads on any image. */
    Overlay,
}

/** Large badge with text (Figma "M3E · Badge (Large) — …", 12 screens). */
@Composable
fun CoverBadge(text: String, modifier: Modifier = Modifier, style: BadgeStyle = BadgeStyle.Overlay) {
    val colors = MaterialTheme.colorScheme
    val (container, content) = when (style) {
        BadgeStyle.Accent -> colors.tertiaryContainer to colors.onTertiaryContainer
        BadgeStyle.Count -> colors.error to colors.onError
        BadgeStyle.Overlay -> colors.inverseSurface to colors.inverseOnSurface
    }
    Badge(modifier = modifier, containerColor = container, contentColor = content) {
        Text(text, style = MaterialTheme.typography.labelSmall)
    }
}

@EchoPreviews
@Composable
private fun CoverBadgePreview() = EchoThemesPreview {
    Row(Modifier.padding(horizontal = EchoSpacing.screenMargin), horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
        CoverBadge("NEW", style = BadgeStyle.Accent)
        CoverBadge("BETA", style = BadgeStyle.Accent)
        CoverBadge("3", style = BadgeStyle.Count)
        CoverBadge("24p")
        CoverBadge("JP")
    }
}
