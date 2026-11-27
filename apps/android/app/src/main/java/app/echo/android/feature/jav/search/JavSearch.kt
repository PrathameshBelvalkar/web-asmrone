package app.echo.android.feature.jav.search

import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsTopHeight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.feature.jav.movieCount
import app.echo.android.feature.jav.movies.Censorship
import app.echo.android.feature.manga.LoadFallback
import app.echo.android.navigation.Route
import app.echo.android.navigation.SectionNav
import app.echo.android.navigation.ShellActions
import app.echo.android.navigation.Tab
import app.echo.android.ui.echoViewModel
import app.echo.data.fake.FakeCatalog
import app.echo.data.model.Idol
import app.echo.data.model.Movie
import app.echo.data.model.Section
import app.echo.data.repository.JavRepository
import app.echo.data.repository.Load
import app.echo.data.repository.map
import app.echo.designsystem.component.echo.CoverImage
import app.echo.designsystem.component.echo.EmptyState
import app.echo.designsystem.component.m3e.ChipRow
import app.echo.designsystem.component.m3e.ChipSpec
import app.echo.designsystem.component.m3e.ConnectedButtonGroup
import app.echo.designsystem.component.m3e.ConnectedOption
import app.echo.designsystem.component.m3e.EchoSearchField
import app.echo.designsystem.component.m3e.SegmentedList
import app.echo.designsystem.component.m3e.SegmentedListItem
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviewTheme
import app.echo.designsystem.preview.EchoPreviewThemes
import app.echo.designsystem.preview.EchoScreenPreviews
import app.echo.designsystem.theme.EchoShapes
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.tokens.EchoSpacing
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

/** Movies · Idols (3.11). */
enum class JavSearchMode { MOVIES, IDOLS }

/** [movies] and [idols] are null until something is typed: the screen shows its prompt. */
data class JavSearchUiState(
    val query: String = "",
    val mode: JavSearchMode = JavSearchMode.MOVIES,
    val censorship: Censorship = Censorship.CENSORED,
    val movies: Load<List<Movie>>? = null,
    val idols: Load<List<Idol>>? = null,
)

class JavSearchViewModel(private val jav: JavRepository) : ViewModel() {
    private val query = MutableStateFlow("")
    private val mode = MutableStateFlow(JavSearchMode.MOVIES)
    private val censorship = MutableStateFlow(Censorship.CENSORED)

    val state: StateFlow<JavSearchUiState> = combine(query, mode, censorship) { q, m, c -> Triple(q, m, c) }
        .flatMapLatest { (q, m, c) ->
            when {
                q.isBlank() -> flowOf(JavSearchUiState(q, m, c))
                m == JavSearchMode.MOVIES -> jav.search(q).map { load ->
                    JavSearchUiState(q, m, c, movies = load.map { list -> list.filter { it.censored == (c == Censorship.CENSORED) } })
                }
                else -> jav.idols().map { load ->
                    JavSearchUiState(q, m, c, idols = load.map { list -> list.filter { it.name.contains(q.trim(), ignoreCase = true) } })
                }
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), JavSearchUiState())

    fun setQuery(value: String) { query.value = value }
    fun setMode(value: JavSearchMode) { mode.value = value }
    fun setCensorship(value: Censorship) { censorship.value = value }
}

@Composable
fun JavSearchRoute(shell: ShellActions, contentPadding: PaddingValues) {
    // Try again builds a fresh ViewModel, which loads again.
    var attempt by rememberSaveable { mutableIntStateOf(0) }
    val vm = echoViewModel(key = "javsearch-$attempt") { JavSearchViewModel(it.jav) }
    val state by vm.state.collectAsStateWithLifecycle()
    JavSearchScreen(
        onRetry = { attempt++ },
        state = state,
        contentPadding = contentPadding,
        onBack = { shell.returnTo(SectionNav.root(Section.JAV, Tab.HOME)) },
        onQuery = vm::setQuery,
        onMode = vm::setMode,
        onCensorship = vm::setCensorship,
        onMovie = { shell.open(Route.Movie(it)) },
        onIdol = { shell.open(Route.Idol(it)) },
    )
}

/** Figma 3.11 Search (28:4469): the query, Movies · Idols, Censored · Uncensored, and the results. */
@Composable
fun JavSearchScreen(
    state: JavSearchUiState,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onQuery: (String) -> Unit,
    onMode: (JavSearchMode) -> Unit,
    onCensorship: (Censorship) -> Unit,
    onMovie: (String) -> Unit,
    onIdol: (String) -> Unit,
    onRetry: () -> Unit = {},
) {
    Column(Modifier.fillMaxSize().testTag("screen:3.11")) {
        Spacer(Modifier.windowInsetsTopHeight(WindowInsets.statusBars))
        EchoSearchField(
            query = state.query, onQueryChange = onQuery, onSearch = {}, onBack = onBack,
            placeholder = stringResource(R.string.jav_search_hint),
        )
        ConnectedButtonGroup(
            options = listOf(ConnectedOption(stringResource(R.string.jav_search_movies)), ConnectedOption(stringResource(R.string.jav_search_idols))),
            selected = state.mode.ordinal,
            onSelect = { onMode(JavSearchMode.entries[it]) },
            modifier = Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.s),
        )
        if (state.mode == JavSearchMode.MOVIES) {
            ChipRow(
                chips = listOf(ChipSpec(stringResource(R.string.jav_censored)), ChipSpec(stringResource(R.string.jav_uncensored))),
                onClick = { onCensorship(Censorship.entries[it]) },
                selected = setOf(state.censorship.ordinal),
                modifier = Modifier.padding(vertical = EchoSpacing.xs + EchoSpacing.xxs),
            )
        }
        val bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l
        when {
            state.query.isBlank() -> EmptyState(
                EchoIcons.Search, stringResource(R.string.jav_search_prompt_title), stringResource(R.string.jav_search_prompt_body),
                Modifier.padding(top = EchoSpacing.xxl),
            )
            state.movies != null -> Results(state.movies, bottom, onRetry) { movie ->
                MovieRow(movie) { onMovie(movie.id) }
            }
            state.idols != null -> Results(state.idols, bottom, onRetry) { idol ->
                SegmentedListItem(
                    headline = idol.name,
                    supporting = movieCount(idol.movieCount),
                    onClick = { onIdol(idol.id) },
                    leading = { CoverImage(idol.imageUrl, null, Modifier.size(56.dp), shape = EchoShapes.Full) },
                )
            }
        }
    }
}

/** A list of results in a segmented list, or the load state. */
@Composable
private fun <T> Results(load: Load<List<T>>, bottom: androidx.compose.ui.unit.Dp, onRetry: () -> Unit, row: @Composable (T) -> Unit) {
    if (load !is Load.Content) {
        LoadFallback(load, onRetry = onRetry)
        return
    }
    LazyColumn(contentPadding = PaddingValues(top = EchoSpacing.s, bottom = bottom)) {
        item { SegmentedList { load.value.forEach { value -> item { row(value) } } } }
    }
}

/** A movie result (Figma "List item"): a 96 × 64 thumbnail, the code, the title, "date · studio". */
@Composable
fun MovieRow(movie: Movie, onClick: () -> Unit) = SegmentedListItem(
    headline = movie.title,
    overline = movie.code,
    supporting = "${movie.releaseDate} · ${movie.studio}",
    onClick = onClick,
    leading = {
        val shape = RoundedCornerShape(10.dp)
        CoverImage(movie.coverUrl, null, Modifier.size(96.dp, 64.dp).border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape), shape = shape)
    },
)

@EchoScreenPreviews
@Composable
private fun JavSearchScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        JavSearchScreen(
            state = JavSearchUiState(query = "ABC-1", movies = Load.Content(FakeCatalog.movies.take(6))),
            contentPadding = PaddingValues(), onBack = {}, onQuery = {}, onMode = {}, onCensorship = {}, onMovie = {}, onIdol = {},
        )
    }
}
