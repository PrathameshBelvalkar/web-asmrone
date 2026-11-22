package app.echo.designsystem.component.echo

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.theme.EchoShapes
import app.echo.designsystem.tokens.EchoSpacing

/** One lyric line: time label ("1:42"), the (translated) text, and the Japanese original under it. */
data class LyricLine(val time: String, val text: String, val original: String? = null)

/**
 * Synced lyrics (Figma "Echo · Synced lyrics", 1.10): the current line is titleLarge emphasized with a primary bar on
 * its left; past lines fade to 35%, coming lines to 50%. The list keeps the current line near the top as it
 * changes. Tap a line to seek to it.
 */
@Composable
fun SyncedLyrics(
    lines: List<LyricLine>,
    current: Int,
    onLineClick: (Int) -> Unit,
    modifier: Modifier = Modifier,
    showOriginal: Boolean = true,
    showTranslation: Boolean = true,
) {
    val listState = rememberLazyListState()
    LaunchedEffect(current) { if (current >= 0) listState.animateScrollToItem((current - 1).coerceAtLeast(0)) }
    LazyColumn(
        modifier = modifier,
        state = listState,
        contentPadding = PaddingValues(horizontal = EchoSpacing.sectionPadding, vertical = EchoSpacing.xl),
        verticalArrangement = Arrangement.spacedBy(EchoSpacing.xl),
    ) {
        itemsIndexed(lines) { index, line ->
            val isCurrent = index == current
            val alpha = when {
                isCurrent -> 1f
                index < current -> 0.35f
                else -> 0.5f
            }
            Row(
                Modifier.fillMaxWidth().height(IntrinsicSize.Min).alpha(alpha).clickable { onLineClick(index) },
                horizontalArrangement = Arrangement.spacedBy(EchoSpacing.m),
            ) {
                if (isCurrent) {
                    Box(Modifier.width(4.dp).fillMaxHeight().clip(EchoShapes.Full).background(MaterialTheme.colorScheme.primary))
                }
                Column(verticalArrangement = Arrangement.spacedBy(EchoSpacing.xs)) {
                    Text(line.time, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (showTranslation) {
                        Text(
                            line.text,
                            style = if (isCurrent) MaterialTheme.typography.headlineSmallEmphasized else MaterialTheme.typography.titleLarge,
                            color = if (isCurrent) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    if (showOriginal && line.original != null) {
                        Text(
                            line.original,
                            style = if (isCurrent) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}

internal val PreviewLyrics = listOf(
    LyricLine("1:12", "Good evening… you came back.", "おかえりなさい…"),
    LyricLine("1:31", "Lie down. I’ll start on your right side.", "横になって。右からね。"),
    LyricLine("1:42", "Close your eyes for me.", "目を閉じて。"),
    LyricLine("1:50", "(soft brushing)"),
    LyricLine("2:05", "That’s it… just breathe.", "そう…ゆっくり息して。"),
)

@EchoPreviews
@Composable
private fun SyncedLyricsPreview() = EchoThemesPreview {
    SyncedLyrics(PreviewLyrics, current = 2, onLineClick = {}, modifier = Modifier.height(520.dp))
}
