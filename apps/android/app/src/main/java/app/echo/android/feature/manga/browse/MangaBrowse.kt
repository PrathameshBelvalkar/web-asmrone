package app.echo.android.feature.manga.browse

import app.echo.designsystem.component.echo.CoverKeys
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.feature.manga.LoadFallback
import app.echo.android.feature.manga.MangaLanguage
import app.echo.android.feature.shared.continueMeta
import app.echo.android.feature.shared.openRoute
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.model.ContinueItem
import app.echo.data.model.Gallery
import app.echo.data.model.Section
import app.echo.data.model.Source
import app.echo.data.repository.LibraryRepository
import app.echo.data.repository.Load
import app.echo.data.repository.MangaRepository
import app.echo.data.repository.map
import app.echo.designsystem.component.echo.ContinueCard
import app.echo.designsystem.component.echo.ShelfHeader
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.component.echo.GalleryCard
import app.echo.designsystem.component.m3e.ButtonStyle
import app.echo.designsystem.component.m3e.ComponentSize
import app.echo.designsystem.component.m3e.ConnectedButtonGroup
import app.echo.designsystem.component.m3e.ConnectedOption
import app.echo.designsystem.component.m3e.CoverRow
import app.echo.designsystem.component.m3e.EchoButton
import app.echo.designsystem.component.m3e.EchoSearchAppBar
import app.echo.designsystem.component.m3e.SectionTabs
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
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

data class MangaBrowseUiState(
    /** 0 New · 1 Popular (the connected group). */
    val tab: Int = 0,
    val language: MangaLanguage = MangaLanguage.ALL,
    val galleries: Load<List<Gallery>> = Load.Loading,
    val continueReading: List<ContinueItem> = emptyList(),
)

class MangaBrowseViewModel(private val manga: MangaRepository, library: LibraryRepository) : ViewModel() {
    private val tab = MutableStateFlow(0)
    private val language = MutableStateFlow(MangaLanguage.ALL)
    private val reloads = MutableStateFlow(0)

    private val galleries = combine(tab, language, reloads) { t, l, _ -> t to l }.flatMapLatest { (t, l) ->
        manga.browse(t).map { load -> load.map { list -> list.filter { l.matches(it.language) } } }
    }

    val state: StateFlow<MangaBrowseUiState> = combine(tab, language, galleries, library.continueIn(Section.MANGA)) { t, l, g, c ->
        MangaBrowseUiState(t, l, g, c)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), MangaBrowseUiState())

    fun setTab(index: Int) { tab.value = index }
    fun setLanguage(language: MangaLanguage) { this.language.value = language }
    fun retry() { reloads.value += 1 }
}

@Composable
fun MangaBrowseRoute(shell: ShellActions, source: Source, contentPadding: PaddingValues) {
    val vm = echoViewModel { MangaBrowseViewModel(it.manga, it.library) }
    val state by vm.state.collectAsStateWithLifecycle()
    MangaBrowseScreen(
        state = state,
        sourceName = source.name,
        sectionIcon = shell.sectionIcon(source.section),
        profileInitial = shell.profileInitial,
        contentPadding = contentPadding,
        onSearch = { shell.open(Route.MangaSearch) },
        onSwitchSource = shell::openSourceSwitcher,
        onProfile = shell::openProfile,
        onTab = vm::setTab,
        onSection = { i -> shell.open(if (i == 1) Route.Tags else Route.MangaArtists) },
        onLanguage = vm::setLanguage,
        onRetry = vm::retry,
        onGallery = { shell.open(Route.Gallery(it)) },
        onContinue = { shell.open(it.openRoute()) },
        onLibrary = { shell.open(Route.Library) },
    )
}

/** Figma 2.1 Browse (28:1575): New or Popular galleries, filtered by language, with Continue reading on top. */
@Composable
fun MangaBrowseScreen(
    state: MangaBrowseUiState,
    sourceName: String,
    sectionIcon: Int,
    profileInitial: String,
    contentPadding: PaddingValues,
    onSearch: () -> Unit,
    onSwitchSource: () -> Unit,
    onProfile: () -> Unit,
    onTab: (Int) -> Unit,
    onSection: (Int) -> Unit,
    onLanguage: (MangaLanguage) -> Unit,
    onRetry: () -> Unit,
    onGallery: (String) -> Unit,
    onContinue: (ContinueItem) -> Unit,
    onLibrary: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(modifier.fillMaxSize().testTag("screen:2.1")) {
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
                selected = 0,
                onSelect = { if (it != 0) onSection(it) },
            )
            Controls(state, onTab, onLanguage)
            // Rows of three cards, not a grid: shelf headers keep the screen margin, the cards keep the gaps.
            LazyColumn(
                Modifier.weight(1f),
                contentPadding = PaddingValues(bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l),
            ) {
                if (state.continueReading.isNotEmpty()) {
                    item(key = "continue-header") {
                        ShelfHeader(stringResource(R.string.manga_continue_reading), onClick = onLibrary)
                    }
                    item(key = "continue") {
                        CoverRow(state.continueReading.size) { i ->
                            val item = state.continueReading[i]
                            ContinueCard(
                                title = item.title, meta = continueMeta(item), progress = item.progress,
                                image = item.coverUrl, onClick = { onContinue(item) },
                                width = 112.dp, aspectRatio = 0.7f,
                            )
                        }
                    }
                }
                item(key = "new-header") { ShelfHeader(stringResource(R.string.manga_new)) }
                val galleries = state.galleries
                if (galleries is Load.Content) {
                    items(galleries.value.chunked(3), key = { row -> row.first().id }) { row ->
                        Row(
                            Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.xs),
                            horizontalArrangement = Arrangement.spacedBy(EchoSpacing.coverRowGap),
                        ) {
                            row.forEach { gallery ->
                                GalleryCard(
                                    title = gallery.title, artist = gallery.artist, image = gallery.coverUrl,
                                    onClick = { onGallery(gallery.id) }, modifier = Modifier.weight(1f),
                                    pages = gallery.pageCount, language = gallery.language,
                                    sharedKey = CoverKeys.gallery(gallery.id),
                                )
                            }
                            repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                } else {
                    item(key = "fallback") { LoadFallback(galleries, onRetry) }
                }
            }
        }
    }
}

@Composable
private fun Controls(state: MangaBrowseUiState, onTab: (Int) -> Unit, onLanguage: (MangaLanguage) -> Unit) {
    var menuOpen by remember { mutableStateOf(false) }
    Row(
        Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.s),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        ConnectedButtonGroup(
            options = listOf(
                ConnectedOption(stringResource(R.string.manga_new)),
                ConnectedOption(stringResource(R.string.manga_popular)),
            ),
            selected = state.tab,
            onSelect = onTab,
            modifier = Modifier.weight(1f),
        )
        Spacer(Modifier.width(EchoSpacing.s))
        Box {
            EchoButton(
                text = stringResource(state.language.label),
                onClick = { menuOpen = true },
                style = ButtonStyle.Tonal,
                size = ComponentSize.S,
                icon = EchoIcons.Language,
            )
            DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                MangaLanguage.entries.forEach { language ->
                    DropdownMenuItem(
                        text = { Text(stringResource(language.label)) },
                        onClick = { menuOpen = false; onLanguage(language) },
                    )
                }
            }
        }
    }
}

@EchoScreenPreviews
@Composable
private fun MangaBrowseScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        MangaBrowseScreen(
            state = MangaBrowseUiState(
                galleries = Load.Content(
                    (1..6).map { Gallery("g$it", "Gallery title placeholder", "Artist Name", 20 + it * 3, "JP") },
                ),
            ),
            sourceName = "3hentai", sectionIcon = app.echo.designsystem.icon.EchoIcons.MenuBook, profileInitial = "P", contentPadding = PaddingValues(),
            onSearch = {}, onSwitchSource = {}, onProfile = {}, onTab = {}, onSection = {}, onLanguage = {},
            onRetry = {}, onGallery = {}, onContinue = {}, onLibrary = {},
        )
    }
}
