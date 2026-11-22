package app.echo.android.feature.asmr.player

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import app.echo.android.R
import app.echo.android.ui.formatDuration
import app.echo.data.repository.PlaySource
import app.echo.data.repository.PlayerState
import app.echo.designsystem.component.echo.CoverImage
import app.echo.designsystem.component.echo.FullPlayer
import app.echo.designsystem.component.echo.FullPlayerLabels
import app.echo.designsystem.component.echo.LyricLine
import app.echo.designsystem.component.echo.MiniPlayer
import app.echo.designsystem.component.echo.NowPlayingUi
import app.echo.designsystem.component.echo.PlaybackActions
import app.echo.designsystem.component.echo.PlaybackUi
import app.echo.designsystem.component.echo.PlayerControls
import app.echo.designsystem.component.echo.PlayerPage
import app.echo.designsystem.component.echo.SyncedLyrics
import app.echo.designsystem.component.echo.TrackRow
import app.echo.designsystem.component.m3e.ChipRow
import app.echo.designsystem.component.m3e.ChipSpec
import app.echo.designsystem.component.m3e.ChipStyle
import app.echo.designsystem.component.m3e.ConnectedButtonGroup
import app.echo.designsystem.component.m3e.ConnectedOption
import app.echo.designsystem.component.m3e.EchoFloatingToolbar
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.component.m3e.EchoSheet
import app.echo.designsystem.component.m3e.EchoSmallAppBar
import app.echo.designsystem.component.m3e.SegmentPosition
import app.echo.designsystem.component.m3e.SegmentedList
import app.echo.designsystem.component.m3e.SegmentedListItem
import app.echo.designsystem.component.m3e.ToolbarAction
import app.echo.designsystem.component.m3e.ToolbarStyle
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.theme.PlayerTheme
import app.echo.designsystem.theme.SamplePlayerSeed
import app.echo.designsystem.tokens.EchoElevation
import app.echo.designsystem.tokens.EchoSpacing
import sh.calvin.reorderable.ReorderableItem
import sh.calvin.reorderable.rememberReorderableLazyListState

/** What the player pages can ask the shell for. */
class PlayerNav(
    val collapse: () -> Unit,
    val openPage: (PlayerPage) -> Unit,
    val openMore: () -> Unit,
    val goToWork: (String) -> Unit,
    val goToArtist: (String) -> Unit,
)

/**
 * The expanded player sheet: 1.8 Full player, 1.9 Up Next, 1.10 Lyrics. In the player's own colours (dynamic player
 * colour from the cover; fake covers use Figma's sample seed) over a gradient from the cover colour.
 */
@Composable
fun PlayerPages(state: PlayerUiState, page: PlayerPage, vm: PlayerViewModel, nav: PlayerNav) {
    PlayerTheme(seed = SamplePlayerSeed) {
        Box(
            Modifier.fillMaxSize().background(
                Brush.verticalGradient(listOf(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.55f), MaterialTheme.colorScheme.surface)),
            ),
        ) {
            when (page) {
                PlayerPage.NowPlaying -> NowPlaying(state, vm, nav)
                PlayerPage.UpNext -> UpNext(state, vm, nav)
                PlayerPage.Lyrics -> Lyrics(state, vm, nav)
            }
        }
    }
}

internal fun PlayerState.actions(c: app.echo.data.repository.PlayerController) = PlaybackActions(
    onPlayPause = c::playPause, onPrevious = c::previous, onNext = c::next,
    onSeek = c::seekToFraction, onShuffle = c::toggleShuffle, onRepeat = c::toggleRepeat,
)

internal fun PlayerState.playback() = PlaybackUi(
    isPlaying = isPlaying, progress = progress, elapsed = formatDuration(positionMs),
    remaining = "−" + formatDuration((durationMs - positionMs).coerceAtLeast(0)), shuffle = shuffle, repeat = repeat,
)

@Composable
private fun PlaySource.label(): String = stringResource(
    when (this) {
        PlaySource.WORK -> R.string.player_from_work
        PlaySource.PLAYLIST -> R.string.player_from_playlist
        PlaySource.ARTIST -> R.string.player_from_artist
        PlaySource.SEARCH -> R.string.player_from_search
        PlaySource.TRENDING -> R.string.player_from_trending
        PlaySource.LIKED -> R.string.player_from_liked
    },
)

/** 1.8 Full player (35:947). */
@Composable
private fun NowPlaying(state: PlayerUiState, vm: PlayerViewModel, nav: PlayerNav) {
    val p = state.player
    val current = p.current
    FullPlayer(
        state = NowPlayingUi(
            title = current?.title.orEmpty(),
            artists = current?.artist.orEmpty(),
            meta = stringResource(R.string.player_track_of, p.index + 1, p.queue.size),
            playingFrom = p.playSource.label(),
            source = p.playingFrom,
            covers = p.queue.map { it.coverUrl },
            coverIndex = p.index.coerceAtLeast(0),
            liked = state.liked,
            nextTitle = p.queue.getOrNull(p.index + 1)?.title,
            speed = formatSpeed(p.speed),
            playback = p.playback(),
        ),
        actions = p.actions(vm.controller),
        onCollapse = nav.collapse,
        onMore = nav.openMore,
        onLike = { vm.toggleLike() },
        onPage = nav.openPage,
        onSleep = nav.openMore,
        onSpeed = { vm.controller.setSpeed(PlaybackSpeeds[(PlaybackSpeeds.indexOf(p.speed) + 1) % PlaybackSpeeds.size]) },
        labels = FullPlayerLabels(
            next = stringResource(R.string.player_next), upNext = stringResource(R.string.player_up_next),
            lyrics = stringResource(R.string.player_lyrics), sleep = stringResource(R.string.player_sleep),
        ),
        modifier = Modifier.testTag("screen:1.8"),
    )
}

/** 1.0×, 1.25×, 1.5× (Figma "1.0×"). */
fun formatSpeed(speed: Float): String {
    val t = "%.2f".format(java.util.Locale.ROOT, speed).trimEnd('0')
    return (if (t.endsWith('.')) t + "0" else t) + "×"
}

/** Up next · Lyrics switch shared by 1.9 and 1.10. */
@Composable
private fun PageSwitch(selected: PlayerPage, onPage: (PlayerPage) -> Unit) {
    ConnectedButtonGroup(
        options = listOf(ConnectedOption(stringResource(R.string.player_up_next)), ConnectedOption(stringResource(R.string.player_lyrics))),
        selected = if (selected == PlayerPage.UpNext) 0 else 1,
        onSelect = { onPage(if (it == 0) PlayerPage.UpNext else PlayerPage.Lyrics) },
        modifier = Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.s),
    )
}

/** 1.9 Up Next (35:1036): mini player on top, the queue (drag to reorder, swipe to remove), Shuffle · Repeat · Clear. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun UpNext(state: PlayerUiState, vm: PlayerViewModel, nav: PlayerNav) {
    val p = state.player
    val c = vm.controller
    var queue by remember(p.queue) { mutableStateOf(p.queue) }
    val listState = rememberLazyListState()
    val reorder = rememberReorderableLazyListState(listState) { from, to ->
        if (from.index in queue.indices && to.index in queue.indices) {
            queue = queue.toMutableList().apply { add(to.index, removeAt(from.index)) }
            c.move(from.index, to.index)
        }
    }
    Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.statusBars).testTag("screen:1.9")) {
        MiniPlayer(
            title = p.current?.title.orEmpty(), artist = p.current?.artist.orEmpty(), cover = p.current?.coverUrl,
            isPlaying = p.isPlaying, progress = { vm.state.value.player.progress },
            onPlayPause = c::playPause, onNext = c::next, onClick = { nav.openPage(PlayerPage.NowPlaying) },
            modifier = Modifier.padding(top = EchoSpacing.xs),
        )
        PageSwitch(PlayerPage.UpNext, nav.openPage)
        Text(
            stringResource(R.string.player_playing_from_label, p.playingFrom).uppercase(),
            style = MaterialTheme.typography.labelMediumEmphasized,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(start = EchoSpacing.screenMargin, top = EchoSpacing.m, bottom = EchoSpacing.s),
        )
        Box(Modifier.weight(1f)) {
            LazyColumn(
                state = listState,
                contentPadding = PaddingValues(bottom = ToolbarSpace),
                verticalArrangement = Arrangement.spacedBy(EchoSpacing.segmentedGap),
            ) {
                itemsIndexed(queue, key = { i, t -> "${t.id}-$i" }) { i, t ->
                    ReorderableItem(reorder, key = "${t.id}-$i") { _ ->
                        val dismiss = rememberSwipeToDismissBoxState()
                        SwipeToDismissBox(
                            state = dismiss,
                            backgroundContent = {},
                            enableDismissFromStartToEnd = false,
                            onDismiss = { if (it == SwipeToDismissBoxValue.EndToStart) c.remove(i) },
                            modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin),
                        ) {
                            TrackRow(
                                title = t.title, artist = t.artist, duration = formatDuration(t.durationMs), cover = t.coverUrl,
                                playing = i == p.index, onClick = { c.skipTo(i) }, onMore = {},
                                position = SegmentPosition(i, queue.size),
                                modifier = Modifier.longPressDraggableHandle(),
                                trailing = {
                                    Icon(
                                        painterResource(EchoIcons.DragHandle), stringResource(app.echo.designsystem.R.string.echo_cd_reorder),
                                        Modifier.draggableHandle().padding(EchoSpacing.s),
                                    )
                                },
                            )
                        }
                    }
                }
            }
            Box(Modifier.align(Alignment.BottomCenter).windowInsetsPadding(WindowInsets.navigationBars).padding(EchoSpacing.l)) {
                EchoFloatingToolbar {
                    ToolbarAction(stringResource(R.string.work_shuffle), EchoIcons.Shuffle, c::toggleShuffle, selected = p.shuffle)
                    ToolbarAction(stringResource(R.string.player_repeat), EchoIcons.Repeat, c::toggleRepeat, selected = p.repeat)
                    ToolbarAction(stringResource(R.string.player_clear), EchoIcons.Delete, c::clearUpNext)
                }
            }
        }
    }
}

private val ToolbarSpace = androidx.compose.ui.unit.Dp(112f)

/** 1.10 Lyrics (35:1467): synced lines over compact controls; Both · EN · JP picks which lines show. */
@Composable
private fun Lyrics(state: PlayerUiState, vm: PlayerViewModel, nav: PlayerNav) {
    val p = state.player
    var languages by remember { mutableStateOf(0) }
    Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).testTag("screen:1.10")) {
        EchoSmallAppBar(
            title = p.current?.title.orEmpty(),
            subtitle = stringResource(R.string.player_artist_track_of, p.current?.artist.orEmpty(), p.index + 1, p.queue.size),
            onBack = { nav.openPage(PlayerPage.NowPlaying) },
            navigationIcon = EchoIcons.ExpandMore,
            style = app.echo.designsystem.component.m3e.SmallAppBarStyle.Transparent,
        )
        PageSwitch(PlayerPage.Lyrics, nav.openPage)
        ChipRow(
            chips = listOf(R.string.lyrics_synced, R.string.lyrics_translated, R.string.lyrics_english).map { ChipSpec(stringResource(it)) },
            onClick = {}, style = ChipStyle.Assist,
        )
        Box(Modifier.weight(1f)) {
            if (state.lyrics.isEmpty()) {
                Text(
                    stringResource(R.string.lyrics_none), style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.align(Alignment.Center),
                )
            } else {
                SyncedLyrics(
                    lines = state.lyrics.map { LyricLine(formatDuration(it.timeMs), it.text, it.original) },
                    current = state.lyricIndex,
                    onLineClick = { i -> vm.controller.seekTo(state.lyrics[i].timeMs) },
                    showTranslation = languages != 2,
                    showOriginal = languages != 1,
                    modifier = Modifier.fillMaxSize(),
                )
            }
            Box(Modifier.align(Alignment.BottomCenter).padding(bottom = EchoSpacing.l)) {
                EchoFloatingToolbar(style = ToolbarStyle.Vibrant) {
                    ConnectedButtonGroup(
                        options = listOf(R.string.lyrics_both, R.string.lyrics_en, R.string.lyrics_jp).map { ConnectedOption(stringResource(it)) },
                        selected = languages, onSelect = { languages = it }, equalWidth = false,
                    )
                    EchoIconButton(EchoIcons.FormatSize, stringResource(R.string.lyrics_text_size), {})
                    EchoIconButton(EchoIcons.Share, stringResource(R.string.lyrics_share), {})
                }
            }
        }
        Surface(
            modifier = Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.m, vertical = EchoSpacing.s),
            shape = MaterialTheme.shapes.extraLarge,
            shadowElevation = EchoElevation.level3,
        ) {
            PlayerControls(p.playback(), p.actions(vm.controller), large = false, modifier = Modifier.padding(vertical = EchoSpacing.m))
        }
    }
}

/** 1.11 Player › More sheet (35:1199). */
@Composable
fun PlayerMoreSheet(state: PlayerUiState, vm: PlayerViewModel, nav: PlayerNav, onDismiss: () -> Unit) {
    val p = state.player
    val track = p.current ?: return onDismiss()
    var pickPlaylist by remember { mutableStateOf(false) }
    PlayerTheme(seed = SamplePlayerSeed) { MoreSheetContent(state, vm, nav, onDismiss, track) { pickPlaylist = true } }
    if (pickPlaylist) {
        PlayerTheme(seed = SamplePlayerSeed) {
            EchoSheet(onDismiss = { pickPlaylist = false }, title = stringResource(R.string.work_add_to_playlist)) {
                SegmentedList(Modifier.padding(bottom = EchoSpacing.xxl)) {
                    state.playlists.forEach { pl ->
                        item {
                            SegmentedListItem(pl.name, onClick = { vm.addCurrentTo(pl.id); pickPlaylist = false },
                                supporting = stringResource(R.string.results_tracks_count, pl.trackCount),
                                leading = { Icon(painterResource(EchoIcons.QueueMusic), null) })
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MoreSheetContent(
    state: PlayerUiState,
    vm: PlayerViewModel,
    nav: PlayerNav,
    onDismiss: () -> Unit,
    track: app.echo.data.model.Track,
    onAddToPlaylist: () -> Unit,
) {
    val p = state.player
    EchoSheet(onDismiss = onDismiss, modifier = Modifier.testTag("overlay:1.11")) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.xl, vertical = EchoSpacing.xs),
            horizontalArrangement = Arrangement.spacedBy(EchoSpacing.m),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            CoverImage(track.coverUrl, null, Modifier.size(androidx.compose.ui.unit.Dp(48f)), shape = MaterialTheme.shapes.medium)
            Column {
                Text(track.title, style = MaterialTheme.typography.titleMedium, maxLines = 1)
                Text(track.artist, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        SheetLabel(stringResource(R.string.player_speed))
        ConnectedButtonGroup(
            options = PlaybackSpeeds.map { ConnectedOption(formatSpeed(it)) },
            selected = PlaybackSpeeds.indexOf(p.speed).coerceAtLeast(0),
            onSelect = { vm.controller.setSpeed(PlaybackSpeeds[it]) },
            modifier = Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.xl, vertical = EchoSpacing.s),
        )
        SheetLabel(stringResource(R.string.player_sleep_timer))
        val sleep = when {
            p.sleepAtEndOfTrack -> SleepChoice.END_OF_TRACK
            p.sleepAt == null -> SleepChoice.OFF
            else -> SleepChoice.MIN_30
        }
        ChipRow(
            chips = listOf(R.string.sleep_off, R.string.sleep_15, R.string.sleep_30, R.string.sleep_60, R.string.sleep_end).map { ChipSpec(stringResource(it)) },
            onClick = { vm.setSleep(SleepChoice.entries[it]) },
            selected = setOf(sleep.ordinal),
            modifier = Modifier.padding(vertical = EchoSpacing.xs),
        )
        SegmentedList(Modifier.padding(top = EchoSpacing.s, bottom = EchoSpacing.xxl)) {
            item { SegmentedListItem(stringResource(R.string.player_track_info), onClick = {}, leading = { Icon(painterResource(EchoIcons.Info), null) }) }
            item {
                SegmentedListItem(stringResource(R.string.player_go_to_work), onClick = { onDismiss(); nav.goToWork(track.workId) },
                    leading = { Icon(painterResource(EchoIcons.LibraryMusic), null) })
            }
            item {
                SegmentedListItem(stringResource(R.string.player_go_to_artist), onClick = { onDismiss(); nav.goToArtist(track.artist) },
                    leading = { Icon(painterResource(EchoIcons.Person), null) })
            }
            item {
                SegmentedListItem(stringResource(R.string.work_add_to_playlist), onClick = onAddToPlaylist,
                    leading = { Icon(painterResource(EchoIcons.PlaylistAdd), null) })
            }
        }
    }
}

@Composable
private fun SheetLabel(text: String) = Text(
    text.uppercase(),
    style = MaterialTheme.typography.labelMediumEmphasized,
    color = MaterialTheme.colorScheme.onSurfaceVariant,
    modifier = Modifier.padding(start = EchoSpacing.xl, top = EchoSpacing.m, bottom = EchoSpacing.xs),
)
