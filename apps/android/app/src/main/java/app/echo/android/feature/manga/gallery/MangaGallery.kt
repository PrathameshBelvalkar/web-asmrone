package app.echo.android.feature.manga.gallery

import app.echo.designsystem.component.echo.CoverKeys
import app.echo.android.feature.manga.galleryUrl
import app.echo.android.ui.shareText
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.LocalContext
import app.echo.designsystem.component.echo.CoverImage
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.LinearWavyProgressIndicator
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.material3.AssistChip
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.feature.manga.LoadFallback
import app.echo.android.feature.manga.languageName
import app.echo.android.feature.manga.pageRows
import app.echo.android.feature.shared.sectionLabel
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.model.ContinueItem
import app.echo.data.model.Gallery
import app.echo.data.model.Section
import app.echo.data.repository.LibraryRepository
import app.echo.data.repository.Load
import app.echo.data.repository.MangaRepository
import app.echo.data.repository.map
import app.echo.designsystem.component.echo.GalleryCard
import app.echo.designsystem.component.echo.MediaHeader
import app.echo.designsystem.component.echo.MediaHeaderStyle
import app.echo.designsystem.component.echo.ShelfHeader
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.component.m3e.EchoSmallAppBar
import app.echo.designsystem.component.m3e.EchoSplitButton
import app.echo.designsystem.component.m3e.IconButtonStyle
import app.echo.designsystem.component.m3e.IconButtonShape
import app.echo.designsystem.component.m3e.ComponentSize
import app.echo.designsystem.component.echo.PageMock
import app.echo.designsystem.component.echo.LikeButton
import app.echo.designsystem.component.m3e.SplitMenuItem
import app.echo.designsystem.component.m3e.CoverRow
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
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

data class MangaGalleryUiState(
    val gallery: Load<Gallery> = Load.Loading,
    /** This gallery's row in 0.2 / 0.3: where to resume, and how far. Null when never opened. */
    val progress: ContinueItem? = null,
    val moreBy: Load<List<Gallery>> = Load.Loading,
    val bookmarked: Boolean = false,
)

class MangaGalleryViewModel(private val id: String, private val manga: MangaRepository, library: LibraryRepository) : ViewModel() {
    private val reloads = MutableStateFlow(0)
    private val bookmark = MutableStateFlow(false)
    private val gallery: Flow<Load<Gallery>> = reloads.flatMapLatest { manga.gallery(id) }

    private val moreBy: Flow<Load<List<Gallery>>> = gallery.flatMapLatest { load ->
        val current = (load as? Load.Content)?.value
        val artist = current?.artist
        when {
            artist != null -> manga.byArtist(artist).map { it.map { list -> list.filter { g -> g.id != id }.take(8) } }
            load is Load.Loading -> flowOf(Load.Loading)
            else -> flowOf(Load.Empty)
        }
    }

    private val progress: Flow<ContinueItem?> = library.history(Section.MANGA).map { rows -> rows.firstOrNull { it.id == id } }

    val state: StateFlow<MangaGalleryUiState> = combine(gallery, progress, moreBy, bookmark) { g, p, more, marked ->
        MangaGalleryUiState(g, p, more, marked)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), MangaGalleryUiState())

    fun toggleBookmark() { bookmark.value = !bookmark.value }
    fun retry() { reloads.value += 1 }
}

@Composable
fun MangaGalleryRoute(id: String, shell: ShellActions, contentPadding: PaddingValues) {
    val vm = echoViewModel(key = id) { MangaGalleryViewModel(id, it.manga, it.library) }
    val state by vm.state.collectAsStateWithLifecycle()
    MangaGalleryScreen(
        state = state,
        contentPadding = contentPadding,
        onBack = shell::back,
        onOpenReader = { page -> shell.open(Route.Reader(id, page)) },
        onOpenPages = { shell.open(Route.Reader(id, state.progress?.page?.coerceAtLeast(1) ?: 1, showPages = true)) },
        onBookmark = vm::toggleBookmark,
        onTag = { shell.open(Route.TagList(it)) },
        onGallery = { shell.open(Route.Gallery(it)) },
        onRetry = vm::retry,
    )
}

/** Figma 2.5 Gallery (28:2113): cover and details, read or resume, tags and artist, page thumbnails, more by artist. */
@Composable
fun MangaGalleryScreen(
    state: MangaGalleryUiState,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onOpenReader: (Int) -> Unit,
    onOpenPages: () -> Unit,
    onBookmark: () -> Unit,
    onTag: (String) -> Unit,
    onGallery: (String) -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(modifier.fillMaxSize().testTag("screen:2.5")) {
        Column(Modifier.fillMaxSize()) {
            EchoSmallAppBar(title = "", onBack = onBack) {
                val loaded = (state.gallery as? Load.Content)?.value
                val context = LocalContext.current
                val uri = LocalUriHandler.current
                EchoIconButton(EchoIcons.Share, stringResource(R.string.manga_share_cd), {
                    loaded?.let { context.shareText("${it.title}\n${galleryUrl(it.id)}") }
                })
                EchoIconButton(EchoIcons.OpenInNew, stringResource(R.string.manga_open_cd), { loaded?.let { uri.openUri(galleryUrl(it.id)) } })
            }
            val gallery = state.gallery
            if (gallery is Load.Content) {
                GalleryBody(state, gallery.value, contentPadding, onOpenReader, onOpenPages, onBookmark, onTag, onGallery)
            } else {
                LoadFallback(gallery, onRetry)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3ExpressiveApi::class)
@Composable
private fun GalleryBody(
    state: MangaGalleryUiState,
    gallery: Gallery,
    contentPadding: PaddingValues,
    onOpenReader: (Int) -> Unit,
    onOpenPages: () -> Unit,
    onBookmark: () -> Unit,
    onTag: (String) -> Unit,
    onGallery: (String) -> Unit,
) {
    val resumePage = state.progress?.takeIf { !it.finished && it.page > 0 }?.page
    val tagRows = listOf(
        Triple(R.string.manga_group_parodies, gallery.parodies, "tag:"),
        Triple(R.string.manga_group_characters, gallery.characters, "tag:"),
        Triple(R.string.manga_group_tags, gallery.tags, "tag:"),
        Triple(R.string.manga_group_artists, listOfNotNull(gallery.artist), "artist:"),
        Triple(R.string.manga_group_groups, gallery.groups, "tag:"),
    ).filter { it.second.isNotEmpty() }
    LazyColumn(contentPadding = PaddingValues(bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l)) {
        item {
            MediaHeader(
                title = gallery.title,
                artist = gallery.artist,
                meta = listOf(
                    stringResource(R.string.manga_gallery_meta, gallery.pageCount, languageName(gallery.language), gallery.category),
                    stringResource(R.string.manga_added, gallery.addedOn),
                ),
                cover = gallery.coverUrl,
                style = MediaHeaderStyle.Gallery,
                coverKey = CoverKeys.gallery(gallery.id),
                onArtistClick = gallery.artist?.let { artist -> { onTag("artist:$artist") } },
            )
        }
        item {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.s),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                EchoSplitButton(
                    text = if (resumePage != null) stringResource(R.string.manga_continue_page, resumePage) else stringResource(R.string.manga_read),
                    onClick = { onOpenReader(resumePage ?: 1) },
                    menu = listOf(
                        SplitMenuItem(stringResource(R.string.manga_start_over)) { onOpenReader(1) },
                        SplitMenuItem(stringResource(R.string.manga_choose_page)) { onOpenPages() },
                    ),
                    icon = EchoIcons.MenuBook,
                )
                Spacer(Modifier.weight(1f))
                // Figma 2.5: pages grid as a 56 dp tonal square, then the shared like toggle (same as 1.5 / 1.8).
                EchoIconButton(
                    EchoIcons.GridView, stringResource(R.string.manga_pages_cd), onOpenPages,
                    style = IconButtonStyle.Tonal, size = ComponentSize.M, shape = IconButtonShape.Square,
                )
                Spacer(Modifier.width(EchoSpacing.s))
                LikeButton(liked = state.bookmarked, onToggle = onBookmark)
            }
        }
        state.progress?.let { progress ->
            item {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    LinearWavyProgressIndicator(progress = { progress.progress }, modifier = Modifier.weight(1f))
                    Spacer(Modifier.width(EchoSpacing.s))
                    Text(
                        stringResource(R.string.manga_read_percent, (progress.progress * 100).toInt()),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        items(tagRows) { (label, names, prefix) ->
            TagRow(stringResource(label), names, avatars = prefix == "artist:") { index -> onTag(prefix + names[index]) }
        }
        item {
            ShelfHeader(
                stringResource(R.string.manga_pages_title, gallery.pageCount),
                Modifier.padding(top = EchoSpacing.s),
                onClick = onOpenPages,
            )
        }
        items(pageRows(gallery.pageCount, columns = 4)) { row ->
            Row(
                Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.xs),
                horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s),
            ) {
                row.forEach { page ->
                    PageThumb(page, Modifier.weight(1f), onClick = { onOpenReader(page) })
                }
                repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
        if (state.moreBy is Load.Content && state.moreBy.value.isNotEmpty()) {
            item {
                ShelfHeader(stringResource(R.string.manga_more_by, gallery.artist.orEmpty()), Modifier.padding(top = EchoSpacing.s))
            }
            item {
                CoverRow(state.moreBy.value.size) { i ->
                    val more = state.moreBy.value[i]
                    GalleryCard(
                        title = more.title, artist = more.artist, image = more.coverUrl,
                        onClick = { onGallery(more.id) }, width = 128.dp, pages = more.pageCount, language = more.language,
                        sharedKey = CoverKeys.gallery(more.id),
                    )
                }
            }
        }
    }
}

private val ArtistAvatarSize = 24.dp

/** A row of tags (Figma 2.5): the label on the left, the chips wrapping on the right. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TagRow(label: String, names: List<String>, avatars: Boolean = false, onClick: (Int) -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.xxs),
        verticalAlignment = Alignment.Top,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelSmallEmphasized,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(TagLabelWidth).padding(top = EchoSpacing.s + EchoSpacing.xxs),
        )
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(EchoSpacing.xs),
            verticalArrangement = Arrangement.spacedBy(EchoSpacing.xs),
        ) {
            names.forEachIndexed { index, name ->
                AssistChip(
                    onClick = { onClick(index) },
                    label = { Text(name) },
                    leadingIcon = if (avatars) {
                        { CoverImage(null, null, Modifier.size(ArtistAvatarSize), shape = CircleShape) }
                    } else {
                        null
                    },
                )
            }
        }
    }
}

@Composable
private fun PageThumb(page: Int, modifier: Modifier, onClick: () -> Unit) {
    Column(modifier.clickable(onClick = onClick), horizontalAlignment = Alignment.CenterHorizontally) {
        PageMock(Modifier.fillMaxWidth().aspectRatio(0.7f).clip(MaterialTheme.shapes.extraSmall))
        Text("$page", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

/** Figma 2.5: chips start 84 dp from the left (16 margin + 68 label column). */
private val TagLabelWidth = 68.dp

@EchoScreenPreviews
@Composable
private fun MangaGalleryScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        MangaGalleryScreen(
            state = MangaGalleryUiState(
                gallery = Load.Content(
                    Gallery("g1", "Gallery title placeholder", "Artist Name", 52, "JP", tags = listOf("Full color", "Romance")),
                ),
                progress = ContinueItem(
                    section = Section.MANGA, id = "g1", title = "Gallery title", page = 34, pageCount = 52, updatedAt = 1, finished = false,
                ),
                moreBy = Load.Content(listOf(Gallery("g2", "Another gallery", "Artist Name", 30, "JP"))),
            ),
            contentPadding = PaddingValues(), onBack = {}, onOpenReader = {}, onOpenPages = {}, onBookmark = {}, onTag = {}, onGallery = {}, onRetry = {},
        )
    }
}
