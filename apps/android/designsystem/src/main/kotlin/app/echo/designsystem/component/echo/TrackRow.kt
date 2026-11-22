package app.echo.designsystem.component.echo

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import app.echo.designsystem.R
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.component.m3e.SegmentedList
import app.echo.designsystem.component.m3e.SegmentPosition
import app.echo.designsystem.component.m3e.SegmentedListItem
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.preview.PreviewData
import app.echo.designsystem.tokens.EchoSizes

/**
 * A track in an ASMR list (Figma "List item/01 · Opening, whispered"): thumbnail, title, "artist · duration",
 * more button. The playing track is selected (primaryContainer, emphasized title) with an equalizer icon.
 * Use inside a [SegmentedList].
 */
@Composable
fun TrackRow(
    title: String,
    artist: String,
    duration: String,
    cover: Any?,
    playing: Boolean,
    onClick: () -> Unit,
    onMore: () -> Unit,
    modifier: Modifier = Modifier,
    position: SegmentPosition? = null,
    trailing: (@Composable () -> Unit)? = null,
) {
    SegmentedListItem(
        headline = title,
        supporting = "$artist · $duration",
        selected = if (playing) true else null,
        onClick = onClick,
        modifier = modifier,
        position = position,
        leading = {
            CoverImage(cover, contentDescription = null, modifier = Modifier.size(EchoSizes.minTouchTarget), shape = MaterialTheme.shapes.small)
        },
        trailing = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (playing) {
                    Icon(painterResource(EchoIcons.GraphicEq), contentDescription = null, modifier = Modifier.size(EchoSizes.iconSmall))
                }
                if (trailing != null) trailing() else EchoIconButton(EchoIcons.MoreVert, stringResource(R.string.echo_cd_more), onMore)
            }
        },
    )
}

@EchoPreviews
@Composable
private fun TrackRowPreview() = EchoThemesPreview {
    SegmentedList {
        PreviewData.tracks.forEachIndexed { i, (title, artist, duration) ->
            item { TrackRow(title, artist, duration, cover = null, playing = i == 0, onClick = {}, onMore = {}) }
        }
    }
}
