package app.echo.designsystem.component.m3e

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.ListItemShapes
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.Modifier
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.preview.PreviewData
import app.echo.designsystem.tokens.EchoSpacing
import androidx.compose.material3.SegmentedListItem as M3SegmentedListItem

/**
 * Expressive segmented list (Figma "M3E · List (Expressive, segmented)", 36 screens): tiles on
 * surfaceContainerLow, 2 dp apart, 20 dp outer corners and 4 dp inner corners.
 *
 * ```
 * SegmentedList {
 *     item { SegmentedListItem(headline = "…", onClick = {}) }
 * }
 * ```
 */
@Composable
fun SegmentedList(
    modifier: Modifier = Modifier,
    content: SegmentedListScope.() -> Unit,
) {
    val scope = SegmentedListScope().apply(content)
    Column(
        modifier = modifier.padding(horizontal = EchoSpacing.screenMargin),
        verticalArrangement = Arrangement.spacedBy(EchoSpacing.segmentedGap),
    ) {
        scope.items.forEachIndexed { index, item ->
            val shapes = ListItemDefaults.segmentedShapes(index = index, count = scope.items.size)
            CompositionLocalProvider(LocalSegmentShapes provides shapes) { item() }
        }
    }
}

class SegmentedListScope internal constructor() {
    internal val items = mutableListOf<@Composable () -> Unit>()

    fun item(content: @Composable () -> Unit) {
        items += content
    }
}

private val LocalSegmentShapes = compositionLocalOf<ListItemShapes?> { null }

/**
 * One tile of a [SegmentedList]. [selected] non-null makes it single-select (primaryContainer when selected,
 * emphasized headline). Outside a SegmentedList it is a lone tile with all corners rounded.
 */
@Composable
fun SegmentedListItem(
    headline: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    supporting: String? = null,
    overline: String? = null,
    selected: Boolean? = null,
    enabled: Boolean = true,
    onLongClick: (() -> Unit)? = null,
    leading: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
) {
    val shapes = LocalSegmentShapes.current ?: ListItemDefaults.segmentedShapes(index = 0, count = 1)
    val colors = ListItemDefaults.segmentedColors(
        containerColor = MaterialTheme.colorScheme.surfaceContainerLow,
        selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
        selectedContentColor = MaterialTheme.colorScheme.onPrimaryContainer,
    )
    val headlineStyle = if (selected == true) MaterialTheme.typography.titleMediumEmphasized else MaterialTheme.typography.titleMedium
    val supportingContent: (@Composable () -> Unit)? = supporting?.let { { Text(it, maxLines = 2) } }
    val overlineContent: (@Composable () -> Unit)? = overline?.let { { Text(it) } }
    val headlineContent: @Composable () -> Unit = { Text(headline, style = headlineStyle, maxLines = 2) }
    if (selected == null) {
        M3SegmentedListItem(
            onClick = onClick,
            shapes = shapes,
            modifier = modifier,
            enabled = enabled,
            leadingContent = leading,
            trailingContent = trailing,
            overlineContent = overlineContent,
            supportingContent = supportingContent,
            onLongClick = onLongClick,
            colors = colors,
            content = headlineContent,
        )
    } else {
        M3SegmentedListItem(
            selected = selected,
            onClick = onClick,
            shapes = shapes,
            modifier = modifier,
            enabled = enabled,
            leadingContent = leading,
            trailingContent = trailing,
            overlineContent = overlineContent,
            supportingContent = supportingContent,
            onLongClick = onLongClick,
            colors = colors,
            content = headlineContent,
        )
    }
}

@EchoPreviews
@Composable
private fun SegmentedListPreview() = EchoThemesPreview {
    SegmentedList {
        PreviewData.tracks.forEachIndexed { i, (title, artist, duration) ->
            item {
                SegmentedListItem(
                    headline = title,
                    supporting = "$artist · $duration",
                    selected = if (i == 1) true else null,
                    onClick = {},
                    trailing = { EchoIconButton(EchoIcons.MoreVert, "More", {}) },
                )
            }
        }
    }
}
