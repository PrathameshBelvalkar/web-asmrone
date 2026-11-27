package app.echo.android.feature.manga.taglist

import app.echo.android.feature.manga.tagUrl
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.feature.manga.LoadFallback
import app.echo.android.feature.manga.formatCount
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.model.Gallery
import app.echo.data.model.Tag
import app.echo.data.repository.Load
import app.echo.data.repository.MangaRepository
import app.echo.android.feature.manga.itemsOrEmpty
import app.echo.designsystem.component.m3e.ConnectedButtonGroup
import app.echo.designsystem.component.m3e.ConnectedOption
import app.echo.designsystem.component.m3e.CoverGrid
import app.echo.designsystem.component.m3e.EchoFlexibleAppBar
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.component.echo.GalleryCard
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviewTheme
import app.echo.designsystem.preview.EchoPreviewThemes
import app.echo.designsystem.preview.EchoScreenPreviews
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.tokens.EchoSpacing
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn

/**
 * [title] and [count] are the tag, artist or name this list is for. Ids are "tag-…" / "artist-…" from the catalogue
 * (2.3, 2.11), or "tag:name" / "artist:name" from a gallery's chips (2.5).
 */
data class MangaTagListUiState(
    val title: String = "",
    val isArtist: Boolean = false,
    val count: Int = 0,
    /** 0 New · 1 24h · 2 7 days · 3 All time. The catalogue has no dates yet, so this only shows the choice. */
    val range: Int = 0,
    val galleries: Load<List<Gallery>> = Load.Loading,
)

class MangaTagListViewModel(private val id: String, private val manga: MangaRepository) : ViewModel() {
    private val range = MutableStateFlow(0)
    private val reloads = MutableStateFlow(0)

    private val galleries: Flow<Load<List<Gallery>>> = reloads.flatMapLatest {
        when {
            id.startsWith("artist:") -> manga.byArtist(id.removePrefix("artist:"))
            id.startsWith("tag:") -> manga.search(id.removePrefix("tag:"))
            else -> manga.byTag(id)
        }
    }

    private val catalogued: Flow<Tag?> = combine(manga.tags(), manga.artists()) { tags, artists ->
        (tags.itemsOrEmpty() + artists.itemsOrEmpty()).firstOrNull { it.id == id }
    }

    val state: StateFlow<MangaTagListUiState> = combine(catalogued, galleries, range) { tag, load, r ->
        val named = id.startsWith("artist:") || id.startsWith("tag:")
        MangaTagListUiState(
            title = if (named) id.substringAfter(':') else tag?.name.orEmpty(),
            isArtist = id.startsWith("artist:") || tag?.id?.startsWith("artist-") == true,
            count = tag?.count ?: load.itemsOrEmpty().size,
            range = r,
            galleries = load,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), MangaTagListUiState())

    fun setRange(index: Int) { range.value = index }
    fun retry() { reloads.value += 1 }
}

@Composable
fun MangaTagListRoute(id: String, shell: ShellActions, contentPadding: PaddingValues) {
    val vm = echoViewModel(key = id) { MangaTagListViewModel(id, it.manga) }
    val state by vm.state.collectAsStateWithLifecycle()
    MangaTagListScreen(
        state = state,
        contentPadding = contentPadding,
        onBack = shell::back,
        onSearch = { shell.open(Route.MangaSearch) },
        onRange = vm::setRange,
        onRetry = vm::retry,
        onGallery = { shell.open(Route.Gallery(it)) },
    )
}

/** Figma 2.4 Tag list (28:1971): one tag, artist or name, as a 3-column grid of galleries. */
@Composable
fun MangaTagListScreen(
    state: MangaTagListUiState,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onSearch: () -> Unit,
    onRange: (Int) -> Unit,
    onRetry: () -> Unit,
    onGallery: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val subtitle = stringResource(
        if (state.isArtist) R.string.manga_artist_subtitle else R.string.manga_tag_subtitle,
        formatCount(state.count),
    )
    Box(modifier.fillMaxSize().testTag("screen:2.4")) {
        Column(Modifier.fillMaxSize()) {
            EchoFlexibleAppBar(
                title = state.title,
                subtitle = subtitle,
                onBack = onBack,
            ) {
                EchoIconButton(EchoIcons.Search, stringResource(app.echo.designsystem.R.string.echo_cd_search), onSearch)
                val uri = LocalUriHandler.current
                EchoIconButton(EchoIcons.OpenInNew, stringResource(R.string.manga_open_cd), { uri.openUri(tagUrl(state.title)) })
            }
            ConnectedButtonGroup(
                options = listOf(
                    ConnectedOption(stringResource(R.string.manga_range_new)),
                    ConnectedOption(stringResource(R.string.manga_range_24h)),
                    ConnectedOption(stringResource(R.string.manga_range_7d)),
                    ConnectedOption(stringResource(R.string.manga_range_all)),
                ),
                selected = state.range,
                onSelect = onRange,
                equalWidth = false,
                modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.s),
            )
            val galleries = state.galleries
            if (galleries is Load.Content) {
                CoverGrid(
                    columns = 3,
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(
                            start = EchoSpacing.screenMargin,
                            end = EchoSpacing.screenMargin,
                            bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l,
                    ),
                ) {
                    items(galleries.value, key = { it.id }) { gallery ->
                        GalleryCard(
                            title = gallery.title, artist = gallery.artist, image = gallery.coverUrl,
                            onClick = { onGallery(gallery.id) }, pages = gallery.pageCount, language = gallery.language,
                        )
                    }
                }
            } else {
                LoadFallback(galleries, onRetry)
            }
        }
    }
}

@EchoScreenPreviews
@Composable
private fun MangaTagListScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        MangaTagListScreen(
            state = MangaTagListUiState(
                title = "Atag name 1", count = 1100, range = 3,
                galleries = Load.Content((1..6).map { Gallery("g$it", "Gallery title placeholder", "Artist Name", 20 + it * 3, "JP") }),
            ),
            contentPadding = PaddingValues(), onBack = {}, onSearch = {}, onRange = {}, onRetry = {}, onGallery = {},
        )
    }
}
