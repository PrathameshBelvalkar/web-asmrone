package app.echo.designsystem.component.echo

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.tokens.EchoElevation
import app.echo.designsystem.tokens.EchoSpacing

/** Figma "Echo · Media header" (square cover, 1.5 Work) or "(gallery)" (2:3 cover with a shadow, 2.5 Gallery). */
enum class MediaHeaderStyle { Square, Gallery }

/**
 * The top of a work / gallery page: cover on the left, title (headlineSmall), artist and meta lines on the right.
 * The chips, button group or split button under it are separate components the screen places.
 */
@Composable
fun MediaHeader(
    title: String,
    artist: String?,
    meta: List<String>,
    cover: Any?,
    modifier: Modifier = Modifier,
    style: MediaHeaderStyle = MediaHeaderStyle.Square,
    onArtistClick: (() -> Unit)? = null,
) {
    Row(
        modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin),
        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.l),
    ) {
        when (style) {
            MediaHeaderStyle.Square -> CoverImage(cover, null, Modifier.size(148.dp), shape = MaterialTheme.shapes.extraLarge)
            MediaHeaderStyle.Gallery -> CoverImage(
                cover, null,
                Modifier.size(132.dp, 188.dp).shadow(EchoElevation.level3, MaterialTheme.shapes.largeIncreased),
                shape = MaterialTheme.shapes.largeIncreased,
            )
        }
        Column(Modifier.weight(1f).padding(top = EchoSpacing.s), verticalArrangement = Arrangement.spacedBy(EchoSpacing.xs)) {
            Text(title, style = MaterialTheme.typography.headlineSmallEmphasized, maxLines = 4, overflow = TextOverflow.Ellipsis)
            if (artist != null) {
                Text(
                    artist,
                    style = MaterialTheme.typography.titleSmall,
                    modifier = if (onArtistClick != null) Modifier.clickable(onClick = onArtistClick) else Modifier,
                )
            }
            meta.forEach {
                Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@EchoPreviews
@Composable
private fun MediaHeaderPreview() = EchoThemesPreview {
    MediaHeader("Whispered bedtime story — rain & heartbeat", "Circle Aoi", listOf("RJ01234567 · 12 tracks · 2h 14m"), null)
    MediaHeader(
        "Gallery title placeholder that can wrap onto lines", "Artist Name",
        listOf("52 pages · Japanese · Doujinshi", "Added 2026-11-18"), null, style = MediaHeaderStyle.Gallery,
    )
}
