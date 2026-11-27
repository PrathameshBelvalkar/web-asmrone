package app.echo.android.feature.jav.library

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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import app.echo.designsystem.component.m3e.ButtonStyle
import app.echo.designsystem.component.m3e.ConnectedButtonGroup
import app.echo.designsystem.component.m3e.ConnectedOption
import app.echo.designsystem.component.m3e.EchoButton
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

/** 3.12: Continue watching (unfinished) or Watched (finished), from `history_watch` where kind = JAV. */
data class JavLibraryUiState(val watched: Boolean = false, val items: List<ContinueItem> = emptyList(), val loaded: Boolean = false)

class JavLibraryViewModel(private val library: LibraryRepository) : ViewModel() {
    private val watched = MutableStateFlow(false)

    val state: StateFlow<JavLibraryUiState> = combine(library.history(Section.JAV), watched) { items, w ->
        JavLibraryUiState(w, items.filter { it.finished == w }, loaded = true)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), JavLibraryUiState())

    fun setWatched(value: Boolean) { watched.value = value }
    fun remove(id: String) = viewModelScope.launch { library.removeHistory(Section.JAV, id) }
    fun clear() = viewModelScope.launch { library.clearHistory(Section.JAV) }
}

@Composable
fun JavLibraryRoute(shell: ShellActions, contentPadding: PaddingValues) {
    val vm = echoViewModel { JavLibraryViewModel(it.library) }
    val state by vm.state.collectAsStateWithLifecycle()
    JavLibraryScreen(
        state = state,
        contentPadding = contentPadding,
        onBack = shell::back,
        onWatched = vm::setWatched,
        onOpen = { shell.open(Route.Movie(it)) },
        onResume = { shell.open(Route.JavTheater(it)) },
        onStartOver = { shell.open(Route.JavTheater(it, fromStart = true)) },
        onRemove = vm::remove,
        onClear = vm::clear,
    )
}

/** Figma 3.12 JAV library (28:4561). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JavLibraryScreen(
    state: JavLibraryUiState,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onWatched: (Boolean) -> Unit,
    onOpen: (String) -> Unit,
    onResume: (String) -> Unit,
    onStartOver: (String) -> Unit,
    onRemove: (String) -> Unit,
    onClear: () -> Unit,
) {
    val scroll = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    var confirming by rememberSaveable { mutableStateOf(false) }
    var topMenu by rememberSaveable { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().nestedScroll(scroll.nestedScrollConnection).testTag("screen:3.12")) {
        EchoFlexibleAppBar(
            title = stringResource(R.string.jav_library_title),
            subtitle = stringResource(R.string.jav_library_subtitle),
            onBack = onBack,
            scrollBehavior = scroll,
            actions = {
                Box {
                    EchoIconButton(EchoIcons.MoreVert, stringResource(app.echo.designsystem.R.string.echo_cd_more), { topMenu = true })
                    DropdownMenu(expanded = topMenu, onDismissRequest = { topMenu = false }) {
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.jav_clear_history)) },
                            onClick = { topMenu = false; confirming = true },
                            leadingIcon = { Icon(painterResource(EchoIcons.Delete), null) },
                        )
                    }
                }
            },
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
                        EchoIcons.Movie, stringResource(R.string.state_empty_title), stringResource(R.string.jav_library_empty),
                        Modifier.padding(top = EchoSpacing.xxl),
                    )
                }
            } else {
                item {
                    SegmentedList {
                        state.items.forEach { entry ->
                            item { LibraryRow(entry, state.watched, onOpen, onResume, onStartOver, onRemove) }
                        }
                    }
                }
                item {
                    EchoButton(
                        stringResource(R.string.jav_clear_history), { confirming = true },
                        Modifier.padding(horizontal = EchoSpacing.s, vertical = EchoSpacing.xs),
                        style = ButtonStyle.Text, icon = EchoIcons.Delete,
                    )
                }
            }
        }
    }
    if (confirming) {
        AlertDialog(
            onDismissRequest = { confirming = false },
            title = { Text(stringResource(R.string.jav_clear_history_title)) },
            text = { Text(stringResource(R.string.jav_clear_history_body)) },
            confirmButton = { TextButton(onClick = { confirming = false; onClear() }) { Text(stringResource(R.string.jav_clear)) } },
            dismissButton = { TextButton(onClick = { confirming = false }) { Text(stringResource(android.R.string.cancel)) } },
        )
    }
}

/** A row: a 104 × 70 thumbnail with progress, code, title, "Resume 17:01 · Studio", and a menu. */
@Composable
private fun LibraryRow(
    entry: ContinueItem,
    watched: Boolean,
    onOpen: (String) -> Unit,
    onResume: (String) -> Unit,
    onStartOver: (String) -> Unit,
    onRemove: (String) -> Unit,
) {
    var menu by rememberSaveable(entry.id) { mutableStateOf(false) }
    val studio = entry.subtitle.orEmpty()
    SegmentedListItem(
        headline = entry.title,
        overline = entry.code,
        supporting = if (watched) stringResource(R.string.jav_watched_meta, studio) else stringResource(R.string.jav_resume_meta, clock(entry.positionMs), studio),
        onClick = { onOpen(entry.id) },
        leading = {
            val shape = RoundedCornerShape(10.dp)
            Box(Modifier.size(104.dp, 70.dp).clip(shape).border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape)) {
                CoverImage(entry.coverUrl, null, Modifier.fillMaxSize(), shape = null)
                val progress = if (entry.durationMs > 0) entry.positionMs.toFloat() / entry.durationMs else 0f
                Box(
                    Modifier.align(Alignment.BottomStart).fillMaxWidth(if (watched) 1f else progress).height(3.dp)
                        .background(MaterialTheme.colorScheme.primary),
                )
            }
        },
        trailing = {
            Box {
                EchoIconButton(EchoIcons.MoreVert, stringResource(app.echo.designsystem.R.string.echo_cd_more), { menu = true })
                DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                    if (!watched) {
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.jav_resume, clock(entry.positionMs))) },
                            onClick = { menu = false; onResume(entry.id) },
                            leadingIcon = { Icon(painterResource(EchoIcons.PlayArrowFilled), null) },
                        )
                    }
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.jav_start_over)) },
                        onClick = { menu = false; onStartOver(entry.id) },
                        leadingIcon = { Icon(painterResource(EchoIcons.Replay), null) },
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
private fun JavLibraryScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        val items = (1..5).map { i ->
            ContinueItem(
                Section.JAV, "m$i", "Movie title placeholder", positionMs = (10 + 7 * i) * 60_000L + i * 1000L,
                durationMs = 120 * 60_000L, code = "ABC-10$i", subtitle = "Example Studio", updatedAt = 0, finished = false,
            )
        }
        JavLibraryScreen(
            state = JavLibraryUiState(items = items, loaded = true),
            contentPadding = PaddingValues(), onBack = {}, onWatched = {}, onOpen = {}, onResume = {}, onStartOver = {},
            onRemove = {}, onClear = {},
        )
    }
}
