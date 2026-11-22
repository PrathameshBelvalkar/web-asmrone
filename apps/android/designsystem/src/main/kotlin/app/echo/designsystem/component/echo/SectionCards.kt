package app.echo.designsystem.component.echo

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.echo.designsystem.component.m3e.BadgeStyle
import app.echo.designsystem.component.m3e.CoverBadge
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.theme.EchoShapes
import app.echo.designsystem.tokens.EchoSizes
import app.echo.designsystem.tokens.EchoSpacing

/** Cover + title + meta, filling its grid cell or [width]. Shared by the section cards below. */
@Composable
private fun SectionCard(
    title: String,
    meta: String?,
    image: Any?,
    aspectRatio: Float,
    onClick: () -> Unit,
    modifier: Modifier,
    width: Dp?,
    titleLines: Int = 1,
    overlay: @Composable BoxScope.() -> Unit = {},
) {
    Column(
        (if (width != null) modifier.width(width) else modifier.fillMaxWidth()).clickable(onClick = onClick),
        verticalArrangement = Arrangement.spacedBy(EchoSpacing.xs),
    ) {
        Box {
            CoverImage(image, contentDescription = null, modifier = Modifier.fillMaxWidth().aspectRatio(aspectRatio))
            overlay()
        }
        Column {
            Text(title, style = MaterialTheme.typography.titleSmall, maxLines = titleLines, overflow = TextOverflow.Ellipsis)
            if (meta != null) {
                Text(
                    meta, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

/** Manga gallery card (Figma "Gallery card", 2.1 / 2.2 / 2.4): 2:3 cover with page-count and language badges. */
@Composable
fun GalleryCard(
    title: String,
    artist: String?,
    image: Any?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    pages: Int? = null,
    language: String? = null,
    width: Dp? = null,
) = SectionCard(title, artist, image, 2f / 3f, onClick, modifier, width) {
    Row(Modifier.align(Alignment.TopStart).padding(EchoSpacing.s - EchoSpacing.xxs), horizontalArrangement = Arrangement.spacedBy(EchoSpacing.xs)) {
        if (pages != null) CoverBadge("${pages}p")
        if (language != null) CoverBadge(language)
    }
}

/** Hentai title card (Figma "Echo · HanimeCard (2:3 cover)", 41 uses): 2:3 cover, NEW badge, view count pill. */
@Composable
fun HanimeCard(
    title: String,
    meta: String?,
    image: Any?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    views: String? = null,
    isNew: Boolean = false,
    width: Dp? = 112.dp,
) = SectionCard(title, meta, image, 2f / 3f, onClick, modifier, width) {
    if (isNew) CoverBadge("NEW", Modifier.align(Alignment.TopStart).padding(EchoSpacing.s - EchoSpacing.xxs), BadgeStyle.Accent)
    if (views != null) {
        Surface(
            modifier = Modifier.align(Alignment.BottomStart).padding(EchoSpacing.s - EchoSpacing.xxs),
            shape = EchoShapes.Full,
            color = MaterialTheme.colorScheme.surfaceContainerHighest,
        ) {
            Row(
                Modifier.padding(horizontal = EchoSpacing.s - EchoSpacing.xxs, vertical = EchoSpacing.xxs),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(EchoSpacing.xs),
            ) {
                Icon(painterResource(EchoIcons.Visibility), null, Modifier.size(12.dp))
                Text(views, style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

/** JAV movie card (3.3–3.5, 2 columns): 16:10 cover, the movie code as a badge, title over two lines. */
@Composable
fun MovieCard(
    code: String,
    title: String,
    meta: String?,
    image: Any?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    width: Dp? = null,
) = SectionCard(title, meta, image, 16f / 10f, onClick, modifier, width, titleLines = 2) {
    CoverBadge(code, Modifier.align(Alignment.TopStart).padding(EchoSpacing.s - EchoSpacing.xxs))
}

/** JAV idol card (3.8 Idols): round photo, name and count under it, centered. */
@Composable
fun IdolCard(
    name: String,
    meta: String?,
    image: Any?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    width: Dp = EchoSizes.avatarArtist,
) {
    Column(
        modifier.width(width).clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(EchoSpacing.xs),
    ) {
        CoverImage(image, contentDescription = null, modifier = Modifier.size(width), shape = EchoShapes.Full)
        Text(name, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
        if (meta != null) {
            Text(meta, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
        }
    }
}

@EchoPreviews
@Composable
private fun SectionCardsPreview() = EchoThemesPreview {
    Row(Modifier.padding(horizontal = EchoSpacing.screenMargin), horizontalArrangement = Arrangement.spacedBy(EchoSpacing.coverRowGap)) {
        GalleryCard("Gallery title placeholder", "Artist Name", null, {}, pages = 24, language = "JP", width = 112.dp)
        HanimeCard("Title placeholder 1", "Studio Name · 2025", null, {}, views = "1.6M", isNew = true)
        IdolCard("Aoi Mizuno", "128 movies", null, {})
    }
    MovieCard("ABC-101", "Movie title placeholder that wraps", "2026-11-18", null, {}, Modifier.padding(horizontal = EchoSpacing.screenMargin), width = 190.dp)
}
