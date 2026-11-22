package app.echo.android.feature.asmr.playlist

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MediumExtendedFloatingActionButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.feature.asmr.playlists.NewPlaylistDialog
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.android.ui.formatDuration
import app.echo.android.ui.formatTotal
import app.echo.data.fake.FakeCatalog
import app.echo.data.model.Playlist
import app.echo.data.model.PlaylistPrivacy
import app.echo.data.model.Track
import app.echo.data.repository.PlaySource
import app.echo.data.repository.PlayerController
import app.echo.data.repository.PlaylistRepository
import app.echo.designsystem.component.echo.CoverImage
import app.echo.designsystem.component.echo.EmptyState
import app.echo.designsystem.component.echo.TrackRow
import app.echo.designsystem.component.m3e.ButtonStyle
import app.echo.designsystem.component.m3e.ComponentSize
import app.echo.designsystem.component.m3e.EchoButton
import app.echo.designsystem.component.m3e.EchoButtonGroup
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.component.m3e.EchoSmallAppBar
import app.echo.designsystem.component.m3e.IconButtonStyle
import app.echo.designsystem.component.m3e.SegmentPosition
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviewTheme
import app.echo.designsystem.preview.EchoPreviewThemes
import app.echo.designsystem.preview.EchoScreenPreviews
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.tokens.EchoElevation
import app.echo.designsystem.tokens.EchoSizes
import app.echo.designsystem.tokens.EchoSpacing
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import sh.calvin.reorderable.ReorderableItem
import sh.calvin.reorderable.rememberReorderableLazyListState

data class AsmrPlaylistUiState(
    val playlist: Playlist? = null,
    val tracks: List<Track> = emptyList(),
    val playingTrackId: String? = null,
    val loaded: Boolean = false,
)

class AsmrPlaylistViewModel(private val id: Long, private val repo: PlaylistRepository, player: PlayerController) : ViewModel() {
    val state: StateFlow<AsmrPlaylistUiState> = combine(
        repo.playlists.map { list -> list.firstOrNull { it.id == id } },
        repo.tracks(id),
        player.state.map { it.current?.id },
    ) { p, t, playing -> AsmrPlaylistUiState(p, t, playing, loaded = true) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), AsmrPlaylistUiState())

    /** 1.7 drag to reorder: saved to playlist_track. */
    fun move(from: Int, to: Int) = viewModelScope.launch { repo.move(id, from, to) }
    fun remove(position: Int) = viewModelScope.launch { repo.remove(id, position) }

    /** The lock toggle: private ↔ public. */
    fun togglePrivacy() = viewModelScope.launch {
        state.value.playlist?.let { p ->
            repo.rename(id, p.name, if (p.privacy == PlaylistPrivacy.PRIVATE) PlaylistPrivacy.PUBLIC else PlaylistPrivacy.PRIVATE)
        }
    }

    fun rename(name: String) = viewModelScope.launch { state.value.playlist?.let { repo.rename(id, name.trim(), it.privacy) } }
}

@Composable
fun AsmrPlaylistRoute(id: Long, shell: ShellActions, contentPadding: PaddingValues) {
    val vm = echoViewModel(key = "playlist:$id") { AsmrPlaylistViewModel(id, it.playlists, it.player) }
    val state by vm.state.collectAsStateWithLifecycle()
    var renaming by rememberSaveable { mutableStateOf(false) }
    AsmrPlaylistScreen(
        state = state, contentPadding = contentPadding,
        onBack = shell::back, onEdit = { renaming = true },
        onPlay = { index, shuffle ->
            val list = if (shuffle) state.tracks.shuffled() else state.tracks
            shell.play(list, index, state.playlist?.name.orEmpty(), PlaySource.PLAYLIST)
        },
        onPrivacy = vm::togglePrivacy, onMove = vm::move, onAddTracks = { shell.open(Route.AsmrSearch) },
    )
    if (renaming) {
        NewPlaylistDialog(
            onDismiss = { renaming = false }, onCreate = { renaming = false; vm.rename(it) },
            initial = state.playlist?.name.orEmpty(), title = R.string.playlist_rename,
        )
    }
}

/** Figma 1.7 Playlist (35:811): header with a cover mosaic, Play / Shuffle / privacy, a reorderable list, Add tracks. */
@Composable
fun AsmrPlaylistScreen(
    state: AsmrPlaylistUiState,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onEdit: () -> Unit,
    onPlay: (index: Int, shuffle: Boolean) -> Unit,
    onPrivacy: () -> Unit,
    onMove: (from: Int, to: Int) -> Unit,
    onAddTracks: () -> Unit,
    modifier: Modifier = Modifier,
) {
    // Local order while dragging; follows the stored order otherwise.
    var tracks by remember(state.tracks) { mutableStateOf(state.tracks) }
    val listState = rememberLazyListState()
    val headerItems = 2
    val reorder = rememberReorderableLazyListState(listState) { from, to ->
        val f = from.index - headerItems
        val t = to.index - headerItems
        if (f in tracks.indices && t in tracks.indices) {
            tracks = tracks.toMutableList().apply { add(t, removeAt(f)) }
            onMove(f, t)
        }
    }
    Box(modifier.fillMaxSize().testTag("screen:1.7")) {
        Column {
            EchoSmallAppBar(title = "", onBack = onBack) {
                EchoIconButton(EchoIcons.Edit, stringResource(R.string.playlist_rename), onEdit)
                EchoIconButton(EchoIcons.MoreVert, stringResource(app.echo.designsystem.R.string.echo_cd_more), {})
            }
            val p = state.playlist
            if (state.loaded && p == null) {
                EmptyState(EchoIcons.QueueMusic, stringResource(R.string.state_not_found_title), stringResource(R.string.state_not_found_body), Modifier.padding(top = EchoSpacing.xxxl))
                return@Column
            }
            LazyColumn(
                state = listState,
                contentPadding = PaddingValues(bottom = contentPadding.calculateBottomPadding() + 96.dp),
                verticalArrangement = Arrangement.spacedBy(EchoSpacing.segmentedGap),
            ) {
                item(key = "header") { if (p != null) Header(p, tracks) }
                item(key = "buttons") {
                    EchoButtonGroup(Modifier.padding(vertical = EchoSpacing.m)) {
                        EchoButton(stringResource(R.string.work_play), { onPlay(0, false) }, size = ComponentSize.M, icon = EchoIcons.PlayArrowFilled)
                        EchoButton(stringResource(R.string.work_shuffle), { onPlay(0, true) }, style = ButtonStyle.Tonal, size = ComponentSize.M, icon = EchoIcons.Shuffle)
                        Spacer(Modifier.weight(1f))
                        EchoIconButton(
                            EchoIcons.Lock, stringResource(R.string.playlist_private), onPrivacy, style = IconButtonStyle.Outlined,
                            size = ComponentSize.M, checked = p?.privacy == PlaylistPrivacy.PRIVATE, checkedIcon = EchoIcons.LockFilled,
                        )
                    }
                }
                itemsIndexed(tracks, key = { i, t -> "${t.id}-$i" }) { i, t ->
                    ReorderableItem(reorder, key = "${t.id}-$i") { dragging ->
                        TrackRow(
                            title = t.title, artist = t.artist, duration = formatDuration(t.durationMs), cover = t.coverUrl,
                            playing = t.id == state.playingTrackId, onClick = { onPlay(i, false) }, onMore = {},
                            position = SegmentPosition(i, tracks.size),
                            modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin)
                                .then(if (dragging) Modifier.shadow(EchoElevation.level5, MaterialTheme.shapes.largeIncreased) else Modifier)
                                .longPressDraggableHandle(),
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
        MediumExtendedFloatingActionButton(
            onClick = onAddTracks,
            icon = { Icon(painterResource(EchoIcons.Add), null) },
            text = { Text(stringResource(R.string.playlist_add_tracks)) },
            modifier = Modifier.align(Alignment.BottomEnd)
                .padding(end = EchoSpacing.screenMargin, bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l),
        )
    }
}

@Composable
private fun Header(p: Playlist, tracks: List<Track>) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin),
        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.l),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Cover mosaic: the first four covers, 2 × 2 (Figma "Cover mosaic").
        Column(Modifier.size(EchoSizes.avatarArtist).clip(MaterialTheme.shapes.extraLarge)) {
            repeat(2) { r ->
                Row {
                    repeat(2) { c ->
                        CoverImage(tracks.getOrNull(r * 2 + c)?.coverUrl, null, Modifier.size(EchoSizes.avatarArtist / 2), shape = null)
                    }
                }
            }
        }
        Column {
            Text(p.name, style = MaterialTheme.typography.headlineMedium, modifier = Modifier.semantics { heading() })
            Text(
                stringResource(
                    R.string.playlist_meta,
                    stringResource(if (p.privacy == PlaylistPrivacy.PUBLIC) R.string.playlist_public else R.string.playlist_private),
                    tracks.size, formatTotal(tracks.sumOf { it.durationMs }),
                ),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@EchoScreenPreviews
@Composable
private fun AsmrPlaylistScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        val tracks = FakeCatalog.works.first().tracks
        AsmrPlaylistScreen(
            AsmrPlaylistUiState(Playlist(1, "Sleep queue", PlaylistPrivacy.PRIVATE, tracks.size), tracks, tracks[1].id, true),
            PaddingValues(), {}, {}, { _, _ -> }, {}, { _, _ -> }, {},
        )
    }
}
