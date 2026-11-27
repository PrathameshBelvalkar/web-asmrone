package app.echo.android.feature.hentai.home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.feature.hentai.HentaiHeader
import app.echo.android.feature.hentai.HentaiTab
import app.echo.android.feature.hentai.TitleCard
import app.echo.android.feature.hentai.titleCount
import app.echo.android.feature.hentai.titles.TitleSort
import app.echo.android.feature.manga.LoadFallback
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.fake.FakeCatalog
import app.echo.data.model.HentaiTitle
import app.echo.data.model.Shelf
import app.echo.data.model.Source
import app.echo.data.repository.HentaiRepository
import app.echo.data.repository.Load
import app.echo.designsystem.component.echo.CoverImage
import app.echo.designsystem.component.echo.ShelfHeader
import app.echo.designsystem.component.echo.StatusLine
import app.echo.designsystem.component.m3e.BadgeStyle
import app.echo.designsystem.component.m3e.CarouselStyle
import app.echo.designsystem.component.m3e.CoverBadge
import app.echo.designsystem.component.m3e.CoverCarousel
import app.echo.designsystem.component.m3e.CoverRow
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviewTheme
import app.echo.designsystem.preview.EchoPreviewThemes
import app.echo.designsystem.preview.EchoScreenPreviews
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.tokens.EchoSpacing
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** H.1: the shelves, the catalogue size, when it was last refreshed, and the live-update count. */
data class HentaiHomeUiState(
    val shelves: Load<List<Shelf<HentaiTitle>>> = Load.Loading,
    val total: Int = 0,
    val updatedAt: Long = 0,
    /** Titles the source added since the screen opened (the snackbar); 0 = none. */
    val newTitles: Int = 0,
)

class HentaiHomeViewModel(hentai: HentaiRepository) : ViewModel() {
    private val reloads = MutableStateFlow(0)
    private val newTitles = MutableStateFlow(0)

    val state: StateFlow<HentaiHomeUiState> = combine(
        reloads.flatMapLatest { hentai.home().map { it to System.currentTimeMillis() } },
        hentai.catalog(),
        newTitles,
    ) { (shelves, at), catalog, fresh ->
        HentaiHomeUiState(shelves, (catalog as? Load.Content)?.value?.size ?: 0, at, fresh)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), HentaiHomeUiState())

    init {
        // Design phase: the source's live updates (SSE) arrive a few seconds in.
        viewModelScope.launch {
            delay(LIVE_UPDATE_DELAY_MS)
            newTitles.value = LIVE_UPDATE_COUNT
        }
    }

    fun refresh() { reloads.value += 1 }
    fun dismissUpdate() { newTitles.value = 0 }

    private companion object {
        const val LIVE_UPDATE_DELAY_MS = 4_000L
        const val LIVE_UPDATE_COUNT = 3
    }
}

@Composable
fun HentaiHomeRoute(shell: ShellActions, source: Source, contentPadding: PaddingValues) {
    val vm = echoViewModel { HentaiHomeViewModel(it.hentai) }
    val state by vm.state.collectAsStateWithLifecycle()
    HentaiHomeScreen(
        state = state,
        header = { HentaiHeader(HentaiTab.HOME, shell, source) },
        contentPadding = contentPadding,
        onRefresh = vm::refresh,
        onTitle = { shell.open(Route.HentaiTitle(it)) },
        onShelf = { sort -> shell.open(Route.HentaiTitles(sort = sort.name)) },
        onShowNew = { vm.dismissUpdate(); shell.open(Route.HentaiTitles(sort = TitleSort.NEWEST.name)) },
        onDismissNew = vm::dismissUpdate,
    )
}

/** Which H.3 sort a home shelf's arrow opens, by its position (New uploads, Trending this week, Most viewed). */
private val ShelfSorts = listOf(TitleSort.NEWEST, TitleSort.TRENDING, TitleSort.VIEWS)

/** Figma H.1 Home (28:4682): the catalogue status, the poster carousel, the shelves, and the live-update snackbar. */
@Composable
fun HentaiHomeScreen(
    state: HentaiHomeUiState,
    header: @Composable () -> Unit,
    contentPadding: PaddingValues,
    onRefresh: () -> Unit,
    onTitle: (String) -> Unit,
    onShelf: (TitleSort) -> Unit,
    onShowNew: () -> Unit,
    onDismissNew: () -> Unit,
) {
    val snackbar = remember { SnackbarHostState() }
    val message = if (state.newTitles > 0) stringResource(R.string.hentai_new_titles, state.newTitles) else null
    val action = stringResource(R.string.hentai_show)
    LaunchedEffect(message) {
        if (message != null) {
            when (snackbar.showSnackbar(message, actionLabel = action, duration = SnackbarDuration.Long)) {
                SnackbarResult.ActionPerformed -> onShowNew()
                SnackbarResult.Dismissed -> onDismissNew()
            }
        }
    }
    Box(Modifier.fillMaxSize().testTag("screen:H.1")) {
        Column(Modifier.fillMaxSize()) {
            header()
            val shelves = state.shelves
            if (shelves !is Load.Content) {
                LoadFallback(shelves, onRefresh)
                return@Column
            }
            LazyColumn(
                Modifier.weight(1f),
                contentPadding = PaddingValues(top = EchoSpacing.xs, bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l),
                verticalArrangement = Arrangement.spacedBy(EchoSpacing.s),
            ) {
                item("status") {
                    StatusLine(
                        stringResource(R.string.hentai_status, updatedText(state.updatedAt), titleCount(state.total)),
                        onRefresh = onRefresh,
                        refreshLabel = stringResource(R.string.hentai_refresh),
                    )
                }
                item("posters") { Posters(shelves.value.firstOrNull()?.items.orEmpty().take(POSTERS), onTitle) }
                items(shelves.value.size, key = { "shelf-$it" }) { i ->
                    val shelf = shelves.value[i]
                    Column {
                        ShelfHeader(shelf.title, onClick = { onShelf(ShelfSorts.getOrElse(i) { TitleSort.NEWEST }) })
                        CoverRow(shelf.items.size) { j -> TitleCard(shelf.items[j], { onTitle(shelf.items[j].id) }) }
                    }
                }
            }
        }
        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).padding(bottom = contentPadding.calculateBottomPadding() + EchoSpacing.s))
    }
}

private const val POSTERS = 5
private val CAPTION_FROM = 200.dp
private val CAPTION_FADE = 60.dp

/** "12 min ago" / "just now". */
@Composable
private fun updatedText(at: Long): String {
    val minutes = ((System.currentTimeMillis() - at) / 60_000).toInt()
    return if (at == 0L || minutes < 1) stringResource(R.string.hentai_updated_now) else stringResource(R.string.hentai_updated_min, minutes)
}

/** The hero carousel of landscape posters (320 × 180): NEW and "Title · Episode 1" over a scrim. */
@Composable
private fun Posters(titles: List<HentaiTitle>, onTitle: (String) -> Unit) {
    if (titles.isEmpty()) return
    CoverCarousel(titles.size, style = CarouselStyle.Hero, height = 180.dp) { i ->
        val t = titles[i]
        Box(
            Modifier.fillMaxSize().maskClip(MaterialTheme.shapes.extraLarge)
                .border(1.dp, MaterialTheme.colorScheme.outlineVariant, MaterialTheme.shapes.extraLarge),
        ) {
            CoverImage(t.posterUrl ?: t.coverUrl, t.title, Modifier.fillMaxSize(), shape = null, onClick = { onTitle(t.id) })
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.45f to Color.Transparent, 1f to Color.Black.copy(alpha = 0.7f))))
            // Only the large item shows its caption: it follows the visible mask and fades out on the peeking ones.
            val info = carouselItemDrawInfo
            Column(
                Modifier.align(Alignment.BottomStart)
                    .graphicsLayer {
                        translationX = info.maskRect.left
                        alpha = ((info.maskRect.width - CAPTION_FROM.toPx()) / CAPTION_FADE.toPx()).coerceIn(0f, 1f)
                    }
                    .padding(EchoSpacing.l),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                if (t.isNew) CoverBadge(stringResource(R.string.hentai_new).uppercase(), style = BadgeStyle.Overlay)
                Text(
                    stringResource(R.string.hentai_poster_caption, t.title, t.episodes.firstOrNull()?.number ?: 1),
                    style = MaterialTheme.typography.titleMediumEmphasized, color = Color.White,
                    maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@EchoScreenPreviews
@Composable
private fun HentaiHomeScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        val t = FakeCatalog.hentaiTitles
        HentaiHomeScreen(
            state = HentaiHomeUiState(
                shelves = Load.Content(listOf(Shelf("New uploads", t.take(6)), Shelf("Trending this week", t.drop(6).take(6)))),
                total = t.size, updatedAt = 0,
            ),
            header = { HentaiHeader(HentaiTab.HOME, "Hentai", EchoIcons.PlayArrow, "P", {}, {}, {}, {}) },
            contentPadding = PaddingValues(), onRefresh = {}, onTitle = {}, onShelf = {}, onShowNew = {}, onDismissNew = {},
        )
    }
}
