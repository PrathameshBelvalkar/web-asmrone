package app.echo.designsystem.component.m3e

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyGridScope
import androidx.compose.foundation.lazy.grid.LazyGridState
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.echo.designsystem.component.echo.GalleryCard
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.tokens.EchoSpacing

/**
 * A grid of covers (Figma "M3E · Grid of Cards (… · 3 columns)", "Grid of page thumbnails"): fixed columns,
 * 12 dp between columns, 16 dp between rows, screen margins. 3 columns for galleries and hentai titles, 2 for
 * JAV movies, 4 for page thumbnails. Put [header] items (shelf headers, chips) above with `item(span = …)`.
 */
@Composable
fun CoverGrid(
    columns: Int,
    modifier: Modifier = Modifier,
    state: LazyGridState = rememberLazyGridState(),
    contentPadding: PaddingValues = PaddingValues(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.s),
    content: LazyGridScope.() -> Unit,
) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(columns),
        modifier = modifier,
        state = state,
        contentPadding = contentPadding,
        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.coverRowGap),
        verticalArrangement = Arrangement.spacedBy(EchoSpacing.l),
        content = content,
    )
}

@EchoPreviews
@Composable
private fun CoverGridPreview() = EchoThemesPreview {
    CoverGrid(columns = 3, modifier = Modifier.height(460.dp)) {
        items(6) { i ->
            GalleryCard("Gallery title placeholder that wraps", "Artist Name", image = null, onClick = {}, pages = 24 + i, language = "JP")
        }
    }
}
