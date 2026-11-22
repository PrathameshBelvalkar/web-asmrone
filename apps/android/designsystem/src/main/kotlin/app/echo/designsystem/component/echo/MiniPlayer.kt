package app.echo.designsystem.component.echo

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.LinearWavyProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import app.echo.designsystem.R
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.component.m3e.IconButtonShape
import app.echo.designsystem.component.m3e.IconButtonStyle
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.preview.PreviewData
import app.echo.designsystem.tokens.EchoElevation
import app.echo.designsystem.tokens.EchoSizes
import app.echo.designsystem.tokens.EchoSpacing

/**
 * The collapsed player (Figma "Echo · Mini player (Bottom sheet, collapsed)", 15 screens): cover, title, artist,
 * square filled play/pause, next, and a wavy progress line. extraLarge shape on surfaceContainer, level 3,
 * 12 dp from the screen edges. Tapping it opens 1.8 Full player.
 */
@Composable
fun MiniPlayer(
    title: String,
    artist: String,
    cover: Any?,
    isPlaying: Boolean,
    progress: () -> Float,
    onPlayPause: () -> Unit,
    onNext: () -> Unit,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        onClick = onClick,
        modifier = modifier.fillMaxWidth().padding(horizontal = EchoSpacing.m),
        shape = MaterialTheme.shapes.extraLarge,
        color = MaterialTheme.colorScheme.surfaceContainer,
        shadowElevation = EchoElevation.level3,
    ) {
        Column {
            Row(
                Modifier.padding(start = EchoSpacing.s, end = EchoSpacing.s, top = EchoSpacing.s),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(EchoSpacing.m),
            ) {
                CoverImage(cover, contentDescription = null, modifier = Modifier.size(EchoSizes.minTouchTarget), shape = MaterialTheme.shapes.medium)
                Column(Modifier.weight(1f)) {
                    Text(title, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(
                        artist,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                EchoIconButton(
                    icon = if (isPlaying) EchoIcons.PauseFilled else EchoIcons.PlayArrowFilled,
                    contentDescription = stringResource(if (isPlaying) R.string.echo_cd_pause else R.string.echo_cd_play),
                    onClick = onPlayPause,
                    style = IconButtonStyle.Filled,
                    shape = IconButtonShape.Square,
                )
                EchoIconButton(EchoIcons.SkipNextFilled, stringResource(R.string.echo_cd_next), onNext)
            }
            LinearWavyProgressIndicator(
                progress = progress,
                modifier = Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.l, vertical = EchoSpacing.s),
            )
        }
    }
}

@EchoPreviews
@Composable
private fun MiniPlayerPreview() = EchoThemesPreview {
    MiniPlayer(
        title = PreviewData.TRACK, artist = PreviewData.ARTIST, cover = null, isPlaying = false, progress = { 0.35f },
        onPlayPause = {}, onNext = {}, onClick = {},
    )
}
