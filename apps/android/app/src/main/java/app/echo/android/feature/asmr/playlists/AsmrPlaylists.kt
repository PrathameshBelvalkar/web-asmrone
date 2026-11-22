package app.echo.android.feature.asmr.playlists

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.android.ui.formatDuration
import app.echo.android.ui.formatTimeLeft
import app.echo.data.model.ContinueItem
import app.echo.data.model.Playlist
import app.echo.data.model.PlaylistPrivacy
import app.echo.data.model.Section
import app.echo.data.model.Track
import app.echo.data.model.Work
import app.echo.data.repository.LibraryRepository
import app.echo.data.repository.PlaySource
import app.echo.data.repository.PlaylistRepository
import app.echo.designsystem.component.echo.CoverImage
import app.echo.designsystem.component.echo.EmptyState
import app.echo.designsystem.component.echo.ProfileAvatar
import app.echo.designsystem.component.echo.TrackRow
import app.echo.designsystem.component.m3e.ChipRow
import app.echo.designsystem.component.m3e.ChipSpec
import app.echo.designsystem.component.m3e.EchoFlexibleAppBar
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.component.m3e.SegmentedList
import app.echo.designsystem.component.m3e.SegmentedListItem
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviewTheme
import app.echo.designsystem.preview.EchoPreviewThemes
import app.echo.designsystem.preview.EchoScreenPreviews
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.tokens.EchoSpacing
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** The 1.12 chips. */
enum class PlaylistsTab { PLAYLISTS, FAVOURITES, LIKED, HISTORY }

data class AsmrPlaylistsUiState(
    val tab: PlaylistsTab = PlaylistsTab.PLAYLISTS,
    val playlists: List<Playlist> = emptyList(),
    val favourites: List<Work> = emptyList(),
    val liked: List<Track> = emptyList(),
    val history: List<ContinueItem> = emptyList(),
)

class AsmrPlaylistsViewModel(private val repo: PlaylistRepository, library: LibraryRepository) : ViewModel() {
    private val tab = MutableStateFlow(PlaylistsTab.PLAYLISTS)
    val state: StateFlow<AsmrPlaylistsUiState> = combine(tab, repo.playlists, repo.likedWorks, repo.liked, library.history(Section.ASMR)) {
            t, p, f, l, h -> AsmrPlaylistsUiState(t, p, f, l, h)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), AsmrPlaylistsUiState())

    fun setTab(t: PlaylistsTab) { tab.value = t }
    fun create(name: String, onCreated: (Long) -> Unit = {}) = viewModelScope.launch {
        onCreated(repo.create(name.trim(), PlaylistPrivacy.PRIVATE))
    }
}

@Composable
fun AsmrPlaylistsRoute(shell: ShellActions, contentPadding: PaddingValues) {
    val vm = echoViewModel { AsmrPlaylistsViewModel(it.playlists, it.library) }
    val state by vm.state.collectAsStateWithLifecycle()
    var naming by rememberSaveable { mutableStateOf(false) }
    AsmrPlaylistsScreen(
        state = state, profileInitial = shell.profileInitial, contentPadding = contentPadding,
        onBack = shell::back, onProfile = shell::openProfile, onTab = vm::setTab,
        onPlaylist = { shell.open(Route.Playlist(it)) },
        onWork = { shell.open(Route.Work(it)) },
        onTrack = { i -> shell.play(state.liked, i, "", PlaySource.LIKED) },
        onNew = { naming = true },
    )
    if (naming) NewPlaylistDialog(onDismiss = { naming = false }, onCreate = { name -> naming = false; vm.create(name) { shell.open(Route.Playlist(it)) } })
}

/** "New playlist" name dialog (1.12 FAB). */
@Composable
fun NewPlaylistDialog(onDismiss: () -> Unit, onCreate: (String) -> Unit, initial: String = "", title: Int = R.string.playlists_new) {
    var name by rememberSaveable { mutableStateOf(initial) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(title)) },
        text = { OutlinedTextField(name, { name = it }, label = { Text(stringResource(R.string.playlists_name)) }, singleLine = true) },
        confirmButton = { TextButton(onClick = { onCreate(name) }, enabled = name.isNotBlank()) { Text(stringResource(R.string.playlists_save)) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(android.R.string.cancel)) } },
    )
}

/** Figma 1.12 Playlists (35:1348). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AsmrPlaylistsScreen(
    state: AsmrPlaylistsUiState,
    profileInitial: String,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onProfile: () -> Unit,
    onTab: (PlaylistsTab) -> Unit,
    onPlaylist: (Long) -> Unit,
    onWork: (String) -> Unit,
    onTrack: (Int) -> Unit,
    onNew: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val scroll = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    Box(modifier.fillMaxSize().testTag("screen:1.12")) {
        Column(Modifier.nestedScroll(scroll.nestedScrollConnection)) {
            EchoFlexibleAppBar(
                title = stringResource(R.string.playlists_title),
                subtitle = stringResource(R.string.playlists_subtitle, state.playlists.size),
                onBack = onBack,
                scrollBehavior = scroll,
            ) { ProfileAvatar(profileInitial, onProfile) }
            ChipRow(
                chips = listOf(R.string.playlists_title, R.string.playlists_favourites, R.string.playlists_liked, R.string.playlists_history)
                    .map { ChipSpec(stringResource(it)) },
                onClick = { onTab(PlaylistsTab.entries[it]) },
                selected = setOf(state.tab.ordinal),
                modifier = Modifier.padding(vertical = EchoSpacing.s - EchoSpacing.xxs),
            )
            LazyColumn(contentPadding = PaddingValues(top = EchoSpacing.s, bottom = contentPadding.calculateBottomPadding() + FabSpace)) {
                item {
                    when (state.tab) {
                        PlaylistsTab.PLAYLISTS -> SegmentedList {
                            state.playlists.forEach { p ->
                                item {
                                    SegmentedListItem(
                                        headline = p.name,
                                        supporting = stringResource(
                                            R.string.playlist_privacy_count,
                                            stringResource(if (p.privacy == PlaylistPrivacy.PUBLIC) R.string.playlist_public else R.string.playlist_private),
                                            p.trackCount,
                                        ),
                                        onClick = { onPlaylist(p.id) },
                                        leading = { CoverImage(null, null, Modifier.size(52.dp), shape = MaterialTheme.shapes.small) },
                                        trailing = { EchoIconButton(EchoIcons.MoreVert, stringResource(app.echo.designsystem.R.string.echo_cd_more), {}) },
                                    )
                                }
                            }
                        }
                        PlaylistsTab.FAVOURITES -> if (state.favourites.isEmpty()) Empty() else SegmentedList {
                            state.favourites.forEach { w ->
                                item {
                                    SegmentedListItem(
                                        headline = w.title, supporting = w.circle, onClick = { onWork(w.id) },
                                        leading = { CoverImage(w.coverUrl, null, Modifier.size(52.dp), shape = MaterialTheme.shapes.small) },
                                    )
                                }
                            }
                        }
                        PlaylistsTab.LIKED -> if (state.liked.isEmpty()) Empty() else SegmentedList {
                            state.liked.forEachIndexed { i, t ->
                                item { TrackRow(t.title, t.artist, formatDuration(t.durationMs), t.coverUrl, false, { onTrack(i) }, {}) }
                            }
                        }
                        PlaylistsTab.HISTORY -> if (state.history.isEmpty()) Empty() else SegmentedList {
                            state.history.forEach { h ->
                                item {
                                    SegmentedListItem(
                                        headline = h.title, supporting = h.subtitle?.let { "$it · ${formatTimeLeft(h)}" } ?: formatTimeLeft(h),
                                        onClick = { onWork(h.id) },
                                        leading = { CoverImage(h.coverUrl, null, Modifier.size(52.dp), shape = MaterialTheme.shapes.small) },
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
        ExtendedFloatingActionButton(
            onClick = onNew,
            icon = { Icon(painterResource(EchoIcons.Add), null) },
            text = { Text(stringResource(R.string.playlists_new)) },
            modifier = Modifier.align(Alignment.BottomEnd)
                .padding(end = EchoSpacing.screenMargin, bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l),
        )
    }
}

@Composable
private fun Empty() = EmptyState(
    EchoIcons.QueueMusic, stringResource(R.string.state_empty_title), stringResource(R.string.playlists_empty_body),
    Modifier.padding(top = EchoSpacing.xxl),
)

private val FabSpace = 96.dp

@EchoScreenPreviews
@Composable
private fun AsmrPlaylistsScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        AsmrPlaylistsScreen(
            AsmrPlaylistsUiState(
                playlists = listOf(
                    Playlist(1, "Sleep queue", PlaylistPrivacy.PRIVATE, 18), Playlist(2, "Rain collection", PlaylistPrivacy.PUBLIC, 42),
                    Playlist(3, "Morning wind-down", PlaylistPrivacy.PRIVATE, 9), Playlist(4, "Ear cleaning best of", PlaylistPrivacy.PUBLIC, 27),
                    Playlist(5, "For the train", PlaylistPrivacy.PRIVATE, 6),
                ),
            ),
            "P", PaddingValues(), {}, {}, {}, {}, {}, {}, {},
        )
    }
}
