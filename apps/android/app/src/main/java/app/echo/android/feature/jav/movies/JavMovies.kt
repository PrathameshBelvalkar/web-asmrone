package app.echo.android.feature.jav.movies

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.feature.jav.JavHeader
import app.echo.android.feature.jav.JavTab
import app.echo.android.feature.jav.fullWidth
import app.echo.android.feature.jav.gridPadding
import app.echo.android.feature.jav.movieCount
import app.echo.android.feature.jav.movieItems
import app.echo.android.feature.manga.LoadFallback
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.fake.FakeCatalog
import app.echo.data.model.Movie
import app.echo.data.model.MovieList
import app.echo.data.model.MovieListKind
import app.echo.data.model.Source
import app.echo.data.repository.JavRepository
import app.echo.data.repository.Load
import app.echo.data.repository.SettingsRepository
import app.echo.data.repository.map
import app.echo.designsystem.component.m3e.ButtonStyle
import app.echo.designsystem.component.m3e.ChipRow
import app.echo.designsystem.component.m3e.ChipSpec
import app.echo.designsystem.component.m3e.ConnectedButtonGroup
import app.echo.designsystem.component.m3e.ConnectedOption
import app.echo.designsystem.component.m3e.CoverGrid
import app.echo.designsystem.component.m3e.EchoButton
import app.echo.designsystem.component.m3e.EchoFlexibleAppBar
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.component.m3e.EchoSheet
import app.echo.designsystem.component.m3e.IconButtonStyle
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
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn

/** Censored · Uncensored (3.3, 3.4 filter, 3.11). */
enum class Censorship { CENSORED, UNCENSORED }

/** The 3.4 / 3.5 sorts. */
enum class MovieSort { NEWEST, MOST_VIEWED, TOP_RATED }

fun List<Movie>.sortedBy(sort: MovieSort): List<Movie> = when (sort) {
    MovieSort.NEWEST -> sortedByDescending { it.releaseDate }
    MovieSort.MOST_VIEWED -> sortedByDescending { it.views }
    MovieSort.TOP_RATED -> sortedByDescending { it.rating }
}

@Composable
private fun MovieSort.label(): String = stringResource(
    when (this) {
        MovieSort.NEWEST -> R.string.jav_newest
        MovieSort.MOST_VIEWED -> R.string.jav_most_viewed
        MovieSort.TOP_RATED -> R.string.jav_top_rated
    },
)

// 3.3 Latest ---------------------------------------------------------------------------------------------------------

data class JavLatestUiState(
    val censorship: Censorship = Censorship.CENSORED,
    val upcoming: Boolean = false,
    /** S.5 "Hide upcoming movies": the Upcoming chip goes. */
    val hideUpcoming: Boolean = false,
    val movies: Load<List<Movie>> = Load.Loading,
)

class JavLatestViewModel(jav: JavRepository, settings: SettingsRepository) : ViewModel() {
    private val censorship = MutableStateFlow(Censorship.CENSORED)
    private val upcoming = MutableStateFlow(false)

    val state: StateFlow<JavLatestUiState> = combine(jav.latest(), settings.settings, censorship, upcoming) { load, s, c, up ->
        val hide = s.jav.hideUpcoming
        val showUpcoming = up && !hide
        JavLatestUiState(
            censorship = c, upcoming = showUpcoming, hideUpcoming = hide,
            movies = load.map { list ->
                list.filter { it.upcoming == showUpcoming && it.censored == (c == Censorship.CENSORED) }
            },
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), JavLatestUiState())

    fun setCensorship(value: Censorship) { censorship.value = value }
    fun setUpcoming(value: Boolean) { upcoming.value = value }
}

@Composable
fun JavLatestRoute(shell: ShellActions, source: Source, contentPadding: PaddingValues) {
    val vm = echoViewModel { JavLatestViewModel(it.jav, it.settings) }
    val state by vm.state.collectAsStateWithLifecycle()
    JavLatestScreen(
        state = state,
        header = { JavHeader(JavTab.LATEST, shell, source) },
        contentPadding = contentPadding,
        onCensorship = vm::setCensorship,
        onUpcoming = vm::setUpcoming,
        onMovie = { shell.open(Route.Movie(it)) },
    )
}

/** Figma 3.3 Latest (28:3558): Censored · Uncensored, Released · Upcoming, two columns of movies. */
@Composable
fun JavLatestScreen(
    state: JavLatestUiState,
    header: @Composable () -> Unit,
    contentPadding: PaddingValues,
    onCensorship: (Censorship) -> Unit,
    onUpcoming: (Boolean) -> Unit,
    onMovie: (String) -> Unit,
) {
    Column(Modifier.fillMaxSize().testTag("screen:3.3")) {
        header()
        CensorshipGroup(state.censorship, onCensorship)
        val chips = buildList {
            add(ChipSpec(stringResource(R.string.jav_released)))
            if (!state.hideUpcoming) add(ChipSpec(stringResource(R.string.jav_upcoming)))
        }
        ChipRow(
            chips = chips, onClick = { onUpcoming(it == 1) }, selected = setOf(if (state.upcoming) 1 else 0),
            modifier = Modifier.padding(vertical = EchoSpacing.xs + EchoSpacing.xxs),
        )
        MovieGrid(state.movies, contentPadding, onMovie)
    }
}

/** Censored · Uncensored as a full-width connected group (Figma "Button group (Connected)"). */
@Composable
fun CensorshipGroup(selected: Censorship, onSelect: (Censorship) -> Unit, modifier: Modifier = Modifier) = ConnectedButtonGroup(
    options = listOf(ConnectedOption(stringResource(R.string.jav_censored)), ConnectedOption(stringResource(R.string.jav_uncensored))),
    selected = selected.ordinal,
    onSelect = { onSelect(Censorship.entries[it]) },
    modifier = modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.s),
)

/** Two columns of movie cards, or the load state. */
@Composable
private fun MovieGrid(
    movies: Load<List<Movie>>,
    contentPadding: PaddingValues,
    onMovie: (String) -> Unit,
    modifier: Modifier = Modifier,
    top: (androidx.compose.foundation.lazy.grid.LazyGridScope.() -> Unit)? = null,
) {
    CoverGrid(columns = 2, modifier = modifier.fillMaxSize(), contentPadding = gridPadding(contentPadding)) {
        top?.invoke(this)
        when (movies) {
            is Load.Content -> movieItems(movies.value, onMovie)
            else -> fullWidth("state") { LoadFallback(movies, onRetry = {}) }
        }
    }
}

// 3.4 Movies ---------------------------------------------------------------------------------------------------------

data class JavMoviesUiState(
    val sort: MovieSort = MovieSort.NEWEST,
    /** Null: both. */
    val censorship: Censorship? = null,
    val movies: Load<List<Movie>> = Load.Loading,
)

class JavMoviesViewModel(jav: JavRepository) : ViewModel() {
    private val sort = MutableStateFlow(MovieSort.NEWEST)
    private val censorship = MutableStateFlow<Censorship?>(null)

    val state: StateFlow<JavMoviesUiState> = combine(jav.movies(0), sort, censorship) { load, s, c ->
        JavMoviesUiState(
            s, c,
            load.map { list -> list.filter { c == null || it.censored == (c == Censorship.CENSORED) }.sortedBy(s) },
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), JavMoviesUiState())

    fun setSort(value: MovieSort) { sort.value = value }
    fun setCensorship(value: Censorship?) { censorship.value = value }
}

@Composable
fun JavMoviesRoute(shell: ShellActions, source: Source, contentPadding: PaddingValues) {
    val vm = echoViewModel { JavMoviesViewModel(it.jav) }
    val state by vm.state.collectAsStateWithLifecycle()
    JavMoviesScreen(
        state = state,
        header = { JavHeader(JavTab.MOVIES, shell, source) },
        contentPadding = contentPadding,
        onSort = vm::setSort,
        onCensorship = vm::setCensorship,
        onMovie = { shell.open(Route.Movie(it)) },
    )
}

/** Figma 3.4 Movies (28:3670): Newest · Most viewed · Top rated and a filter button over the grid. */
@Composable
fun JavMoviesScreen(
    state: JavMoviesUiState,
    header: @Composable () -> Unit,
    contentPadding: PaddingValues,
    onSort: (MovieSort) -> Unit,
    onCensorship: (Censorship?) -> Unit,
    onMovie: (String) -> Unit,
) {
    var filtering by rememberSaveable { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().testTag("screen:3.4")) {
        header()
        Row(Modifier.fillMaxWidth().padding(end = EchoSpacing.m), verticalAlignment = Alignment.CenterVertically) {
            ChipRow(
                chips = MovieSort.entries.map { ChipSpec(it.label()) },
                onClick = { onSort(MovieSort.entries[it]) },
                selected = setOf(state.sort.ordinal),
                modifier = Modifier.weight(1f).padding(vertical = EchoSpacing.xs + EchoSpacing.xxs),
            )
            EchoIconButton(
                EchoIcons.Tune, stringResource(R.string.jav_filters), { filtering = true },
                style = IconButtonStyle.Tonal, checked = state.censorship != null,
            )
        }
        MovieGrid(state.movies, contentPadding, onMovie)
    }
    if (filtering) {
        EchoSheet(onDismiss = { filtering = false }, title = stringResource(R.string.jav_filters)) {
            // All · Censored · Uncensored; applies straight away.
            ConnectedButtonGroup(
                options = listOf(
                    ConnectedOption(stringResource(R.string.jav_all)),
                    ConnectedOption(stringResource(R.string.jav_censored)),
                    ConnectedOption(stringResource(R.string.jav_uncensored)),
                ),
                selected = state.censorship?.let { it.ordinal + 1 } ?: 0,
                onSelect = { i -> onCensorship(if (i == 0) null else Censorship.entries[i - 1]) },
                modifier = Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin).padding(bottom = EchoSpacing.xxl),
            )
        }
    }
}

// 3.5 Movie list -----------------------------------------------------------------------------------------------------

class JavMovieListViewModel(filter: String, jav: JavRepository) : ViewModel() {
    private val sort = MutableStateFlow(MovieSort.NEWEST)
    val sortState: StateFlow<MovieSort> = sort
    val list: StateFlow<Load<MovieList>> = combine(jav.movieList(filter), sort) { load, s ->
        load.map { it.copy(movies = it.movies.sortedBy(s)) }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), Load.Loading)

    fun setSort(value: MovieSort) { sort.value = value }
}

private const val SITE = "https://www.javdatabase.com/"

@Composable
fun JavMovieListRoute(filter: String, shell: ShellActions, contentPadding: PaddingValues) {
    val vm = echoViewModel(key = "list-$filter") { JavMovieListViewModel(filter, it.jav) }
    val list by vm.list.collectAsStateWithLifecycle()
    val sort by vm.sortState.collectAsStateWithLifecycle()
    val uri = LocalUriHandler.current
    JavMovieListScreen(
        list = list,
        sort = sort,
        contentPadding = contentPadding,
        onBack = shell::back,
        onSearch = { shell.open(Route.JavSearch) },
        onOpenSite = { uri.openUri(SITE) },
        onSort = vm::setSort,
        onMovie = { shell.open(Route.Movie(it)) },
    )
}

/** Figma 3.5 Movie list (28:3780): a studio's, genre's or director's movies, with a sort menu. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JavMovieListScreen(
    list: Load<MovieList>,
    sort: MovieSort,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onSearch: () -> Unit,
    onOpenSite: () -> Unit,
    onSort: (MovieSort) -> Unit,
    onMovie: (String) -> Unit,
) {
    val scroll = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    val loaded = list as? Load.Content
    Column(Modifier.fillMaxSize().nestedScroll(scroll.nestedScrollConnection).testTag("screen:3.5")) {
        EchoFlexibleAppBar(
            title = loaded?.value?.title ?: stringResource(R.string.jav_list_all),
            subtitle = loaded?.value?.let { listSubtitle(it) },
            onBack = onBack,
            scrollBehavior = scroll,
            actions = {
                EchoIconButton(EchoIcons.Search, stringResource(R.string.jav_search), onSearch)
                EchoIconButton(EchoIcons.OpenInNew, stringResource(R.string.jav_open_site), onOpenSite)
            },
        )
        MovieGrid(
            movies = list.map { it.movies },
            contentPadding = contentPadding,
            onMovie = onMovie,
            top = { fullWidth("sort") { SortMenu(sort, onSort) } },
        )
    }
}

@Composable
private fun listSubtitle(list: MovieList): String {
    val count = movieCount(list.count)
    return when (list.kind) {
        MovieListKind.STUDIO -> stringResource(R.string.jav_list_studio, count)
        MovieListKind.GENRE -> stringResource(R.string.jav_list_genre, count)
        MovieListKind.DIRECTOR -> stringResource(R.string.jav_list_director, count)
        MovieListKind.ALL -> count
    }
}

/** "⌄ Newest" (Tonal, S) and its menu. */
@Composable
private fun SortMenu(sort: MovieSort, onSort: (MovieSort) -> Unit) {
    var open by rememberSaveable { mutableStateOf(false) }
    Box(Modifier.padding(bottom = EchoSpacing.s)) {
        EchoButton(sort.label(), { open = true }, style = ButtonStyle.Tonal, icon = EchoIcons.ExpandMore)
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            MovieSort.entries.forEach { s ->
                DropdownMenuItem(
                    text = { Text(s.label()) },
                    onClick = { onSort(s); open = false },
                    leadingIcon = if (s == sort) {
                        { Icon(painterResource(EchoIcons.Check), null) }
                    } else {
                        null
                    },
                )
            }
        }
    }
}

// Previews -----------------------------------------------------------------------------------------------------------

@EchoScreenPreviews
@Composable
private fun JavLatestScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        JavLatestScreen(
            state = JavLatestUiState(movies = Load.Content(FakeCatalog.movies.filter { !it.upcoming && it.censored }.take(6))),
            header = { JavHeader(JavTab.LATEST, "javdatabase", EchoIcons.Movie, "P", {}, {}, {}, {}) },
            contentPadding = PaddingValues(), onCensorship = {}, onUpcoming = {}, onMovie = {},
        )
    }
}

@EchoScreenPreviews
@Composable
private fun JavMovieListScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        val movies = FakeCatalog.movies.take(6)
        JavMovieListScreen(
            list = Load.Content(MovieList("Example Studio", MovieListKind.STUDIO, 1284, movies)),
            sort = MovieSort.NEWEST, contentPadding = PaddingValues(),
            onBack = {}, onSearch = {}, onOpenSite = {}, onSort = {}, onMovie = {},
        )
    }
}
