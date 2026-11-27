package app.echo.android.feature.asmr.work

import app.echo.designsystem.component.echo.CoverKeys
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.runtime.remember
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.DropdownMenu
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.LocalContext
import android.content.Intent
import app.echo.android.feature.shared.LocalTrackActions
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.LoadContent
import app.echo.android.ui.echoViewModel
import app.echo.android.ui.formatDuration
import app.echo.android.ui.formatTotal
import app.echo.data.fake.FakeCatalog
import app.echo.data.model.Playlist
import app.echo.data.model.Work
import app.echo.data.repository.AsmrRepository
import app.echo.data.repository.Load
import app.echo.data.repository.PlayerController
import app.echo.data.repository.PlaylistRepository
import app.echo.designsystem.component.echo.CoverCard
import app.echo.designsystem.component.echo.LikeButton
import app.echo.designsystem.component.echo.MediaHeader
import app.echo.designsystem.component.echo.ShelfHeader
import app.echo.designsystem.component.m3e.ButtonStyle
import app.echo.designsystem.component.m3e.ChipRow
import app.echo.designsystem.component.m3e.ChipSpec
import app.echo.designsystem.component.m3e.ChipStyle
import app.echo.designsystem.component.m3e.ComponentSize
import app.echo.designsystem.component.m3e.CoverRow
import app.echo.designsystem.component.m3e.EchoButton
import app.echo.designsystem.component.m3e.EchoButtonGroup
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.component.m3e.EchoSheet
import app.echo.designsystem.component.m3e.EchoSmallAppBar
import app.echo.designsystem.component.m3e.IconButtonShape
import app.echo.designsystem.component.m3e.IconButtonStyle
import app.echo.designsystem.component.m3e.SegmentedList
import app.echo.designsystem.component.m3e.SegmentedListItem
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviewTheme
import app.echo.designsystem.preview.EchoPreviewThemes
import app.echo.designsystem.preview.EchoScreenPreviews
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.tokens.EchoSpacing
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

// ---- UiState / ViewModel ---------------------------------------------------------------------------------------

data class AsmrWorkUiState(
    val work: Load<Work> = Load.Loading,
    val similar: List<Work> = emptyList(),
    val liked: Boolean = false,
    val playingTrackId: String? = null,
    val playlists: List<Playlist> = emptyList(),
)

@OptIn(ExperimentalCoroutinesApi::class)
class AsmrWorkViewModel(
    private val id: String,
    asmr: AsmrRepository,
    private val playlists: PlaylistRepository,
    player: PlayerController,
) : ViewModel() {
    private val reload = MutableStateFlow(0)

    val state: StateFlow<AsmrWorkUiState> = combine(
        reload.flatMapLatest { asmr.work(id) },
        asmr.similar(id).map { (it as? Load.Content)?.value.orEmpty() },
        playlists.isWorkLiked(id),
        player.state.map { it.current?.id },
        playlists.playlists,
    ) { work, similar, liked, playing, lists -> AsmrWorkUiState(work, similar, liked, playing, lists) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), AsmrWorkUiState())

    fun retry() { reload.value++ }

    fun toggleLike() = viewModelScope.launch {
        val s = state.value
        (s.work as? Load.Content)?.value?.let { playlists.setWorkLiked(it, !s.liked) }
    }

    /** Adds every track of the work to [playlistId]. */
    fun addToPlaylist(playlistId: Long) = viewModelScope.launch {
        (state.value.work as? Load.Content)?.value?.tracks?.forEach { playlists.add(playlistId, it) }
    }
}

// ---- Route -----------------------------------------------------------------------------------------------------

@Composable
fun AsmrWorkRoute(id: String, shell: ShellActions, contentPadding: PaddingValues) {
    val vm = echoViewModel(key = "work:$id") { AsmrWorkViewModel(id, it.asmr, it.playlists, it.player) }
    val state by vm.state.collectAsStateWithLifecycle()
    var addToPlaylist by rememberSaveable { mutableStateOf(false) }
    AsmrWorkScreen(
        state = state,
        contentPadding = contentPadding,
        onBack = shell::back,
        onSearch = { shell.open(Route.AsmrSearch) },
        onArtist = { shell.open(Route.Artist(it)) },
        onTag = { shell.open(Route.AsmrResults(it)) },
        onPlay = { index, shuffle ->
            (state.work as? Load.Content)?.value?.let { w ->
                val tracks = if (shuffle) w.tracks.shuffled() else w.tracks
                shell.play(tracks, index, w.title)
            }
        },
        onLike = vm::toggleLike,
        onAddToPlaylist = { addToPlaylist = true },
        onWork = { shell.open(Route.Work(it)) },
        onRetry = vm::retry,
    )
    if (addToPlaylist) {
        EchoSheet(onDismiss = { addToPlaylist = false }, title = stringResource(R.string.work_add_to_playlist)) {
            SegmentedList(Modifier.padding(bottom = EchoSpacing.xxl)) {
                state.playlists.forEach { p ->
                    item {
                        SegmentedListItem(
                            headline = p.name,
                            supporting = pluralStringResource(R.plurals.results_tracks_count, p.trackCount, p.trackCount),
                            onClick = { vm.addToPlaylist(p.id); addToPlaylist = false },
                            leading = { Icon(painterResource(EchoIcons.QueueMusic), null) },
                        )
                    }
                }
            }
        }
    }
}

// ---- Screen ----------------------------------------------------------------------------------------------------

/** Figma 1.5 Work (35:508). */
@Composable
fun AsmrWorkScreen(
    state: AsmrWorkUiState,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onSearch: () -> Unit,
    onArtist: (String) -> Unit,
    onTag: (String) -> Unit,
    onPlay: (index: Int, shuffle: Boolean) -> Unit,
    onLike: () -> Unit,
    onAddToPlaylist: () -> Unit,
    onWork: (String) -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier.fillMaxSize().testTag("screen:1.5")) {
        EchoSmallAppBar(title = "", onBack = onBack) {
            EchoIconButton(EchoIcons.Search, stringResource(R.string.nav_search), onSearch)
            (state.work as? Load.Content)?.value?.let { WorkMenu(it) }
        }
        LoadContent(state.work, onRetry, contentPadding = contentPadding) { work ->
            WorkContent(work, state, contentPadding, onArtist, onTag, onPlay, onLike, onAddToPlaylist, onWork)
        }
    }
}

@Composable
private fun WorkContent(
    work: Work,
    state: AsmrWorkUiState,
    contentPadding: PaddingValues,
    onArtist: (String) -> Unit,
    onTag: (String) -> Unit,
    onPlay: (Int, Boolean) -> Unit,
    onLike: () -> Unit,
    onAddToPlaylist: () -> Unit,
    onWork: (String) -> Unit,
) {
    var expandedText by rememberSaveable { mutableStateOf(false) }
    var folderOpen by rememberSaveable { mutableStateOf(true) }
    val total = formatTotal(work.totalDurationMs)
    LazyColumn(contentPadding = PaddingValues(bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l)) {
        item {
            MediaHeader(
                title = work.title,
                artist = work.circle,
                meta = listOf(stringResource(R.string.work_meta, work.code.orEmpty(), work.tracks.size, total)),
                cover = work.coverUrl,
                onArtistClick = { onArtist(work.circle) },
                coverKey = CoverKeys.work(work.id),
            )
        }
        item {
            val chips = work.voiceActors.map { ChipSpec(it, EchoIcons.Person) } + work.tags.map { ChipSpec(it, EchoIcons.Tune) }
            ChipRow(
                chips = chips, style = ChipStyle.Assist,
                onClick = { i -> if (i < work.voiceActors.size) onArtist(work.voiceActors[i]) else onTag(work.tags[i - work.voiceActors.size]) },
                modifier = Modifier.padding(vertical = EchoSpacing.m),
            )
        }
        item {
            EchoButtonGroup {
                EchoButton(stringResource(R.string.work_play), { onPlay(0, false) }, size = ComponentSize.M, icon = EchoIcons.PlayArrowFilled)
                EchoButton(stringResource(R.string.work_shuffle), { onPlay(0, true) }, style = ButtonStyle.Tonal, size = ComponentSize.M, icon = EchoIcons.Shuffle)
                Spacer(Modifier.weight(1f))
                LikeButton(liked = state.liked, onToggle = onLike)
                EchoIconButton(EchoIcons.PlaylistAdd, stringResource(R.string.work_add_to_playlist), onAddToPlaylist, size = ComponentSize.M)
            }
        }
        work.description?.let { text ->
            item {
                Text(
                    text,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = if (expandedText) Int.MAX_VALUE else DESCRIPTION_LINES,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.animateContentSize().clickable { expandedText = !expandedText }
                        .padding(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.m),
                )
            }
        }
        item { ShelfHeader(stringResource(R.string.work_tracks)) }
        item {
            SegmentedList {
                item {
                    SegmentedListItem(
                        headline = stringResource(R.string.work_main_audio),
                        supporting = stringResource(R.string.work_folder_meta, work.tracks.size, total),
                        onClick = { folderOpen = !folderOpen },
                        leading = { Icon(painterResource(EchoIcons.FolderFilled), null) },
                        trailing = {
                            Icon(
                                painterResource(EchoIcons.ExpandMore), stringResource(R.string.work_expand),
                                Modifier.rotate(if (folderOpen) 180f else 0f),
                            )
                        },
                    )
                }
                if (folderOpen) {
                    work.tracks.forEachIndexed { i, t ->
                        val playing = t.id == state.playingTrackId
                        item {
                            SegmentedListItem(
                                headline = t.title,
                                supporting = if (playing) stringResource(R.string.work_playing, formatDuration(t.durationMs)) else formatDuration(t.durationMs),
                                selected = if (playing) true else null,
                                onClick = { onPlay(i, false) },
                                leading = { Icon(painterResource(if (playing) EchoIcons.QueueMusic else EchoIcons.MusicNote), null) },
                                trailing = {
                                    val open = LocalTrackActions.current
                                    EchoIconButton(EchoIcons.MoreVert, stringResource(app.echo.designsystem.R.string.echo_cd_more), { open(t, emptyList()) })
                                },
                            )
                        }
                    }
                }
            }
        }
        if (state.similar.isNotEmpty()) {
            // The arrow opens results for the work's first tag (its circle when it has none).
            item { ShelfHeader(stringResource(R.string.work_more_like_this), onClick = { onTag(work.tags.firstOrNull() ?: work.circle) }) }
            item { CoverRow(state.similar.size) { i -> state.similar[i].let { CoverCard(it.title, it.circle, it.coverUrl, { onWork(it.id) }, sharedKey = CoverKeys.work(it.id)) } } }
        }
    }
}

private const val DESCRIPTION_LINES = 3
private const val ASMR_ONE = "asmr.one"

/** The work's ⋮: Share and Open on asmr.one. */
@Composable
private fun WorkMenu(work: Work) {
    var open by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val uri = LocalUriHandler.current
    val url = "https://$ASMR_ONE/work/${work.code ?: work.id}"
    Box {
        EchoIconButton(EchoIcons.MoreVert, stringResource(app.echo.designsystem.R.string.echo_cd_more), { open = true })
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(
                text = { Text(stringResource(R.string.menu_share)) },
                leadingIcon = { Icon(painterResource(EchoIcons.Share), null) },
                onClick = {
                    open = false
                    context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, "${work.title}\n$url"), null))
                },
            )
            DropdownMenuItem(
                text = { Text(stringResource(R.string.menu_open_site, ASMR_ONE)) },
                leadingIcon = { Icon(painterResource(EchoIcons.OpenInNew), null) },
                onClick = { open = false; uri.openUri(url) },
            )
        }
    }
}

@EchoScreenPreviews
@Composable
private fun AsmrWorkScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        val work = FakeCatalog.works.first()
        AsmrWorkScreen(
            AsmrWorkUiState(Load.Content(work), FakeCatalog.works.drop(1), liked = true, playingTrackId = work.tracks[1].id),
            PaddingValues(), {}, {}, {}, {}, { _, _ -> }, {}, {}, {}, {},
        )
    }
}
