package app.echo.android.feature.manga.tags

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Icon
import androidx.compose.ui.res.painterResource
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.feature.manga.LoadFallback
import app.echo.android.feature.manga.LetterGroup
import app.echo.android.feature.manga.TagSort
import app.echo.android.feature.manga.groupTags
import app.echo.android.feature.manga.formatCount
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.model.Source
import app.echo.data.model.Tag
import app.echo.data.repository.Load
import app.echo.data.repository.MangaRepository
import app.echo.designsystem.component.echo.AzFastScroller
import app.echo.designsystem.component.echo.EmptyState
import app.echo.designsystem.component.m3e.ConnectedButtonGroup
import app.echo.designsystem.component.m3e.ConnectedOption
import app.echo.designsystem.component.m3e.EchoSearchAppBar
import app.echo.designsystem.component.m3e.InlineSearchBar
import app.echo.designsystem.component.m3e.SectionTabs
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
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import app.echo.data.repository.map as mapLoad

/** Groups for the list: [groups] is empty while the tags load, or when nothing matches. */
data class MangaTagsUiState(
    val query: String = "",
    val sort: TagSort = TagSort.AZ,
    val groups: Load<List<LetterGroup<Tag>>> = Load.Loading,
)

class MangaTagsViewModel(private val manga: MangaRepository) : ViewModel() {
    private val query = MutableStateFlow("")
    private val sort = MutableStateFlow(TagSort.AZ)
    private val reloads = MutableStateFlow(0)

    private val tags = reloads.flatMapLatest { manga.tags() }

    val state: StateFlow<MangaTagsUiState> = combine(query, sort, tags) { q, s, loaded ->
        MangaTagsUiState(q, s, loaded.mapLoad { groupTags(it, q, s) })
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), MangaTagsUiState())

    fun setQuery(text: String) { query.value = text }
    fun setSort(sortBy: TagSort) { sort.value = sortBy }
    fun retry() { reloads.value += 1 }
}

@Composable
fun MangaTagsRoute(shell: ShellActions, source: Source, contentPadding: PaddingValues) {
    val vm = echoViewModel { MangaTagsViewModel(it.manga) }
    val state by vm.state.collectAsStateWithLifecycle()
    MangaTagsScreen(
        state = state,
        sourceName = source.name,
        sectionIcon = shell.sectionIcon(source.section),
        profileInitial = shell.profileInitial,
        contentPadding = contentPadding,
        onSearch = { shell.open(Route.MangaSearch) },
        onSwitchSource = shell::openSourceSwitcher,
        onProfile = shell::openProfile,
        onSection = { i -> shell.open(if (i == 0) Route.MangaBrowse else Route.MangaArtists) },
        onQuery = vm::setQuery,
        onSort = vm::setSort,
        onRetry = vm::retry,
        onTag = { shell.open(Route.TagList(it)) },
    )
}

/** Figma 2.3 Tags index (28:1836): tags grouped by letter, with a letter rail to jump. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MangaTagsScreen(
    state: MangaTagsUiState,
    sourceName: String,
    sectionIcon: Int,
    profileInitial: String,
    contentPadding: PaddingValues,
    onSearch: () -> Unit,
    onSwitchSource: () -> Unit,
    onProfile: () -> Unit,
    onSection: (Int) -> Unit,
    onQuery: (String) -> Unit,
    onSort: (TagSort) -> Unit,
    onRetry: () -> Unit,
    onTag: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(modifier.fillMaxSize().testTag("screen:2.3")) {
        Column(Modifier.fillMaxSize()) {
            EchoSearchAppBar(
                source = sourceName, sectionIcon = sectionIcon, profileInitial = profileInitial,
                onSearch = onSearch, onSwitchSource = onSwitchSource, onProfile = onProfile,
            )
            SectionTabs(
                tabs = listOf(
                    stringResource(R.string.manga_tab_browse),
                    stringResource(R.string.manga_tab_tags),
                    stringResource(R.string.manga_tab_artists),
                ),
                selected = 1,
                onSelect = { if (it != 1) onSection(it) },
            )
            Row(
                Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.s),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                InlineSearchBar(
                    query = state.query,
                    onQueryChange = onQuery,
                    placeholder = stringResource(R.string.manga_search_tags_hint),
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(EchoSpacing.s))
                ConnectedButtonGroup(
                    options = listOf(
                        ConnectedOption(stringResource(R.string.manga_az)),
                        ConnectedOption(stringResource(R.string.manga_popular)),
                    ),
                    selected = state.sort.ordinal,
                    onSelect = { onSort(TagSort.entries[it]) },
                    equalWidth = false,
                )
            }
            val groups = state.groups
            if (groups is Load.Content) {
                TagGroups(groups.value, contentPadding, onTag)
            } else {
                LoadFallback(groups, onRetry)
            }
        }
    }
}

@Composable
private fun TagGroups(groups: List<LetterGroup<Tag>>, contentPadding: PaddingValues, onTag: (String) -> Unit) {
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val currentLetter by remember(groups) {
        derivedStateOf { groups.getOrNull(listState.firstVisibleItemIndex)?.letter.orEmpty() }
    }
    Box(Modifier.fillMaxSize()) {
        LazyColumn(
            state = listState,
            contentPadding = PaddingValues(
                // SegmentedList adds the screen margin itself; the end leaves room for the A–Z rail (Figma 2.3).
                end = EchoSpacing.xl,
                bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l,
            ),
            verticalArrangement = Arrangement.spacedBy(EchoSpacing.s),
        ) {
            itemsIndexed(groups, key = { _, group -> group.letter }) { _, group ->
                Column {
                    if (group.letter.isNotEmpty()) {
                        Text(
                            group.letter,
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(start = EchoSpacing.screenMargin + EchoSpacing.m, bottom = EchoSpacing.xs),
                        )
                    }
                    SegmentedList {
                        group.items.forEach { tag ->
                            item {
                                SegmentedListItem(
                                    headline = tag.name,
                                    onClick = { onTag(tag.id) },
                                    leading = { Icon(painterResource(EchoIcons.LabelFilled), null) },
                                    trailing = {
                                        Text(
                                            formatCount(tag.count),
                                            style = MaterialTheme.typography.labelLarge,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    },
                                )
                            }
                        }
                    }
                }
            }
        }
        AzFastScroller(
            selected = currentLetter.ifEmpty { null },
            onLetter = { letter ->
                val index = groups.indexOfFirst { it.letter == letter }
                if (index >= 0) scope.launch { listState.scrollToItem(index) }
            },
            modifier = Modifier.align(Alignment.TopEnd).padding(top = EchoSpacing.s, end = EchoSpacing.xxs),
        )
    }
}

@EchoScreenPreviews
@Composable
private fun MangaTagsScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        MangaTagsScreen(
            state = MangaTagsUiState(
                groups = Load.Content(
                    listOf(LetterGroup("A", listOf(Tag("tag-A1", "Atag name 1", 1100), Tag("tag-A2", "Atag name 2", 1000)))),
                ),
            ),
            sourceName = "3hentai", sectionIcon = app.echo.designsystem.icon.EchoIcons.MenuBook, profileInitial = "P", contentPadding = PaddingValues(),
            onSearch = {}, onSwitchSource = {}, onProfile = {}, onSection = {}, onQuery = {}, onSort = {}, onRetry = {}, onTag = {},
        )
    }
}
