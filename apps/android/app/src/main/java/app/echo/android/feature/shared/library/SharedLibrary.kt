package app.echo.android.feature.shared.library

import kotlinx.coroutines.launch
import app.echo.android.feature.shared.TrackExtra
import app.echo.android.feature.shared.LocalTrackActions
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.feature.shared.continueMeta
import app.echo.android.feature.shared.openRoute
import app.echo.android.feature.shared.sectionLabel
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.android.ui.formatDuration
import app.echo.data.model.ContinueItem
import app.echo.data.model.Section
import app.echo.data.model.Track
import app.echo.data.repository.LibraryRepository
import app.echo.data.repository.PlaySource
import app.echo.designsystem.component.echo.ContinueCard
import app.echo.designsystem.component.echo.CoverImage
import app.echo.designsystem.component.echo.EmptyState
import app.echo.designsystem.component.echo.ProfileAvatar
import app.echo.designsystem.component.echo.ShelfHeader
import app.echo.designsystem.component.m3e.ChipRow
import app.echo.designsystem.component.m3e.ChipSpec
import app.echo.designsystem.component.m3e.CoverBadge
import app.echo.designsystem.component.m3e.CoverRow
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

/** The 0.2 chips that filter the shelves. Watching and Playlists open their own screens instead. */
enum class LibraryFilter { ALL, LISTENING, READING }

data class SharedLibraryUiState(
    val filter: LibraryFilter = LibraryFilter.ALL,
    /** Unfinished items of the filtered sections. */
    val continueItems: List<ContinueItem> = emptyList(),
    /** Recent ASMR tracks, newest first (3 rows; the full list is 0.3). */
    val listening: List<ContinueItem> = emptyList(),
    /** Recent JAV and Hentai items, newest first (3 rows). */
    val watching: List<ContinueItem> = emptyList(),
) {
    val isEmpty get() = continueItems.isEmpty() && listening.isEmpty() && watching.isEmpty()
}

private const val SHELF_ROWS = 3

class SharedLibraryViewModel(private val library: LibraryRepository) : ViewModel() {
    private val filter = MutableStateFlow(LibraryFilter.ALL)
    private val watching = combine(library.history(Section.JAV), library.history(Section.HENTAI)) { jav, hentai ->
        (jav + hentai).sortedByDescending { it.updatedAt }
    }

    val state: StateFlow<SharedLibraryUiState> = combine(filter, library.continueAll, library.history(Section.ASMR), watching) { f, cont, listen, watch ->
        SharedLibraryUiState(
            filter = f,
            continueItems = cont.filter { f.includes(it.section) },
            listening = if (f == LibraryFilter.READING) emptyList() else listen.take(SHELF_ROWS),
            watching = if (f == LibraryFilter.ALL) watch.take(SHELF_ROWS) else emptyList(),
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), SharedLibraryUiState())

    fun setFilter(f: LibraryFilter) { filter.value = f }
    fun remove(item: ContinueItem) = viewModelScope.launch { library.removeHistory(item.section, item.id) }
}

private fun LibraryFilter.includes(section: Section) = when (this) {
    LibraryFilter.ALL -> true
    LibraryFilter.LISTENING -> section == Section.ASMR
    LibraryFilter.READING -> section == Section.MANGA
}

@Composable
fun SharedLibraryRoute(shell: ShellActions, contentPadding: PaddingValues) {
    val vm = echoViewModel { SharedLibraryViewModel(it.library) }
    val state by vm.state.collectAsStateWithLifecycle()
    SharedLibraryScreen(
        state = state,
        profileInitial = shell.profileInitial,
        contentPadding = contentPadding,
        onFilter = vm::setFilter,
        onWatchingLibrary = { shell.open(Route.JavLibrary) },
        onPlaylists = { shell.open(Route.Playlists) },
        onHistory = { shell.open(Route.History) },
        onProfile = shell::openProfile,
        onOpen = { shell.open(it.openRoute()) },
        onListen = { i ->
            val list = state.listening
            shell.play(list.mapNotNull { it.track }, i, list[i].title, PlaySource.WORK)
        },
        onShowListening = { shell.open(Route.History) },
        onShowWatching = { shell.open(Route.JavLibrary) },
        onRemove = vm::remove,
    )
}

/** Figma 0.2 Library (28:6608): the unified library tab for ASMR, Manga, JAV and Hentai. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SharedLibraryScreen(
    state: SharedLibraryUiState,
    profileInitial: String,
    contentPadding: PaddingValues,
    onFilter: (LibraryFilter) -> Unit,
    onWatchingLibrary: () -> Unit,
    onPlaylists: () -> Unit,
    onHistory: () -> Unit,
    onProfile: () -> Unit,
    onOpen: (ContinueItem) -> Unit,
    onListen: (Int) -> Unit,
    onShowListening: () -> Unit,
    onShowWatching: () -> Unit,
    modifier: Modifier = Modifier,
    onRemove: (ContinueItem) -> Unit = {},
) {
    val scroll = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    Box(modifier.fillMaxSize().testTag("screen:0.2")) {
        Column(Modifier.nestedScroll(scroll.nestedScrollConnection)) {
            EchoFlexibleAppBar(
                title = stringResource(R.string.library_title),
                subtitle = stringResource(R.string.library_subtitle),
                scrollBehavior = scroll,
            ) {
                EchoIconButton(EchoIcons.History, stringResource(R.string.library_history_cd), onHistory)
                ProfileAvatar(profileInitial, onProfile)
            }
            ChipRow(
                chips = listOf(
                    R.string.library_chip_all, R.string.library_chip_listening, R.string.library_chip_reading,
                    R.string.library_chip_watching, R.string.library_chip_playlists,
                ).map { ChipSpec(stringResource(it)) },
                onClick = { i ->
                    when (i) {
                        0 -> onFilter(LibraryFilter.ALL)
                        1 -> onFilter(LibraryFilter.LISTENING)
                        2 -> onFilter(LibraryFilter.READING)
                        3 -> onWatchingLibrary()
                        else -> onPlaylists()
                    }
                },
                selected = setOf(state.filter.ordinal),
                modifier = Modifier.padding(vertical = EchoSpacing.s - EchoSpacing.xxs),
            )
            LazyColumn(contentPadding = PaddingValues(bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l)) {
                if (state.isEmpty) {
                    item {
                        EmptyState(
                            EchoIcons.History, stringResource(R.string.state_empty_title),
                            stringResource(R.string.library_empty_body), Modifier.padding(top = EchoSpacing.xxl),
                        )
                    }
                }
                if (state.continueItems.isNotEmpty()) {
                    item(key = "continue-header") { ShelfHeader(stringResource(R.string.library_continue)) }
                    item(key = "continue") {
                        CoverRow(state.continueItems.size) { i ->
                            val item = state.continueItems[i]
                            Box {
                                ContinueCard(
                                    title = item.title, meta = continueMeta(item), progress = item.progress,
                                    image = item.coverUrl, onClick = { onOpen(item) },
                                )
                                CoverBadge(sectionLabel(item.section), Modifier.align(Alignment.TopStart).padding(EchoSpacing.s))
                            }
                        }
                    }
                }
                if (state.listening.isNotEmpty()) {
                    item(key = "listening-header") {
                        ShelfHeader(stringResource(R.string.library_listening), onClick = onShowListening)
                    }
                    item(key = "listening") {
                        SegmentedList {
                            state.listening.forEachIndexed { i, row ->
                                item { ListeningRow(row, onClick = { onListen(i) }, onRemove = { onRemove(row) }) }
                            }
                        }
                    }
                }
                if (state.watching.isNotEmpty()) {
                    item(key = "watching-header") {
                        ShelfHeader(stringResource(R.string.library_watching), onClick = onShowWatching)
                    }
                    item(key = "watching") {
                        SegmentedList {
                            state.watching.forEach { row ->
                                item { WatchingRow(row, onClick = { onOpen(row) }) }
                            }
                        }
                    }
                }
                item { Spacer(Modifier.height(EchoSpacing.l)) }
            }
        }
    }
}

@Composable
private fun ListeningRow(item: ContinueItem, onClick: () -> Unit, onRemove: () -> Unit) {
    val track: Track? = item.track
    val trackActions = LocalTrackActions.current
    val removeLabel = stringResource(R.string.menu_remove_history)
    SegmentedListItem(
        headline = track?.title ?: item.title,
        supporting = listeningSupporting(item, track),
        onClick = onClick,
        leading = { CoverImage(item.coverUrl, null, Modifier.size(52.dp), shape = MaterialTheme.shapes.small) },
        // The track sheet, plus Remove from history.
        trailing = if (track == null) null else {
            { EchoIconButton(EchoIcons.MoreVert, stringResource(app.echo.designsystem.R.string.echo_cd_more), { trackActions(track, listOf(TrackExtra(removeLabel, EchoIcons.Delete, onRemove))) }) }
        },
    )
}

/** "Circle Aoi · 7:42 / 18:40", or "Studio Komorebi · Finished". */
@Composable
private fun listeningSupporting(item: ContinueItem, track: Track?): String {
    val artist = track?.artist.orEmpty()
    return if (item.finished) {
        listOf(artist, stringResource(R.string.history_finished)).filter { it.isNotEmpty() }.joinToString(" · ")
    } else {
        stringResource(R.string.library_listen_progress, artist, formatDuration(item.positionMs), formatDuration(item.durationMs))
    }
}

@Composable
private fun WatchingRow(item: ContinueItem, onClick: () -> Unit) {
    SegmentedListItem(
        headline = item.title,
        supporting = listOfNotNull(item.code, stringResource(R.string.library_resume, formatDuration(item.positionMs)))
            .joinToString(" · "),
        onClick = onClick,
        leading = { CoverImage(item.coverUrl, null, Modifier.size(52.dp), shape = MaterialTheme.shapes.small) },
    )
}

@EchoScreenPreviews
@Composable
private fun SharedLibraryScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        SharedLibraryScreen(
            state = previewLibraryState(),
            profileInitial = "P",
            contentPadding = PaddingValues(),
            onFilter = {}, onWatchingLibrary = {}, onPlaylists = {}, onHistory = {}, onProfile = {},
            onOpen = {}, onListen = {}, onShowListening = {}, onShowWatching = {},
        )
    }
}

private fun previewLibraryState(): SharedLibraryUiState {
    val track = Track("t1", "w1", "asmrone", "Ear cleaning (left → right)", "Circle Aoi", null, 1_122_000)
    return SharedLibraryUiState(
        continueItems = listOf(
            ContinueItem(Section.ASMR, "w1", "Whispered bedtime story", positionMs = 1_080_000, durationMs = 2_280_000, updatedAt = 3, finished = false),
            ContinueItem(Section.MANGA, "g1", "Gallery title", page = 34, pageCount = 52, updatedAt = 2, finished = false),
            ContinueItem(Section.JAV, "m1", "ABC-101", code = "ABC-101", positionMs = 1_022_000, durationMs = 7_200_000, updatedAt = 1, finished = false),
        ),
        listening = listOf(
            ContinueItem(Section.ASMR, "w2", "Ear cleaning", positionMs = 462_000, durationMs = 1_122_000, updatedAt = 4, finished = false, track = track),
            ContinueItem(Section.ASMR, "w3", "Rain on a tin roof", positionMs = 900, durationMs = 900, updatedAt = 3, finished = true, track = track.copy(id = "t2", title = "Rain on a tin roof", artist = "Studio Komorebi")),
        ),
        watching = listOf(
            ContinueItem(Section.JAV, "m1", "Movie title", code = "ABC-101", positionMs = 1_022_000, durationMs = 7_200_000, updatedAt = 1, finished = false),
        ),
    )
}
