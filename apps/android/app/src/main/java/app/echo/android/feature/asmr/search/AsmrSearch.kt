package app.echo.android.feature.asmr.search

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsTopHeight
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.model.Section
import app.echo.data.repository.AsmrRepository
import app.echo.data.repository.LibraryRepository
import app.echo.designsystem.component.m3e.ChipRow
import app.echo.designsystem.component.m3e.ChipSpec
import app.echo.designsystem.component.m3e.ChipStyle
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.component.m3e.EchoSearchField
import app.echo.designsystem.component.m3e.SegmentedList
import app.echo.designsystem.component.m3e.SegmentedListItem
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviewTheme
import app.echo.designsystem.preview.EchoPreviewThemes
import app.echo.designsystem.preview.EchoScreenPreviews
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.tokens.EchoSpacing
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

// ---- UiState ---------------------------------------------------------------------------------------------------

/** 1.2 Search: what's typed, TRENDING chips, RECENT searches (Room) and SUGGESTIONS for the query. */
data class AsmrSearchUiState(
    val query: String = "",
    val trending: List<String> = emptyList(),
    val recent: List<String> = emptyList(),
    val suggestions: List<String> = emptyList(),
)

// ---- ViewModel -------------------------------------------------------------------------------------------------

@OptIn(ExperimentalCoroutinesApi::class, FlowPreview::class)
class AsmrSearchViewModel(private val asmr: AsmrRepository, private val library: LibraryRepository) : ViewModel() {
    private val query = MutableStateFlow("")

    val state: StateFlow<AsmrSearchUiState> = combine(
        query,
        asmr.trendingSearches(),
        library.recentSearches(Section.ASMR),
        query.debounce(SUGGEST_DELAY_MS).flatMapLatest { asmr.suggestions(it) },
    ) { q, trending, recent, suggestions -> AsmrSearchUiState(q, trending, recent, if (q.isBlank()) emptyList() else suggestions) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), AsmrSearchUiState())

    fun setQuery(q: String) { query.value = q }

    /** Saves the search to RECENT; the route then opens 1.3. */
    fun submit(q: String) = viewModelScope.launch { library.addSearch(Section.ASMR, q) }

    fun removeRecent(q: String) = viewModelScope.launch { library.removeSearch(Section.ASMR, q) }

    private companion object {
        const val SUGGEST_DELAY_MS = 150L
    }
}

// ---- Route -----------------------------------------------------------------------------------------------------

@Composable
fun AsmrSearchRoute(shell: ShellActions, contentPadding: PaddingValues) {
    val vm = echoViewModel { AsmrSearchViewModel(it.asmr, it.library) }
    val state by vm.state.collectAsStateWithLifecycle()
    AsmrSearchScreen(
        state = state,
        contentPadding = contentPadding,
        onQueryChange = vm::setQuery,
        onSubmit = { q ->
            if (q.isNotBlank()) {
                vm.submit(q.trim())
                shell.open(Route.AsmrResults(q.trim()))
            }
        },
        onRemoveRecent = vm::removeRecent,
        onBack = shell::back,
    )
}

// ---- Screen ----------------------------------------------------------------------------------------------------

/** Figma 1.2 Search (35:137). */
@Composable
fun AsmrSearchScreen(
    state: AsmrSearchUiState,
    contentPadding: PaddingValues,
    onQueryChange: (String) -> Unit,
    onSubmit: (String) -> Unit,
    onRemoveRecent: (String) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    autoFocus: Boolean = true,
) {
    val focus = remember { FocusRequester() }
    if (autoFocus) LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
    Column(modifier.fillMaxSize().testTag("screen:1.2")) {
        Spacer(Modifier.windowInsetsTopHeight(WindowInsets.statusBars))
        EchoSearchField(
            query = state.query, onQueryChange = onQueryChange, onSearch = onSubmit, onBack = onBack,
            placeholder = stringResource(R.string.asmr_search_placeholder), focusRequester = focus,
        )
        LazyColumn(contentPadding = PaddingValues(bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l)) {
            if (state.trending.isNotEmpty()) {
                item { Label(stringResource(R.string.search_trending)) }
                item {
                    ChipRow(
                        chips = state.trending.map { ChipSpec(it, EchoIcons.Search) },
                        onClick = { onSubmit(state.trending[it]) },
                        style = ChipStyle.Suggestion,
                    )
                }
            }
            if (state.recent.isNotEmpty()) {
                item { Label(stringResource(R.string.search_recent)) }
                item {
                    SegmentedList {
                        state.recent.forEach { q ->
                            item {
                                SegmentedListItem(
                                    headline = q,
                                    onClick = { onSubmit(q) },
                                    leading = { Icon(painterResource(EchoIcons.History), null) },
                                    trailing = { EchoIconButton(EchoIcons.Close, stringResource(R.string.search_remove, q), { onRemoveRecent(q) }) },
                                )
                            }
                        }
                    }
                }
            }
            if (state.suggestions.isNotEmpty()) {
                item { Label(stringResource(R.string.search_suggestions)) }
                items(state.suggestions) { s ->
                    ListItem(
                        headlineContent = { Text(s, style = MaterialTheme.typography.bodyLarge) },
                        leadingContent = { Icon(painterResource(EchoIcons.Search), null) },
                        trailingContent = { EchoIconButton(EchoIcons.NorthWest, stringResource(R.string.search_use, s), { onQueryChange(s) }) },
                        colors = ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.surface),
                        modifier = Modifier.clickableRow { onSubmit(s) },
                    )
                }
            }
        }
    }
}

@Composable
internal fun Label(text: String) = Text(
    text.uppercase(),
    style = MaterialTheme.typography.labelMediumEmphasized,
    color = MaterialTheme.colorScheme.onSurfaceVariant,
    modifier = Modifier.padding(start = EchoSpacing.screenMargin, top = EchoSpacing.m, bottom = EchoSpacing.xs),
)

private fun Modifier.clickableRow(onClick: () -> Unit) = clickable(onClick = onClick)

@EchoScreenPreviews
@Composable
private fun AsmrSearchScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        AsmrSearchScreen(
            state = AsmrSearchUiState(
                query = "rain",
                trending = listOf("rain sounds", "binaural", "no talking", "heartbeat"),
                recent = listOf("rain on window", "ear cleaning binaural", "Circle Aoi"),
                suggestions = listOf("rain sounds", "rain and thunder, binaural", "rainy café whispers", "rain + ear cleaning"),
            ),
            contentPadding = PaddingValues(), onQueryChange = {}, onSubmit = {}, onRemoveRecent = {}, onBack = {}, autoFocus = false,
        )
    }
}
