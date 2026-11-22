package app.echo.designsystem.component.echo

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.echo.designsystem.R
import app.echo.designsystem.component.m3e.CarouselStyle
import app.echo.designsystem.component.m3e.ComponentSize
import app.echo.designsystem.component.m3e.CoverCarousel
import app.echo.designsystem.component.m3e.EchoFloatingToolbar
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.component.m3e.HeroCarouselItem
import app.echo.designsystem.component.m3e.IconButtonStyle
import app.echo.designsystem.component.m3e.SegmentedListItem
import app.echo.designsystem.component.m3e.ToolbarAction
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoScreenPreviews
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.tokens.EchoSpacing

/** What the full player shows. */
data class NowPlayingUi(
    val title: String,
    val artists: String,
    val meta: String,
    val playingFrom: String,
    val source: String,
    val covers: List<Any?>,
    val coverIndex: Int,
    val liked: Boolean,
    val nextTitle: String?,
    val speed: String,
    val playback: PlaybackUi,
)

/** Player pages selectable from the floating toolbar (1.8 / 1.9 / 1.10). */
enum class PlayerPage { NowPlaying, UpNext, Lyrics }

/**
 * The body of 1.8 Full player: centered small app bar (collapse, "PLAYING FROM …", more), the hero cover
 * carousel (swipe for previous / next), title / artists / meta + like, [PlayerControls], the "Next" tile and the
 * floating toolbar (Up next · Lyrics · Sleep · speed). Used as `fullPlayer` of [PlayerSheet].
 */
@Composable
fun FullPlayer(
    state: NowPlayingUi,
    actions: PlaybackActions,
    onCollapse: () -> Unit,
    onMore: () -> Unit,
    onLike: () -> Unit,
    onPage: (PlayerPage) -> Unit,
    onSleep: () -> Unit,
    onSpeed: () -> Unit,
    modifier: Modifier = Modifier,
    labels: FullPlayerLabels = FullPlayerLabels(),
) {
    Column(modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.xs), verticalAlignment = Alignment.CenterVertically) {
            EchoIconButton(EchoIcons.ExpandMore, stringResource(R.string.echo_cd_close), onCollapse)
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(state.playingFrom.uppercase(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(state.source, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
            }
            EchoIconButton(EchoIcons.MoreVert, stringResource(R.string.echo_cd_more), onMore)
        }
        CoverCarousel(
            count = state.covers.size.coerceAtLeast(1),
            style = CarouselStyle.Hero,
            height = 340.dp,
            initialItem = state.coverIndex,
            modifier = Modifier.padding(vertical = EchoSpacing.s),
        ) { i -> HeroCarouselItem(title = "", image = state.covers.getOrNull(i), onClick = {}) }
        Row(
            Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.sectionPadding),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(EchoSpacing.xxs)) {
                Text(state.title, style = MaterialTheme.typography.headlineSmallEmphasized, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text(state.artists, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                Text(state.meta, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
            }
            LikeButton(liked = state.liked, onToggle = onLike)
        }
        PlayerControls(state.playback, actions, Modifier.padding(top = EchoSpacing.m))
        Box(Modifier.weight(1f))
        if (state.nextTitle != null) {
            SegmentedListItem(
                headline = state.nextTitle,
                overline = labels.next,
                onClick = { onPage(PlayerPage.UpNext) },
                modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin),
                leading = { CoverImage(null, null, Modifier.size(40.dp), shape = MaterialTheme.shapes.small) },
                trailing = { EchoIconButton(EchoIcons.DragHandle, stringResource(R.string.echo_cd_reorder), {}) },
            )
        }
        Box(Modifier.fillMaxWidth().padding(vertical = EchoSpacing.m), contentAlignment = Alignment.Center) {
            EchoFloatingToolbar {
                ToolbarAction(labels.upNext, EchoIcons.QueueMusic, { onPage(PlayerPage.UpNext) }, selected = true)
                ToolbarAction(labels.lyrics, EchoIcons.Chat, { onPage(PlayerPage.Lyrics) })
                ToolbarAction(labels.sleep, EchoIcons.Timer, onSleep)
                ToolbarAction(state.speed, EchoIcons.Speed, onSpeed)
            }
        }
    }
}

/** Visible labels of the full player; the app passes its string resources. */
data class FullPlayerLabels(
    val next: String = "Next",
    val upNext: String = "Up next",
    val lyrics: String = "Lyrics",
    val sleep: String = "Sleep",
)

internal val PreviewNowPlaying = NowPlayingUi(
    title = "Ear cleaning (left → right)",
    artists = "Circle Aoi · Aoi Mizuno",
    meta = "Track 2 of 12 · Binaural",
    playingFrom = "Playing from work",
    source = "Whispered bedtime story",
    covers = listOf(null, null, null),
    coverIndex = 1,
    liked = true,
    nextTitle = "03 · Rain and heartbeat",
    speed = "1.0×",
    playback = PreviewPlayback.copy(isPlaying = false),
)

@EchoScreenPreviews
@Composable
private fun FullPlayerPreview() = EchoTheme(darkTheme = false) {
    androidx.compose.material3.Surface {
        FullPlayer(PreviewNowPlaying, NoPlaybackActions, {}, {}, {}, {}, {}, {})
    }
}
