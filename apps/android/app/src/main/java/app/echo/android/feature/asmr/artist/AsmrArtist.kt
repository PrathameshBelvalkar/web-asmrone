package app.echo.android.feature.asmr.artist

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.LoadContent
import app.echo.android.ui.echoViewModel
import app.echo.data.fake.FakeCatalog
import app.echo.data.model.ArtistKind
import app.echo.data.model.ArtistPage
import app.echo.data.model.Work
import app.echo.data.repository.AsmrRepository
import app.echo.data.repository.Load
import app.echo.designsystem.component.echo.CoverCard
import app.echo.designsystem.component.echo.CoverImage
import app.echo.designsystem.component.echo.IdolCard
import app.echo.designsystem.component.echo.ShelfHeader
import app.echo.designsystem.component.m3e.ButtonStyle
import app.echo.designsystem.component.m3e.CoverRow
import app.echo.designsystem.component.m3e.EchoButton
import app.echo.designsystem.component.m3e.EchoButtonGroup
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.component.m3e.EchoSmallAppBar
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviewTheme
import app.echo.designsystem.preview.EchoPreviewThemes
import app.echo.designsystem.preview.EchoScreenPreviews
import app.echo.designsystem.theme.EchoShapes
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.tokens.EchoSizes
import app.echo.designsystem.tokens.EchoSpacing
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn

@OptIn(ExperimentalCoroutinesApi::class)
class AsmrArtistViewModel(private val id: String, asmr: AsmrRepository) : ViewModel() {
    private val reload = MutableStateFlow(0)
    val state: StateFlow<Load<ArtistPage>> = reload.flatMapLatest { asmr.artist(id) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), Load.Loading)
    fun retry() { reload.value++ }
}

@Composable
fun AsmrArtistRoute(id: String, shell: ShellActions, contentPadding: PaddingValues) {
    val vm = echoViewModel(key = "artist:$id") { AsmrArtistViewModel(id, it.asmr) }
    val state by vm.state.collectAsStateWithLifecycle()
    // Following isn't stored yet (no account, no table): it is kept for this screen only.
    var following by rememberSaveable(id) { mutableStateOf(false) }
    AsmrArtistScreen(
        state = state, following = following, contentPadding = contentPadding,
        onBack = shell::back, onSearch = { shell.open(Route.AsmrSearch) },
        onPlay = { shuffle ->
            (state as? Load.Content)?.value?.let { page ->
                val tracks = page.popular.flatMap { it.tracks }.let { if (shuffle) it.shuffled() else it }
                shell.play(tracks, 0, page.artist.name)
            }
        },
        onFollow = { following = !following },
        onWork = { shell.open(Route.Work(it)) },
        onArtist = { shell.open(Route.Artist(it)) },
        onRetry = vm::retry,
    )
}

/** Figma 1.6 Artist (35:666). */
@Composable
fun AsmrArtistScreen(
    state: Load<ArtistPage>,
    following: Boolean,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onSearch: () -> Unit,
    onPlay: (shuffle: Boolean) -> Unit,
    onFollow: () -> Unit,
    onWork: (String) -> Unit,
    onArtist: (String) -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier.fillMaxSize().testTag("screen:1.6")) {
        EchoSmallAppBar(title = "", onBack = onBack) {
            EchoIconButton(EchoIcons.Search, stringResource(R.string.nav_search), onSearch)
            EchoIconButton(EchoIcons.MoreVert, stringResource(app.echo.designsystem.R.string.echo_cd_more), {})
        }
        LoadContent(state, onRetry, contentPadding = contentPadding) { page ->
            LazyColumn(contentPadding = PaddingValues(bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l)) {
                item { ArtistHeader(page) }
                item {
                    EchoButtonGroup(Modifier.padding(vertical = EchoSpacing.s)) {
                        EchoButton(stringResource(R.string.work_play), { onPlay(false) }, icon = EchoIcons.PlayArrowFilled)
                        EchoButton(stringResource(R.string.work_shuffle), { onPlay(true) }, style = ButtonStyle.Tonal, icon = EchoIcons.Shuffle)
                        EchoButton(
                            stringResource(if (following) R.string.artist_following else R.string.artist_follow), onFollow,
                            style = if (following) ButtonStyle.Tonal else ButtonStyle.Outlined,
                            icon = if (following) EchoIcons.Check else EchoIcons.Add,
                        )
                    }
                }
                shelf(R.string.artist_popular, page.popular, onWork)
                shelf(R.string.artist_latest, page.latest, onWork)
                if (page.appearsWith.isNotEmpty()) {
                    item { ShelfHeader(stringResource(R.string.artist_appears_with), onClick = {}) }
                    item {
                        CoverRow(page.appearsWith.size) { i ->
                            page.appearsWith[i].let { IdolCard(it.name, null, it.imageUrl, { onArtist(it.id) }, width = 88.dp) }
                        }
                    }
                }
            }
        }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.shelf(title: Int, works: List<Work>, onWork: (String) -> Unit) {
    if (works.isEmpty()) return
    item { ShelfHeader(stringResource(title), onClick = {}) }
    item { CoverRow(works.size) { i -> works[i].let { CoverCard(it.title, it.circle, it.coverUrl, { onWork(it.id) }) } } }
}

/** Large header: 96 dp avatar, name (headlineLarge), role and work count (Figma "App bar (Large flexible)"). */
@Composable
private fun ArtistHeader(page: ArtistPage) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.s),
        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.l),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CoverImage(page.artist.imageUrl, page.artist.name, Modifier.size(EchoSizes.avatarArtist), shape = EchoShapes.Full)
        Column {
            Text(page.artist.name, style = MaterialTheme.typography.headlineLarge, modifier = Modifier.semantics { heading() })
            Text(
                stringResource(
                    if (page.artist.kind == ArtistKind.CIRCLE) R.string.artist_circle else R.string.artist_voice_actor,
                    page.artist.workCount,
                ),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@EchoScreenPreviews
@Composable
private fun AsmrArtistScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        val c = FakeCatalog
        AsmrArtistScreen(
            Load.Content(ArtistPage(c.artists[2], c.works.take(4), c.works.drop(3), c.artists.take(4))),
            following = false, contentPadding = PaddingValues(), {}, {}, {}, {}, {}, {}, {},
        )
    }
}
