package app.echo.android.feature.hentai.search

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsTopHeight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.feature.hentai.titleCount
import app.echo.android.feature.manga.LoadFallback
import app.echo.android.navigation.Route
import app.echo.android.navigation.SectionNav
import app.echo.android.navigation.ShellActions
import app.echo.android.navigation.Tab
import app.echo.android.ui.echoViewModel
import app.echo.data.fake.FakeCatalog
import app.echo.data.model.HentaiTag
import app.echo.data.model.HentaiTitle
import app.echo.data.model.Section
import app.echo.data.model.Tag
import app.echo.data.repository.HentaiRepository
import app.echo.data.repository.Load
import app.echo.designsystem.component.echo.CoverImage
import app.echo.designsystem.component.echo.EmptyState
import app.echo.designsystem.component.m3e.EchoSearchField
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
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn

/** A series found by H.6: its name, its first title (opened on tap) and how many episodes it has. */
data class SeriesHit(val name: String, val firstId: String, val episodes: Int)

/** H.6 results by group; [titles] is null until something is typed. */
data class HentaiSearchUiState(
    val query: String = "",
    val titles: Load<List<HentaiTitle>>? = null,
    val series: List<SeriesHit> = emptyList(),
    val tags: List<HentaiTag> = emptyList(),
    val studios: List<Tag> = emptyList(),
)

class HentaiSearchViewModel(private val hentai: HentaiRepository) : ViewModel() {
    private val query = MutableStateFlow("")

    val state: StateFlow<HentaiSearchUiState> = query.flatMapLatest { q ->
        if (q.isBlank()) {
            flowOf(HentaiSearchUiState(q))
        } else {
            combine(hentai.search(q), hentai.catalog(), hentai.tags(), hentai.studios()) { hits, all, tags, studios ->
                val catalog = (all as? Load.Content)?.value.orEmpty()
                val needle = q.trim()
                HentaiSearchUiState(
                    query = q,
                    titles = hits,
                    series = catalog.filter { it.series?.contains(needle, ignoreCase = true) == true }
                        .groupBy { it.series!! }
                        .map { (name, list) -> SeriesHit(name, list.first().id, list.sumOf { it.episodes.size }) },
                    tags = (tags as? Load.Content)?.value.orEmpty().filter { it.name.contains(needle, ignoreCase = true) },
                    studios = (studios as? Load.Content)?.value.orEmpty().filter { it.name.contains(needle, ignoreCase = true) },
                )
            }
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), HentaiSearchUiState())

    fun setQuery(value: String) { query.value = value }
}

@Composable
fun HentaiSearchRoute(shell: ShellActions, contentPadding: PaddingValues) {
    val vm = echoViewModel { HentaiSearchViewModel(it.hentai) }
    val state by vm.state.collectAsStateWithLifecycle()
    HentaiSearchScreen(
        state = state,
        contentPadding = contentPadding,
        onBack = { shell.returnTo(SectionNav.root(Section.HENTAI, Tab.HOME)) },
        onQuery = vm::setQuery,
        onTitle = { shell.open(Route.HentaiTitle(it)) },
        onTag = { shell.open(Route.HentaiTitles(tag = it)) },
        onStudio = { shell.open(Route.HentaiTitles(studio = it)) },
        onSearchAll = { shell.open(Route.HentaiTitles(query = it)) },
    )
}

/** Figma H.6 Search (28:5652): TITLES, SERIES, TAGS, STUDIOS, then "Search for …" → H.3. */
@Composable
fun HentaiSearchScreen(
    state: HentaiSearchUiState,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onQuery: (String) -> Unit,
    onTitle: (String) -> Unit,
    onTag: (String) -> Unit,
    onStudio: (String) -> Unit,
    onSearchAll: (String) -> Unit,
) {
    Column(Modifier.fillMaxSize().testTag("screen:H.6")) {
        Spacer(Modifier.windowInsetsTopHeight(WindowInsets.statusBars))
        EchoSearchField(
            query = state.query, onQueryChange = onQuery, onSearch = { if (it.isNotBlank()) onSearchAll(it) }, onBack = onBack,
            placeholder = stringResource(R.string.hentai_search_hint),
        )
        val titles = state.titles
        when {
            titles == null -> EmptyState(
                EchoIcons.Search, stringResource(R.string.hentai_search_prompt_title), stringResource(R.string.hentai_search_prompt_body),
                Modifier.padding(top = EchoSpacing.xxl),
            )
            titles is Load.Loading -> LoadFallback(titles, onRetry = {})
            else -> LazyColumn(contentPadding = PaddingValues(bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l)) {
                val hits = (titles as? Load.Content)?.value.orEmpty()
                if (hits.isNotEmpty()) {
                    item("titles") {
                        Group(R.string.hentai_search_titles) {
                            SegmentedList {
                                hits.take(MAX_TITLES).forEach { t ->
                                    item {
                                        SegmentedListItem(
                                            headline = t.title,
                                            supporting = stringResource(R.string.hentai_result_title, t.episodes.firstOrNull()?.number ?: 1, t.studio, t.year),
                                            onClick = { onTitle(t.id) },
                                            leading = {
                                                val shape = RoundedCornerShape(8.dp)
                                                CoverImage(t.coverUrl, null, Modifier.size(40.dp, 56.dp).border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape), shape = shape)
                                            },
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
                if (state.series.isNotEmpty()) {
                    item("series") {
                        Group(R.string.hentai_search_series) {
                            SegmentedList {
                                state.series.forEach { s ->
                                    item { ResultRow(s.name, stringResource(R.string.hentai_result_series, s.episodes), EchoIcons.GridView) { onTitle(s.firstId) } }
                                }
                            }
                        }
                    }
                }
                if (state.tags.isNotEmpty()) {
                    item("tags") {
                        Group(R.string.hentai_search_tags) {
                            SegmentedList {
                                state.tags.forEach { t ->
                                    item { ResultRow(t.name, stringResource(R.string.hentai_result_tag, titleCount(t.count)), EchoIcons.LabelFilled) { onTag(t.name) } }
                                }
                            }
                        }
                    }
                }
                if (state.studios.isNotEmpty()) {
                    item("studios") {
                        Group(R.string.hentai_search_studios) {
                            SegmentedList {
                                state.studios.forEach { s ->
                                    item { ResultRow(s.name, stringResource(R.string.hentai_result_studio, titleCount(s.count)), EchoIcons.PersonFilled) { onStudio(s.name) } }
                                }
                            }
                        }
                    }
                }
                item("all") {
                    SegmentedListItem(
                        headline = stringResource(R.string.hentai_search_for, state.query.trim()),
                        onClick = { onSearchAll(state.query.trim()) },
                        selected = true,
                        leading = { Icon(painterResource(EchoIcons.Search), null) },
                        trailing = { Icon(painterResource(EchoIcons.ArrowForward), null) },
                        modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.m),
                    )
                }
            }
        }
    }
}

private const val MAX_TITLES = 5

@Composable
private fun Group(label: Int, content: @Composable () -> Unit) {
    Column {
        Text(
            stringResource(label).uppercase(),
            style = MaterialTheme.typography.labelMediumEmphasized,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(start = EchoSpacing.screenMargin, top = EchoSpacing.m, bottom = EchoSpacing.s),
        )
        content()
    }
}

@Composable
private fun ResultRow(headline: String, supporting: String, icon: Int, onClick: () -> Unit) = SegmentedListItem(
    headline = headline,
    supporting = supporting,
    onClick = onClick,
    leading = { Icon(painterResource(icon), null) },
    trailing = { Icon(painterResource(EchoIcons.ArrowForward), null) },
)

@EchoScreenPreviews
@Composable
private fun HentaiSearchScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        HentaiSearchScreen(
            state = HentaiSearchUiState(
                query = "ro",
                titles = Load.Content(FakeCatalog.hentaiTitles.take(3)),
                series = listOf(SeriesHit("Series name 1", "h1", 3)),
                tags = FakeCatalog.hentaiTags.filter { it.name.contains("ro", true) },
                studios = FakeCatalog.hentaiStudioTags.take(1),
            ),
            contentPadding = PaddingValues(), onBack = {}, onQuery = {}, onTitle = {}, onTag = {}, onStudio = {}, onSearchAll = {},
        )
    }
}
