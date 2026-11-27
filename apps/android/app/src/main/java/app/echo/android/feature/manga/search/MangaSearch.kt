package app.echo.android.feature.manga.search

import app.echo.designsystem.component.echo.CoverKeys
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsTopHeight
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.feature.manga.LoadFallback
import app.echo.android.feature.manga.MangaLanguage
import app.echo.android.navigation.Route
import app.echo.android.navigation.SectionNav
import app.echo.android.navigation.Tab
import app.echo.data.model.Source
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.model.Gallery
import app.echo.data.repository.Load
import app.echo.data.repository.MangaRepository
import app.echo.data.repository.map
import app.echo.designsystem.component.echo.EmptyState
import app.echo.designsystem.component.echo.GalleryCard
import app.echo.designsystem.component.m3e.ChipRow
import app.echo.designsystem.component.m3e.ChipSpec
import app.echo.designsystem.component.m3e.CoverGrid
import app.echo.designsystem.component.m3e.EchoSearchField
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
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

/** [results] is null until something is typed: the screen shows its prompt. */
data class MangaSearchUiState(
    val query: String = "",
    val language: MangaLanguage = MangaLanguage.ALL,
    val results: Load<List<Gallery>>? = null,
)

class MangaSearchViewModel(private val manga: MangaRepository) : ViewModel() {
    private val query = MutableStateFlow("")
    private val language = MutableStateFlow(MangaLanguage.ALL)
    private val reloads = MutableStateFlow(0)
    /** The last results shown: kept while the next query loads, so the grid doesn't jump to the top. */
    private var shown: List<Gallery> = emptyList()

    val state: StateFlow<MangaSearchUiState> = combine(query, language, reloads) { q, l, _ -> q to l }
        .flatMapLatest { (q, l) ->
            if (q.isBlank()) {
                flowOf(MangaSearchUiState(q, l, null))
            } else {
                manga.search(q).map { load ->
                    val filtered = load.map { list -> list.filter { l.matches(it.language) } }
                    if (filtered is Load.Content) shown = filtered.value
                    val keep = if (filtered is Load.Loading && shown.isNotEmpty()) Load.Content(shown) else filtered
                    MangaSearchUiState(q, l, keep)
                }
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), MangaSearchUiState())

    fun setQuery(text: String) { query.value = text }
    fun setLanguage(language: MangaLanguage) { this.language.value = language }
    fun retry() { reloads.value += 1 }
}

@Composable
fun MangaSearchRoute(shell: ShellActions, source: Source, contentPadding: PaddingValues) {
    val vm = echoViewModel { MangaSearchViewModel(it.manga) }
    val state by vm.state.collectAsStateWithLifecycle()
    MangaSearchScreen(
        state = state,
        contentPadding = contentPadding,
        onBack = { shell.returnTo(SectionNav.root(source.section, Tab.HOME)) },
        onQuery = vm::setQuery,
        onLanguage = vm::setLanguage,
        onRetry = vm::retry,
        onGallery = { shell.open(Route.Gallery(it)) },
    )
}

/** Figma 2.2 Search (28:1728): query, language filter, and the results as a 3-column grid. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MangaSearchScreen(
    state: MangaSearchUiState,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onQuery: (String) -> Unit,
    onLanguage: (MangaLanguage) -> Unit,
    onRetry: () -> Unit,
    onGallery: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(modifier.fillMaxSize().testTag("screen:2.2")) {
        Column(Modifier.fillMaxSize()) {
            Spacer(Modifier.windowInsetsTopHeight(WindowInsets.statusBars))
            EchoSearchField(
                query = state.query,
                onQueryChange = onQuery,
                onSearch = {},
                onBack = onBack,
            )
            ChipRow(
                chips = MangaLanguage.entries.map { ChipSpec(stringResource(it.label)) },
                onClick = { onLanguage(MangaLanguage.entries[it]) },
                selected = setOf(state.language.ordinal),
                modifier = Modifier.padding(bottom = EchoSpacing.s),
            )
            val results = state.results
            when {
                results == null -> EmptyState(
                    EchoIcons.Search, stringResource(R.string.manga_search_prompt_title),
                    stringResource(R.string.manga_search_prompt_body), Modifier.padding(top = EchoSpacing.xxl),
                )
                results is Load.Content -> {
                    Text(
                        stringResource(R.string.manga_results, results.value.size),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin + EchoSpacing.s, vertical = EchoSpacing.xs),
                    )
                    CoverGrid(
                        columns = 3,
                        modifier = Modifier.weight(1f),
                        contentPadding = PaddingValues(
                            start = EchoSpacing.screenMargin,
                            end = EchoSpacing.screenMargin,
                            bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l,
                        ),
                    ) {
                        items(results.value, key = { it.id }) { gallery ->
                            GalleryCard(
                                title = gallery.title, artist = gallery.artist, image = gallery.coverUrl,
                                onClick = { onGallery(gallery.id) }, pages = gallery.pageCount, language = gallery.language,
                                sharedKey = CoverKeys.gallery(gallery.id),
                            )
                        }
                    }
                }
                else -> Box(Modifier.fillMaxWidth()) { LoadFallback(results, onRetry) }
            }
        }
    }
}

@EchoScreenPreviews
@Composable
private fun MangaSearchScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        MangaSearchScreen(
            state = MangaSearchUiState(
                query = "orita",
                results = Load.Content((1..6).map { Gallery("g$it", "Gallery title placeholder", "Artist Name", 20 + it * 3, "JP") }),
            ),
            contentPadding = PaddingValues(), onBack = {}, onQuery = {}, onLanguage = {}, onRetry = {}, onGallery = {},
        )
    }
}
