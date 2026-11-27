package app.echo.designsystem.component.echo

import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.tokens.EchoSpacing
import coil3.compose.SubcomposeAsyncImage

/**
 * A cover with a shape (Figma: every "Cover", "Thumbnail", "Art" box). With no image, or while loading, it shows
 * Figma's placeholder: surfaceContainerHighest with a thin cross in outlineVariant.
 *
 * @param image anything Coil can load (URL, Uri, File …), or null for the placeholder.
 * @param shape the clip shape; null when the parent already clips (carousel mask).
 */
@Composable
fun CoverImage(
    image: Any?,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    shape: Shape? = MaterialTheme.shapes.large,
    onClick: (() -> Unit)? = null,
) {
    var m = modifier
    // The placeholder has no image to describe: the description goes on the cover itself.
    if (contentDescription != null) m = m.semantics { this.contentDescription = contentDescription }
    if (shape != null) m = m.clip(shape)
    if (onClick != null) m = m.clickable(onClick = onClick)
    if (image == null) {
        CoverPlaceholder(m)
    } else {
        SubcomposeAsyncImage(
            model = image,
            contentDescription = contentDescription,
            modifier = m,
            contentScale = ContentScale.Crop,
            loading = { CoverPlaceholder(Modifier.fillMaxSize()) },
            error = { CoverPlaceholder(Modifier.fillMaxSize()) },
        )
    }
}

@Composable
private fun CoverPlaceholder(modifier: Modifier) {
    val line = MaterialTheme.colorScheme.outlineVariant
    Box(modifier.background(MaterialTheme.colorScheme.surfaceContainerHighest)) {
        Canvas(Modifier.fillMaxSize()) {
            val stroke = 1.dp.toPx()
            drawLine(line, Offset.Zero, Offset(size.width, size.height), stroke)
            drawLine(line, Offset(size.width, 0f), Offset(0f, size.height), stroke)
        }
    }
}

@EchoPreviews
@Composable
private fun CoverImagePreview() = EchoThemesPreview {
    Row(Modifier.padding(horizontal = EchoSpacing.screenMargin)) {
        CoverImage(null, null, Modifier.size(96.dp))
        CoverImage(null, null, Modifier.padding(start = EchoSpacing.m).size(48.dp), shape = MaterialTheme.shapes.small)
        CoverImage(null, null, Modifier.padding(start = EchoSpacing.m).size(72.dp, 108.dp), shape = MaterialTheme.shapes.medium)
    }
}

