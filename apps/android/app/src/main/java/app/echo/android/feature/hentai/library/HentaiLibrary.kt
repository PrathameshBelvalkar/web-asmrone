package app.echo.android.feature.hentai.library

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.feature.jav.clock
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.model.ContinueItem
import app.echo.data.model.Section
import app.echo.data.repository.LibraryRepository
import app.echo.designsystem.component.echo.CoverImage
import app.echo.designsystem.component.echo.EmptyState
import app.echo.designsystem.component.echo.ProfileAvatar
import app.echo.designsystem.component.m3e.ConnectedButtonGroup
import app.echo.designsystem.component.m3e.ConnectedOption
import app.echo.designsystem.component.m3e.EchoFlexibleAppBar
import app.echo.designsystem.component.m3e.EchoIconButton
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
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** H.9: Continue watching (unfinished) or Watched, from `history_watch` where kind = HENTAI. */
data class HentaiLibraryUiState(val watched: Boolean = false, val items: List<ContinueItem> = emptyList(), val loaded: Boolean = false)

class HentaiLibraryViewModel(private val library: LibraryRepository) : ViewModel() {
    private val watched = MutableStateFlow(false)

    val state: StateFlow<HentaiLibraryUiState> = combine(library.history(Section.HENTAI), watched) { items, w ->
        HentaiLibraryUiState(w, items.filter { it.finished == w }, loaded = true)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), HentaiLibraryUiState())

    fun setWatched(value: Boolean) { watched.value = value }
    fun remove(id: String) = viewModelScope.launch { library.removeHistory(Section.HENTAI, id) }
}

@Composable
fun HentaiLibraryRoute(shell: ShellActions, contentPadding: PaddingValues) {
    val vm = echoViewModel { HentaiLibraryViewModel(it.library) }
    val state by vm.state.collectAsStateWithLifecycle()
    HentaiLibraryScreen(
        state = state,
        profileInitial = shell.profileInitial,
        contentPadding = contentPadding,
        onBack = shell::back,
        onProfile = shell::openProfile,
        onWatched = vm::setWatched,
        onOpen = { shell.open(Route.HentaiTitle(it)) },
        onResume = { id, episode -> shell.open(Route.HentaiTheater(id, episode)) },
        onRemove = vm::remove,
    )
}

/** Figma H.9 Hentai library (28:6000). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HentaiLibraryScreen(
    state: HentaiLibraryUiState,
    profileInitial: String,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onProfile: () -> Unit,
    onWatched: (Boolean) -> Unit,
    onOpen: (String) -> Unit,
    onResume: (id: String, episode: Int) -> Unit,
    onRemove: (String) -> Unit,
) {
    val scroll = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    Column(Modifier.fillMaxSize().nestedScroll(scroll.nestedScrollConnection).testTag("screen:H.9")) {
        EchoFlexibleAppBar(
            title = stringResource(R.string.hentai_library_title),
            subtitle = stringResource(R.string.hentai_library_subtitle),
            onBack = onBack,
            scrollBehavior = scroll,
            actions = { ProfileAvatar(profileInitial, onProfile) },
        )
        ConnectedButtonGroup(
            options = listOf(ConnectedOption(stringResource(R.string.jav_continue_watching)), ConnectedOption(stringResource(R.string.jav_watched))),
            selected = if (state.watched) 1 else 0,
            onSelect = { onWatched(it == 1) },
            modifier = Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.s),
        )
        LazyColumn(
            Modifier.weight(1f),
            contentPadding = PaddingValues(top = EchoSpacing.s, bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l),
        ) {
            if (state.loaded && state.items.isEmpty()) {
                item {
                    EmptyState(
                        EchoIcons.PlayArrow, stringResource(R.string.state_empty_title), stringResource(R.string.hentai_library_empty),
                        Modifier.padding(top = EchoSpacing.xxl),
                    )
                }
            } else {
                item {
                    SegmentedList {
                        state.items.forEach { entry -> item { LibraryRow(entry, state.watched, onOpen, onResume, onRemove) } }
                    }
                }
            }
        }
    }
}

/** A row: thumbnail with progress, "EPISODE 2", the title, "13:01 left · Studio Name", and a menu. */
@Composable
private fun LibraryRow(
    entry: ContinueItem,
    watched: Boolean,
    onOpen: (String) -> Unit,
    onResume: (String, Int) -> Unit,
    onRemove: (String) -> Unit,
) {
    var menu by rememberSaveable(entry.id) { mutableStateOf(false) }
    val episode = entry.episode ?: 1
    val studio = entry.subtitle.orEmpty()
    SegmentedListItem(
        headline = entry.title,
        overline = stringResource(R.string.hentai_episode_overline, episode).uppercase(),
        supporting = if (watched) stringResource(R.string.hentai_watched_meta, studio)
        else stringResource(R.string.hentai_left_meta, clock((entry.durationMs - entry.positionMs).coerceAtLeast(0)), studio),
        onClick = { if (watched) onOpen(entry.id) else onResume(entry.id, episode) },
        leading = {
            val shape = RoundedCornerShape(10.dp)
            Box(Modifier.size(96.dp, 54.dp).clip(shape).border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape)) {
                CoverImage(entry.coverUrl, null, Modifier.fillMaxSize(), shape = null)
                Box(
                    Modifier.align(Alignment.BottomStart).fillMaxWidth(if (watched) 1f else entry.progress).height(3.dp)
                        .background(MaterialTheme.colorScheme.primary),
                )
            }
        },
        trailing = {
            Box {
                EchoIconButton(EchoIcons.MoreVert, stringResource(app.echo.designsystem.R.string.echo_cd_more), { menu = true })
                DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.hentai_watch)) },
                        onClick = { menu = false; onResume(entry.id, episode) },
                        leadingIcon = { Icon(painterResource(EchoIcons.PlayArrowFilled), null) },
                    )
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.hentai_open_title)) },
                        onClick = { menu = false; onOpen(entry.id) },
                        leadingIcon = { Icon(painterResource(EchoIcons.Info), null) },
                    )
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.jav_remove)) },
                        onClick = { menu = false; onRemove(entry.id) },
                        leadingIcon = { Icon(painterResource(EchoIcons.DeleteFilled), null) },
                    )
                }
            }
        },
    )
}

@EchoScreenPreviews
@Composable
private fun HentaiLibraryScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        val items = (1..5).map { i ->
            ContinueItem(
                Section.HENTAI, "h$i", "Title placeholder $i", positionMs = (10 + 3 * i) * 60_000L,
                durationMs = 23 * 60_000L + 14_000, subtitle = "Studio Name", updatedAt = 0, finished = false, episode = 1 + i % 3,
            )
        }
        HentaiLibraryScreen(
            state = HentaiLibraryUiState(items = items, loaded = true), profileInitial = "P", contentPadding = PaddingValues(),
            onBack = {}, onProfile = {}, onWatched = {}, onOpen = {}, onResume = { _, _ -> }, onRemove = {},
        )
    }
}
