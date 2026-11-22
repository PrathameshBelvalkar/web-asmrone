package app.echo.android.feature.manga.end

import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.material3.MaterialTheme
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
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.model.Gallery
import app.echo.data.repository.Load
import app.echo.data.repository.MangaRepository
import app.echo.data.repository.map
import app.echo.designsystem.component.echo.EndOfGallery
import app.echo.designsystem.component.echo.GalleryCard
import app.echo.designsystem.component.echo.ReaderTheme
import app.echo.designsystem.component.echo.ShelfHeader
import app.echo.designsystem.component.m3e.CoverRow
import app.echo.designsystem.component.m3e.EchoIconButton
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

data class MangaEndUiState(
    val gallery: Load<Gallery> = Load.Loading,
    val moreBy: Load<List<Gallery>> = Load.Loading,
)

class MangaEndViewModel(private val id: String, private val manga: MangaRepository) : ViewModel() {
    private val reloads = MutableStateFlow(0)
    private val gallery = reloads.flatMapLatest { manga.gallery(id) }

    private val moreBy = gallery.flatMapLatest { load ->
        val artist = (load as? Load.Content)?.value?.artist
        if (artist != null) {
            manga.byArtist(artist).map { it.map { list -> list.filter { g -> g.id != id }.take(8) } }
        } else {
            flowOf<Load<List<Gallery>>>(if (load is Load.Loading) Load.Loading else Load.Empty)
        }
    }

    val state: StateFlow<MangaEndUiState> = combine(gallery, moreBy) { g, more -> MangaEndUiState(g, more) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), MangaEndUiState())

    fun retry() { reloads.value += 1 }
}

@Composable
fun MangaEndRoute(id: String, shell: ShellActions) {
    val vm = echoViewModel(key = id) { MangaEndViewModel(id, it.manga) }
    val state by vm.state.collectAsStateWithLifecycle()
    MangaEndScreen(
        state = state,
        onBack = { shell.returnTo(Route.Gallery(id)) },
        onReadAgain = { shell.replace(Route.Reader(id, 1)) },
        onGallery = { shell.open(Route.Gallery(it)) },
        onArtist = { shell.open(Route.TagList("artist:$it")) },
        onRetry = vm::retry,
    )
}

/** Figma 2.10 End of gallery (28:3147): the gallery is finished; back to it, read again, or more by the artist. */
@Composable
fun MangaEndScreen(
    state: MangaEndUiState,
    onBack: () -> Unit,
    onReadAgain: () -> Unit,
    onGallery: (String) -> Unit,
    onArtist: (String) -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    ReaderTheme {
        Surface(
            modifier.fillMaxSize().testTag("screen:2.10"),
            color = MaterialTheme.colorScheme.background,
            contentColor = MaterialTheme.colorScheme.onBackground,
        ) {
            val gallery = state.gallery
            if (gallery is Load.Content) {
                LazyColumn(
                    modifier = Modifier.windowInsetsPadding(WindowInsets.safeDrawing),
                    contentPadding = PaddingValues(top = EchoSpacing.xxl, bottom = EchoSpacing.l),
                ) {
                    item {
                        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                            EchoIconButton(EchoIcons.ArrowBack, stringResource(R.string.state_back_cd), onBack)
                        }
                    }
                    item {
                        EndOfGallery(
                            title = stringResource(R.string.reader_end_title),
                            summary = stringResource(
                                R.string.reader_end_summary, gallery.value.title, gallery.value.pageCount,
                                (gallery.value.pageCount * SECONDS_PER_PAGE / 60).coerceAtLeast(1),
                            ),
                            cover = gallery.value.coverUrl,
                            backLabel = stringResource(R.string.reader_back_to_gallery),
                            readAgainLabel = stringResource(R.string.reader_read_again),
                            onBack = onBack,
                            onReadAgain = onReadAgain,
                        )
                    }
                    val more = state.moreBy
                    if (more is Load.Content && more.value.isNotEmpty()) {
                        item {
                            ShelfHeader(
                                stringResource(R.string.manga_more_by, gallery.value.artist.orEmpty()),
                                Modifier.padding(top = EchoSpacing.s),
                                onClick = { gallery.value.artist?.let(onArtist) },
                            )
                        }
                        item {
                            CoverRow(more.value.size) { i ->
                                val item = more.value[i]
                                // Figma 2.10: three 112 dp covers fit across, title only, no badges.
                                GalleryCard(title = item.title, artist = null, image = item.coverUrl, onClick = { onGallery(item.id) }, width = 112.dp)
                            }
                        }
                    }
                }
            } else {
                LoadFallback(gallery, onRetry)
            }
        }
    }
}

/** Reading time estimate for the summary ("· 18 min" for 52 pages). */
private const val SECONDS_PER_PAGE = 21

@EchoScreenPreviews
@Composable
private fun MangaEndScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        MangaEndScreen(
            state = MangaEndUiState(
                gallery = Load.Content(Gallery("g1", "Gallery title placeholder", "Artist Name", 52, "JP")),
                moreBy = Load.Content(listOf(Gallery("g2", "Another gallery", "Artist Name", 30, "JP"))),
            ),
            onBack = {}, onReadAgain = {}, onGallery = {}, onArtist = {}, onRetry = {},
        )
    }
}
