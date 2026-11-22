package app.echo.android.feature.asmr.results

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.ErrorState
import app.echo.android.ui.LoadingState
import app.echo.android.ui.echoViewModel
import app.echo.android.ui.formatDuration
import app.echo.data.fake.FakeCatalog
import app.echo.data.model.Artist
import app.echo.data.model.AsmrSearchResults
import app.echo.data.model.Playlist
import app.echo.data.model.Work
import app.echo.data.repository.AsmrRepository
import app.echo.data.repository.Load
import app.echo.data.repository.PlaySource
import app.echo.data.repository.PlayerController
import app.echo.data.repository.PlaylistRepository
import app.echo.designsystem.component.echo.CoverCard
import app.echo.designsystem.component.echo.CoverImage
import app.echo.designsystem.component.echo.EmptyState
import app.echo.designsystem.component.echo.IdolCard
import app.echo.designsystem.component.echo.ShelfHeader
import app.echo.designsystem.component.echo.TrackRow
import app.echo.designsystem.component.m3e.ChipRow
import app.echo.designsystem.component.m3e.ChipSpec
import app.echo.designsystem.component.m3e.CoverGrid
import app.echo.designsystem.component.m3e.CoverRow
import app.echo.designsystem.component.m3e.EchoSearchAppBar
import app.echo.designsystem.component.m3e.SegmentedList
import app.echo.designsystem.component.m3e.SegmentedListItem
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviewTheme
import app.echo.designsystem.preview.EchoPreviewThemes
import app.echo.designsystem.preview.EchoScreenPreviews
import app.echo.designsystem.theme.EchoShapes
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.tokens.EchoSizes
import app.echo.designsystem.tokens.EchoSpacing
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

// ---- UiState ---------------------------------------------------------------------------------------------------

/** The 1.3 filter chips. */
enum class ResultsFilter { ALL, WORKS, TRACKS, ARTISTS, PLAYLISTS }

data class AsmrResultsUiState(
    val query: String,
    val filter: ResultsFilter = ResultsFilter.ALL,
    val results: Load<AsmrSearchResults> = Load.Loading,
    /** Your playlists whose name matches (the Playlists chip). */
    val playlists: List<Playlist> = emptyList(),
    val playingTrackId: String? = null,
)

// ---- ViewModel -------------------------------------------------------------------------------------------------

@OptIn(ExperimentalCoroutinesApi::class)
class AsmrResultsViewModel(
    private val query: String,
    asmr: AsmrRepository,
    playlists: PlaylistRepository,
    player: PlayerController,
) : ViewModel() {
    private val filter = MutableStateFlow(ResultsFilter.ALL)
    private val reload = MutableStateFlow(0)

    val state: StateFlow<AsmrResultsUiState> = combine(
        filter,
        reload.flatMapLatest { asmr.search(query) },
        playlists.playlists.map { list -> list.filter { it.name.matchesWords(query) } },
        player.state.map { it.current?.id },
    ) { f, results, matching, playing -> AsmrResultsUiState(query, f, results, matching, playing) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), AsmrResultsUiState(query))

    fun setFilter(f: ResultsFilter) { filter.value = f }
    fun retry() { reload.value++ }
}

/** Every word of [query] starts a word of the name ("rain" matches "Rain collection", not "For the train"). */
internal fun String.matchesWords(query: String): Boolean {
    val words = split(' ', '-', '·').filter { it.isNotBlank() }
    return query.split(' ').filter { it.isNotBlank() }.let { q -> q.isNotEmpty() && q.all { w -> words.any { it.startsWith(w, ignoreCase = true) } } }
}

// ---- Route -----------------------------------------------------------------------------------------------------

@Composable
fun AsmrResultsRoute(query: String, shell: ShellActions, sourceName: String, sectionIcon: Int, contentPadding: PaddingValues) {
    val vm = echoViewModel(key = "results:$query") { AsmrResultsViewModel(query, it.asmr, it.playlists, it.player) }
    val state by vm.state.collectAsStateWithLifecycle()
    AsmrResultsScreen(
        state = state,
        source = sourceName,
        sectionIcon = sectionIcon,
        profileInitial = shell.profileInitial,
        contentPadding = contentPadding,
        onSearch = shell::back,
        onSwitchSource = shell::openSourceSwitcher,
        onProfile = shell::openProfile,
        onFilter = vm::setFilter,
        onWork = { shell.open(Route.Work(it)) },
        onArtist = { shell.open(Route.Artist(it)) },
        onPlaylist = { shell.open(Route.Playlist(it)) },
        onTrack = { tracksIndex ->
            (state.results as? Load.Content)?.value?.tracks?.let { shell.play(it, tracksIndex, query, PlaySource.SEARCH) }
        },
        onRetry = vm::retry,
    )
}

// ---- Screen ----------------------------------------------------------------------------------------------------

/** Figma 1.3 Search results (35:261). */
@Composable
fun AsmrResultsScreen(
    state: AsmrResultsUiState,
    source: String,
    sectionIcon: Int,
    profileInitial: String,
    contentPadding: PaddingValues,
    onSearch: () -> Unit,
    onSwitchSource: () -> Unit,
    onProfile: () -> Unit,
    onFilter: (ResultsFilter) -> Unit,
    onWork: (String) -> Unit,
    onArtist: (String) -> Unit,
    onPlaylist: (Long) -> Unit,
    onTrack: (Int) -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier.fillMaxSize().testTag("screen:1.3")) {
        EchoSearchAppBar(
            source = source, sectionIcon = sectionIcon, profileInitial = profileInitial, placeholder = state.query,
            onSearch = onSearch, onSwitchSource = onSwitchSource, onProfile = onProfile,
        )
        val labels = listOf(R.string.results_all, R.string.results_works, R.string.results_tracks, R.string.results_artists, R.string.results_playlists)
        ChipRow(
            chips = labels.map { ChipSpec(stringResource(it)) },
            onClick = { onFilter(ResultsFilter.entries[it]) },
            selected = setOf(state.filter.ordinal),
            modifier = Modifier.padding(vertical = EchoSpacing.s - EchoSpacing.xxs),
        )
        val bottom = PaddingValues(bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l)
        when (val r = state.results) {
            Load.Loading -> LoadingState(Modifier.padding(bottom))
            is Load.Error -> ErrorState(r.kind, onRetry, Modifier.padding(top = EchoSpacing.xxxl))
            Load.Empty -> NoMatches(state.query)
            is Load.Content -> when (state.filter) {
                ResultsFilter.ALL -> AllResults(r.value, state.playingTrackId, bottom, onFilter, onWork, onArtist, onTrack)
                ResultsFilter.WORKS -> WorkGrid(r.value.works, bottom, onWork)
                ResultsFilter.TRACKS -> LazyColumn(contentPadding = bottom) { item { TrackList(r.value, state.playingTrackId, onTrack) } }
                ResultsFilter.ARTISTS -> LazyColumn(contentPadding = bottom) { item { ArtistList(r.value.artists, onArtist) } }
                ResultsFilter.PLAYLISTS -> if (state.playlists.isEmpty()) NoMatches(state.query)
                else LazyColumn(contentPadding = bottom) { item { PlaylistList(state.playlists, onPlaylist) } }
            }
        }
    }
}

@Composable
private fun NoMatches(query: String) = EmptyState(
    EchoIcons.Search, stringResource(R.string.results_no_matches_title), stringResource(R.string.results_no_matches_body, query),
    Modifier.padding(top = EchoSpacing.xxxl),
)

@Composable
private fun AllResults(
    r: AsmrSearchResults,
    playing: String?,
    padding: PaddingValues,
    onFilter: (ResultsFilter) -> Unit,
    onWork: (String) -> Unit,
    onArtist: (String) -> Unit,
    onTrack: (Int) -> Unit,
) {
    LazyColumn(contentPadding = padding) {
        if (r.works.isNotEmpty()) {
            item { ShelfHeader(stringResource(R.string.results_works), onClick = { onFilter(ResultsFilter.WORKS) }) }
            item { CoverRow(r.works.size) { i -> WorkCard(r.works[i], onWork) } }
        }
        if (r.artists.isNotEmpty()) {
            item { ShelfHeader(stringResource(R.string.results_artists), onClick = { onFilter(ResultsFilter.ARTISTS) }) }
            item { CoverRow(r.artists.size) { i -> IdolCard(r.artists[i].name, null, r.artists[i].imageUrl, { onArtist(r.artists[i].id) }, width = 88.dp) } }
        }
        if (r.tracks.isNotEmpty()) {
            item { ShelfHeader(stringResource(R.string.results_tracks), onClick = { onFilter(ResultsFilter.TRACKS) }) }
            item { TrackList(r.copy(tracks = r.tracks.take(4)), playing, onTrack) }
        }
    }
}

@Composable
private fun WorkCard(work: Work, onWork: (String) -> Unit) = CoverCard(work.title, work.circle, work.coverUrl, { onWork(work.id) })

@Composable
private fun WorkGrid(works: List<Work>, padding: PaddingValues, onWork: (String) -> Unit) {
    CoverGrid(columns = 2, contentPadding = PaddingValues(
        start = EchoSpacing.screenMargin, end = EchoSpacing.screenMargin, top = EchoSpacing.s,
        bottom = padding.calculateBottomPadding(),
    )) {
        items(works, key = { it.id }) { w ->
            CoverCard(w.title, w.circle, w.coverUrl, { onWork(w.id) }, width = Dp.Unspecified)
        }
    }
}

@Composable
private fun TrackList(r: AsmrSearchResults, playing: String?, onTrack: (Int) -> Unit) {
    SegmentedList {
        r.tracks.forEachIndexed { i, t ->
            item { TrackRow(t.title, t.artist, formatDuration(t.durationMs), t.coverUrl, t.id == playing, { onTrack(i) }, {}) }
        }
    }
}

@Composable
private fun ArtistList(artists: List<Artist>, onArtist: (String) -> Unit) {
    SegmentedList {
        artists.forEach { a ->
            item {
                SegmentedListItem(
                    headline = a.name,
                    supporting = stringResource(R.string.results_works_count, a.workCount),
                    onClick = { onArtist(a.id) },
                    leading = { CoverImage(a.imageUrl, null, Modifier.size(EchoSizes.minTouchTarget), shape = EchoShapes.Full) },
                )
            }
        }
    }
}

@Composable
private fun PlaylistList(playlists: List<Playlist>, onPlaylist: (Long) -> Unit) {
    SegmentedList {
        playlists.forEach { p ->
            item {
                SegmentedListItem(
                    headline = p.name,
                    supporting = stringResource(R.string.results_tracks_count, p.trackCount),
                    onClick = { onPlaylist(p.id) },
                    leading = { Icon(painterResource(EchoIcons.QueueMusic), null) },
                )
            }
        }
    }
}

@EchoScreenPreviews
@Composable
private fun AsmrResultsScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        AsmrResultsScreen(
            state = AsmrResultsUiState(
                query = "rain",
                results = Load.Content(
                    AsmrSearchResults(
                        works = FakeCatalog.works.take(4),
                        artists = FakeCatalog.artists.take(4),
                        tracks = FakeCatalog.works.flatMap { it.tracks }.filter { it.title.contains("Rain") }.take(2),
                    ),
                ),
            ),
            source = "asmr.one", sectionIcon = EchoIcons.MusicNote, profileInitial = "P", contentPadding = PaddingValues(),
            onSearch = {}, onSwitchSource = {}, onProfile = {}, onFilter = {}, onWork = {}, onArtist = {}, onPlaylist = {}, onTrack = {}, onRetry = {},
        )
    }
}

