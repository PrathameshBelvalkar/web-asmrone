package app.echo.designsystem.component.echo

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.echo.designsystem.component.m3e.UncontainedItemWidth
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.preview.PreviewData
import app.echo.designsystem.tokens.EchoSpacing

/**
 * A cover with a title and a meta line, for shelves and grids (Figma "Carousel item" in uncontained carousels).
 * [aspectRatio] is width / height: 1 for ASMR and galleries, 2/3 for hentai titles, 16/9 for JAV movies.
 */
@Composable
fun CoverCard(
    title: String,
    meta: String?,
    image: Any?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    width: Dp = UncontainedItemWidth,
    aspectRatio: Float = 1f,
    overlay: (@Composable () -> Unit)? = null,
) {
    Column(
        modifier.width(width).clickable(onClick = onClick),
        verticalArrangement = Arrangement.spacedBy(EchoSpacing.xs),
    ) {
        androidx.compose.foundation.layout.Box {
            CoverImage(image, contentDescription = null, modifier = Modifier.fillMaxWidth().aspectRatio(aspectRatio))
            overlay?.invoke()
        }
        CardText(title, meta)
    }
}

/**
 * [CoverCard] with a progress line under the cover: "Continue listening / reading / watching"
 * (Figma 1.1 "M3E · Carousel (Uncontained)" items).
 */
@Composable
fun ContinueCard(
    title: String,
    meta: String?,
    progress: Float,
    image: Any?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    width: Dp = UncontainedItemWidth,
    aspectRatio: Float = 1f,
) {
    Column(
        modifier.width(width).clickable(onClick = onClick),
        verticalArrangement = Arrangement.spacedBy(EchoSpacing.s - EchoSpacing.xxs),
    ) {
        CoverImage(image, contentDescription = null, modifier = Modifier.fillMaxWidth().aspectRatio(aspectRatio))
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier.fillMaxWidth().height(EchoSpacing.xs),
            strokeCap = StrokeCap.Round,
            gapSize = 0.dp,
            drawStopIndicator = {},
        )
        CardText(title, meta)
    }
}

@Composable
private fun CardText(title: String, meta: String?) {
    Column {
        Text(title, style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
        if (meta != null) {
            Text(
                meta,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@EchoPreviews
@Composable
private fun CardsPreview() = EchoThemesPreview {
    Row(Modifier.padding(horizontal = EchoSpacing.screenMargin), horizontalArrangement = Arrangement.spacedBy(EchoSpacing.coverRowGap)) {
        val (title, meta, progress) = PreviewData.continueItems[0]
        ContinueCard(title, meta, progress, image = null, onClick = {})
        CoverCard("Rain on a tin roof", PreviewData.ARTIST, image = null, onClick = {})
        CoverCard("Title", "12.3K views", image = null, onClick = {}, width = 96.dp, aspectRatio = 2f / 3f)
    }
}
