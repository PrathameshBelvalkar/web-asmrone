package app.echo.android.feature.manga.artists

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.ui.Alignment
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import app.echo.designsystem.component.echo.CoverImage
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
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
import app.echo.android.feature.manga.TagSort
import app.echo.android.feature.manga.formatCount
import app.echo.android.feature.manga.groupTags
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.model.Source
import app.echo.data.model.Tag
import app.echo.data.repository.Load
import app.echo.data.repository.MangaRepository
import app.echo.data.repository.map
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

data class MangaArtistsUiState(
    val query: String = "",
    val sort: TagSort = TagSort.POPULAR,
    val artists: Load<List<Tag>> = Load.Loading,
)

class MangaArtistsViewModel(manga: MangaRepository) : ViewModel() {
    private val query = MutableStateFlow("")
    private val sort = MutableStateFlow(TagSort.POPULAR)
    private val reloads = MutableStateFlow(0)
    private val catalogue = reloads.flatMapLatest { manga.artists() }

    val state: StateFlow<MangaArtistsUiState> = combine(query, sort, catalogue) { q, s, loaded ->
        MangaArtistsUiState(q, s, loaded.map { groupTags(it, q, s).flatMap { group -> group.items } })
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), MangaArtistsUiState())

    fun setQuery(text: String) { query.value = text }
    fun setSort(sortBy: TagSort) { sort.value = sortBy }
    fun retry() { reloads.value += 1 }
}

@Composable
fun MangaArtistsRoute(shell: ShellActions, source: Source, contentPadding: PaddingValues) {
    val vm = echoViewModel { MangaArtistsViewModel(it.manga) }
    val state by vm.state.collectAsStateWithLifecycle()
    MangaArtistsScreen(
        state = state,
        sourceName = source.name,
        sectionIcon = shell.sectionIcon(source.section),
        profileInitial = shell.profileInitial,
        contentPadding = contentPadding,
        onSearch = { shell.open(Route.MangaSearch) },
        onSwitchSource = shell::openSourceSwitcher,
        onProfile = shell::openProfile,
        onSection = { i -> shell.open(if (i == 0) Route.MangaBrowse else Route.Tags) },
        onQuery = vm::setQuery,
        onSort = vm::setSort,
        onRetry = vm::retry,
        onArtist = { shell.open(Route.TagList(it)) },
    )
}

/** Figma 2.11 Artists index (28:3214): artists by gallery count, or A–Z, with a search field. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MangaArtistsScreen(
    state: MangaArtistsUiState,
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
    onArtist: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(modifier.fillMaxSize().testTag("screen:2.11")) {
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
                selected = 2,
                onSelect = { if (it != 2) onSection(it) },
            )
            Row(
                Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.s),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                InlineSearchBar(
                    query = state.query,
                    onQueryChange = onQuery,
                    placeholder = stringResource(R.string.manga_search_artists_hint),
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
            val artists = state.artists
            if (artists is Load.Content) {
                LazyColumn(
                    contentPadding = PaddingValues(
                        top = EchoSpacing.s,
                        bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l,
                    ),
                    verticalArrangement = Arrangement.spacedBy(EchoSpacing.s),
                ) {
                    item {
                        Text(
                            stringResource(R.string.manga_most_galleries),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin + EchoSpacing.s),
                        )
                    }
                    item {
                        SegmentedList {
                            artists.value.forEach { artist ->
                                item {
                                    SegmentedListItem(
                                        headline = artist.name,
                                        supporting = stringResource(R.string.manga_artist_galleries, formatCount(artist.count)),
                                        onClick = { onArtist(artist.id) },
                                        leading = { CoverImage(null, null, Modifier.size(40.dp), shape = CircleShape) },
                                        trailing = { Icon(painterResource(EchoIcons.ArrowForward), null) },
                                    )
                                }
                            }
                        }
                    }
                }
            } else {
                LoadFallback(artists, onRetry)
            }
        }
    }
}

@EchoScreenPreviews
@Composable
private fun MangaArtistsScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        MangaArtistsScreen(
            state = MangaArtistsUiState(
                artists = Load.Content(listOf(Tag("artist-A1", "A. Artist Name 1", 33), Tag("artist-B1", "B. Artist Name 1", 26))),
            ),
            sourceName = "3hentai", sectionIcon = app.echo.designsystem.icon.EchoIcons.MenuBook, profileInitial = "P", contentPadding = PaddingValues(),
            onSearch = {}, onSwitchSource = {}, onProfile = {}, onSection = {}, onQuery = {}, onSort = {}, onRetry = {}, onArtist = {},
        )
    }
}
