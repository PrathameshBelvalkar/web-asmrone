package app.echo.designsystem.component.echo

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import app.echo.designsystem.R
import app.echo.designsystem.component.m3e.ComponentSize
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.component.m3e.IconButtonShape
import app.echo.designsystem.component.m3e.IconButtonStyle
import app.echo.designsystem.component.m3e.IconButtonWidth
import app.echo.designsystem.component.m3e.SeekSlider
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.tokens.EchoSpacing

/** State the player controls show. Times are preformatted ("1:42", "−16:58"). */
data class PlaybackUi(
    val isPlaying: Boolean,
    val progress: Float,
    val elapsed: String,
    val remaining: String,
    val shuffle: Boolean = false,
    val repeat: Boolean = false,
)

/** What the player controls can ask for. */
data class PlaybackActions(
    val onPlayPause: () -> Unit,
    val onPrevious: () -> Unit,
    val onNext: () -> Unit,
    val onSeek: (Float) -> Unit,
    val onShuffle: () -> Unit,
    val onRepeat: () -> Unit,
)

/**
 * Seek slider, elapsed / remaining, and the transport row: shuffle · previous (tonal, wide) · play/pause (filled,
 * wide, square) · next · repeat. [large] is the full player (1.8, L play button); otherwise the compact version
 * (Figma "Echo · Player controls (compact)", 1.10 Lyrics, M play button).
 */
@Composable
fun PlayerControls(
    state: PlaybackUi,
    actions: PlaybackActions,
    modifier: Modifier = Modifier,
    large: Boolean = true,
) {
    Column(modifier.fillMaxWidth()) {
        SeekSlider(
            progress = { state.progress }, onSeek = actions.onSeek, animateWave = state.isPlaying,
            modifier = Modifier.padding(horizontal = EchoSpacing.sheetPadding),
        )
        Row(Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.sheetPadding)) {
            Time(state.elapsed)
            Row(Modifier.weight(1f)) {}
            Time(state.remaining)
        }
        Row(
            Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.s, vertical = EchoSpacing.s),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            EchoIconButton(
                EchoIcons.Shuffle, stringResource(R.string.echo_cd_shuffle), actions.onShuffle,
                checked = state.shuffle,
            )
            EchoIconButton(
                EchoIcons.SkipPreviousFilled, stringResource(R.string.echo_cd_previous), actions.onPrevious,
                style = IconButtonStyle.Tonal, size = ComponentSize.M,
            )
            EchoIconButton(
                icon = if (state.isPlaying) EchoIcons.PauseFilled else EchoIcons.PlayArrowFilled,
                contentDescription = stringResource(if (state.isPlaying) R.string.echo_cd_pause else R.string.echo_cd_play),
                onClick = actions.onPlayPause,
                style = IconButtonStyle.Filled,
                size = if (large) ComponentSize.L else ComponentSize.M,
                shape = IconButtonShape.Square,
                width = IconButtonWidth.Wide,
            )
            EchoIconButton(
                EchoIcons.SkipNextFilled, stringResource(R.string.echo_cd_next), actions.onNext,
                style = IconButtonStyle.Tonal, size = ComponentSize.M,
            )
            EchoIconButton(EchoIcons.Repeat, stringResource(R.string.echo_cd_repeat), actions.onRepeat, checked = state.repeat)
        }
    }
}

@Composable
private fun Time(text: String) =
    Text(text, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)

internal val PreviewPlayback = PlaybackUi(isPlaying = true, progress = 0.42f, elapsed = "7:42", remaining = "−10:58")
internal val NoPlaybackActions = PlaybackActions({}, {}, {}, {}, {}, {})

@EchoPreviews
@Composable
private fun PlayerControlsPreview() = EchoThemesPreview {
    PlayerControls(PreviewPlayback.copy(isPlaying = false), NoPlaybackActions)
    PlayerControls(PreviewPlayback.copy(isPlaying = false, repeat = true), NoPlaybackActions, large = false)
}
