package app.echo.android.feature.jav.movie

import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material3.minimumInteractiveComponentSize
import app.echo.designsystem.component.echo.sharedCover
import app.echo.designsystem.component.echo.CoverKeys
import androidx.compose.runtime.mutableIntStateOf
import android.content.ClipData
import android.content.Intent
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.feature.jav.cardMeta
import app.echo.android.feature.jav.clock
import app.echo.android.feature.manga.LoadFallback
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.fake.FakeCatalog
import app.echo.data.model.Idol
import app.echo.data.model.Movie
import app.echo.data.model.Section
import app.echo.data.model.Tag
import app.echo.data.repository.JavRepository
import app.echo.data.repository.LibraryRepository
import app.echo.data.repository.Load
import app.echo.designsystem.component.echo.CoverImage
import app.echo.designsystem.component.echo.IdolCard
import app.echo.designsystem.component.echo.MovieCard
import app.echo.designsystem.component.echo.ShelfHeader
import app.echo.designsystem.component.m3e.ButtonStyle
import app.echo.designsystem.component.m3e.CarouselStyle
import app.echo.designsystem.component.m3e.ChipRow
import app.echo.designsystem.component.m3e.ChipSpec
import app.echo.designsystem.component.m3e.ChipStyle
import app.echo.designsystem.component.m3e.ComponentSize
import app.echo.designsystem.component.m3e.CoverCarousel
import app.echo.designsystem.component.m3e.CoverRow
import app.echo.designsystem.component.m3e.EchoButton
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.component.m3e.EchoSmallAppBar
import app.echo.designsystem.component.m3e.EchoSplitButton
import app.echo.designsystem.component.m3e.IconButtonStyle
import app.echo.designsystem.component.m3e.SplitMenuItem
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviewTheme
import app.echo.designsystem.preview.EchoPreviewThemes
import app.echo.designsystem.preview.EchoScreenPreviews
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.tokens.EchoSpacing
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** 3.6: the movie, its cast and genres resolved to ids, where it was left, and more like it. */
data class JavMovieUiState(
    val movie: Load<Movie> = Load.Loading,
    val cast: List<Idol> = emptyList(),
    val genres: List<Tag> = emptyList(),
    /** Null: not started (or finished), so the button says Watch. */
    val resumeMs: Long? = null,
    val more: List<Movie> = emptyList(),
)

class JavMovieViewModel(id: String, jav: JavRepository, library: LibraryRepository) : ViewModel() {
    val state: StateFlow<JavMovieUiState> = combine(
        jav.movie(id), jav.idols(), jav.genres(), library.history(Section.JAV), jav.latest(),
    ) { movie, idols, genres, history, latest ->
        val m = (movie as? Load.Content)?.value
        JavMovieUiState(
            movie = movie,
            cast = m?.let { mv -> (idols as? Load.Content)?.value.orEmpty().filter { it.name in mv.idols } }.orEmpty(),
            genres = m?.let { mv -> (genres as? Load.Content)?.value.orEmpty().filter { it.name in mv.genres } }.orEmpty(),
            resumeMs = history.firstOrNull { it.id == id && !it.finished }?.positionMs,
            more = (latest as? Load.Content)?.value.orEmpty().filter { it.id != id && !it.upcoming }.take(MORE_COUNT),
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), JavMovieUiState())

    private companion object {
        const val MORE_COUNT = 8
    }
}

private const val SITE = "https://www.javdatabase.com/movies/"

@Composable
fun JavMovieRoute(id: String, shell: ShellActions, contentPadding: PaddingValues) {
    // Try again builds a fresh ViewModel, which loads again.
    var attempt by rememberSaveable { mutableIntStateOf(0) }
    val vm = echoViewModel(key = "movie-$id-$attempt") { JavMovieViewModel(id, it.jav, it.library) }
    val state by vm.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val uri = LocalUriHandler.current
    val clipboard = LocalClipboard.current
    val scope = rememberCoroutineScope()
    JavMovieScreen(
        onRetry = { attempt++ },
        state = state,
        contentPadding = contentPadding,
        onBack = shell::back,
        onShare = { m ->
            val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, "${m.code} · ${m.title}\n$SITE${m.code.lowercase()}/")
            context.startActivity(Intent.createChooser(send, null))
        },
        onWatch = { fromStart -> shell.open(Route.JavTheater(id, fromStart)) },
        onCopyCode = { code -> scope.launch { clipboard.setClipEntry(ClipEntry(ClipData.newPlainText(code, code))) } },
        onStudio = { shell.open(Route.MovieList("studio:$it")) },
        onDirector = { shell.open(Route.MovieList("director:$it")) },
        onOpenSite = { m -> uri.openUri("$SITE${m.code.lowercase()}/") },
        onIdol = { shell.open(Route.Idol(it)) },
        onCast = { shell.open(Route.Idols()) },
        onGenre = { shell.open(Route.MovieList(it)) },
        onMovie = { shell.open(Route.Movie(it)) },
    )
}

/** Figma 3.6 Movie page (28:3867). */
@Composable
fun JavMovieScreen(
    state: JavMovieUiState,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onShare: (Movie) -> Unit,
    onWatch: (fromStart: Boolean) -> Unit,
    onCopyCode: (String) -> Unit,
    onStudio: (String) -> Unit,
    onDirector: (String) -> Unit,
    onOpenSite: (Movie) -> Unit,
    onIdol: (String) -> Unit,
    onCast: () -> Unit,
    onGenre: (String) -> Unit,
    onMovie: (String) -> Unit,
    onRetry: () -> Unit = {},
) {
    val movie = (state.movie as? Load.Content)?.value
    var menu by rememberSaveable { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().testTag("screen:3.6")) {
        EchoSmallAppBar(
            title = "",
            onBack = onBack,
            actions = {
                if (movie != null) {
                    EchoIconButton(EchoIcons.Share, stringResource(R.string.jav_share), { onShare(movie) })
                    Box {
                        EchoIconButton(EchoIcons.MoreVert, stringResource(app.echo.designsystem.R.string.echo_cd_more), { menu = true })
                        DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                            DropdownMenuItem(text = { Text(stringResource(R.string.jav_open_site)) }, onClick = { menu = false; onOpenSite(movie) })
                            DropdownMenuItem(text = { Text(stringResource(R.string.jav_start_over)) }, onClick = { menu = false; onWatch(true) })
                        }
                    }
                }
            },
        )
        if (movie == null) {
            LoadFallback(state.movie, onRetry = onRetry)
            return@Column
        }
        LazyColumn(
            Modifier.weight(1f),
            contentPadding = PaddingValues(bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l),
            verticalArrangement = Arrangement.spacedBy(EchoSpacing.m),
        ) {
            item { Covers(movie) { onWatch(false) } }
            item {
                Text(
                    movie.title, style = MaterialTheme.typography.titleLargeEmphasized,
                    modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin),
                )
            }
            item {
                ChipRow(
                    chips = listOf(ChipSpec(movie.code, EchoIcons.ContentCopy), ChipSpec(movie.studio, EchoIcons.OpenInNew)),
                    onClick = { if (it == 0) onCopyCode(movie.code) else onStudio(movie.studio) },
                    style = ChipStyle.Assist,
                )
            }
            item { Actions(state.resumeMs, onWatch) }
            item { Details(movie, onStudio, onDirector) { onOpenSite(movie) } }
            if (state.cast.isNotEmpty()) {
                item { ShelfHeader(stringResource(R.string.jav_cast), onClick = onCast) }
                item {
                    CoverRow(state.cast.size) { i ->
                        val idol = state.cast[i]
                        IdolCard(idol.name, null, idol.imageUrl, { onIdol(idol.id) }, width = 80.dp)
                    }
                }
            }
            if (state.genres.isNotEmpty()) {
                item { ShelfHeader(stringResource(R.string.jav_genres)) }
                item {
                    ChipRow(state.genres.map { ChipSpec(it.name) }, onClick = { onGenre(state.genres[it].id) }, style = ChipStyle.Assist)
                }
            }
            if (movie.sampleImages.isNotEmpty()) {
                item { ShelfHeader(stringResource(R.string.jav_samples)) }
                item {
                    CoverCarousel(movie.sampleImages.size, height = 150.dp) { i ->
                        Box(Modifier.fillMaxSize().maskClip(MaterialTheme.shapes.extraLarge)) {
                            CoverImage(movie.sampleImages[i], null, Modifier.fillMaxSize(), shape = null)
                        }
                    }
                }
            }
            if (state.more.isNotEmpty()) {
                item { ShelfHeader(stringResource(R.string.jav_more_like)) }
                item {
                    CoverRow(state.more.size) { i ->
                        val m = state.more[i]
                        MovieCard(m.code, m.title, m.cardMeta(), m.coverUrl, { onMovie(m.id) }, width = 160.dp, sharedKey = CoverKeys.movie(m.id))
                    }
                }
            }
        }
    }
}

/** The hero carousel: the cover (with a play button) first, then the sample images. */
@Composable
private fun Covers(movie: Movie, onPlay: () -> Unit) {
    val count = 1 + movie.sampleImages.size
    CoverCarousel(count, style = CarouselStyle.Hero, height = 214.dp) { i ->
        Box(
            // The cover is the one a movie card opened this page from.
            (if (i == 0) sharedCover(CoverKeys.movie(movie.id)) else Modifier).fillMaxSize().maskClip(MaterialTheme.shapes.extraLarge)
                .border(1.dp, MaterialTheme.colorScheme.outlineVariant, MaterialTheme.shapes.extraLarge),
            contentAlignment = Alignment.Center,
        ) {
            val image = if (i == 0) movie.coverUrl else movie.sampleImages[i - 1]
            CoverImage(image, if (i == 0) movie.title else null, Modifier.fillMaxSize(), shape = null, onClick = if (i == 0) onPlay else null)
            if (i == 0) {
                EchoIconButton(
                    EchoIcons.PlayArrowFilled, stringResource(R.string.jav_play), onPlay,
                    style = IconButtonStyle.Filled, size = ComponentSize.M,
                )
            }
        }
    }
}

/** "▶ Resume 42:07 ▾" (or Watch) with Start over and Quality in its menu, then Trailer. */
@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
private fun Actions(resumeMs: Long?, onWatch: (Boolean) -> Unit) {
    // Wraps at large font sizes instead of squeezing Trailer (accessibility pass).
    FlowRow(
        Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin),
        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s),
        verticalArrangement = Arrangement.spacedBy(EchoSpacing.s),
        itemVerticalAlignment = Alignment.CenterVertically,
    ) {
        EchoSplitButton(
            text = if (resumeMs != null) stringResource(R.string.jav_resume, clock(resumeMs)) else stringResource(R.string.jav_watch),
            onClick = { onWatch(false) },
            menu = listOf(
                SplitMenuItem(stringResource(R.string.jav_start_over)) { onWatch(true) },
                SplitMenuItem(stringResource(R.string.jav_quality)) { onWatch(false) },
            ),
            icon = EchoIcons.PlayArrowFilled,
        )
        EchoButton(
            stringResource(R.string.jav_trailer), { onWatch(true) },
            style = ButtonStyle.Tonal, size = ComponentSize.M, icon = EchoIcons.MovieFilled,
        )
    }
}

/** The details card: Released, Runtime, Studio, Director, then Open on javdatabase. */
@Composable
private fun Details(movie: Movie, onStudio: (String) -> Unit, onDirector: (String) -> Unit, onOpenSite: () -> Unit) {
    Card(
        Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin),
        shape = MaterialTheme.shapes.extraLarge,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer),
    ) {
        Column(Modifier.padding(EchoSpacing.l), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            DetailRow(stringResource(R.string.jav_released_label), movie.releaseDate)
            DetailRow(stringResource(R.string.jav_runtime), stringResource(R.string.jav_runtime_value, movie.durationMin))
            DetailRow(stringResource(R.string.jav_studio), movie.studio) { onStudio(movie.studio) }
            DetailRow(stringResource(R.string.jav_director), movie.director) { onDirector(movie.director) }
            EchoButton(stringResource(R.string.jav_open_site), onOpenSite, style = ButtonStyle.Text, icon = EchoIcons.OpenInNew)
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String, onClick: (() -> Unit)? = null) {
    Row(horizontalArrangement = Arrangement.spacedBy(EchoSpacing.m), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.width(84.dp))
        Text(
            value,
            style = MaterialTheme.typography.labelLarge,
            color = if (onClick != null) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
            modifier = if (onClick != null) Modifier.clickable(onClick = onClick).minimumInteractiveComponentSize() else Modifier,
        )
    }
}

@EchoScreenPreviews
@Composable
private fun JavMovieScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        val movie = FakeCatalog.movies.first()
        JavMovieScreen(
            state = JavMovieUiState(
                movie = Load.Content(movie), cast = FakeCatalog.idols.take(4),
                genres = FakeCatalog.genres.take(3), resumeMs = 42 * 60_000L + 7_000L, more = FakeCatalog.movies.drop(1).take(4),
            ),
            contentPadding = PaddingValues(), onBack = {}, onShare = {}, onWatch = {}, onCopyCode = {}, onStudio = {},
            onDirector = {}, onOpenSite = {}, onIdol = {}, onCast = {}, onGenre = {}, onMovie = {},
        )
    }
}
