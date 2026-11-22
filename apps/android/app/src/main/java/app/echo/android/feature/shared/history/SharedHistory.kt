package app.echo.android.feature.shared.history

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.feature.shared.openRoute
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.android.ui.formatTimeLeft
import app.echo.data.model.ContinueItem
import app.echo.data.model.Section
import app.echo.data.repository.LibraryRepository
import app.echo.data.repository.PlaySource
import app.echo.designsystem.component.echo.CoverImage
import app.echo.designsystem.component.echo.EmptyState
import app.echo.designsystem.component.m3e.ButtonStyle
import app.echo.designsystem.component.m3e.ComponentSize
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
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** A day heading in 0.3: today, yesterday, or a date ("NOV 17"). */
sealed interface DayLabel {
    data object Today : DayLabel
    data object Yesterday : DayLabel
    data class On(val date: LocalDate) : DayLabel
}

data class HistoryDay(val label: DayLabel, val items: List<ContinueItem>)

data class SharedHistoryUiState(
    val section: Section = Section.ASMR,
    val days: List<HistoryDay> = emptyList(),
) {
    val isEmpty get() = days.isEmpty()
}

/** Groups history rows by the day they were last touched, newest day first. Pure, so it's unit-tested. */
fun groupByDay(items: List<ContinueItem>, today: LocalDate, zone: ZoneId = ZoneId.systemDefault()): List<HistoryDay> =
    items.groupBy { Instant.ofEpochMilli(it.updatedAt).atZone(zone).toLocalDate() }
        .entries
        .sortedByDescending { it.key }
        .map { (date, rows) -> HistoryDay(dayLabel(date, today), rows) }

private fun dayLabel(date: LocalDate, today: LocalDate): DayLabel = when (date) {
    today -> DayLabel.Today
    today.minusDays(1) -> DayLabel.Yesterday
    else -> DayLabel.On(date)
}

class SharedHistoryViewModel(
    private val library: LibraryRepository,
    private val today: () -> LocalDate = { LocalDate.now() },
) : ViewModel() {
    private val section = MutableStateFlow(Section.ASMR)

    val state: StateFlow<SharedHistoryUiState> = section.flatMapLatest { s ->
        library.history(s).map { rows -> SharedHistoryUiState(s, groupByDay(rows, today())) }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), SharedHistoryUiState())

    fun setSection(s: Section) { section.value = s }

    /** "Clear" after the confirm dialog: empties the section shown. */
    fun clear() {
        viewModelScope.launch { library.clearHistory(section.value) }
    }

    fun remove(item: ContinueItem) {
        viewModelScope.launch { library.removeHistory(item.section, item.id) }
    }
}

@Composable
fun SharedHistoryRoute(shell: ShellActions, contentPadding: PaddingValues) {
    val vm = echoViewModel { SharedHistoryViewModel(it.library) }
    val state by vm.state.collectAsStateWithLifecycle()
    var confirmClear by rememberSaveable { mutableStateOf(false) }
    SharedHistoryScreen(
        state = state,
        contentPadding = contentPadding,
        onBack = shell::back,
        onSection = vm::setSection,
        onClear = { confirmClear = true },
        onOpen = { shell.open(it.openRoute()) },
        onAction = { item, again ->
            when (item.section) {
                // Manga: resume at the saved page, or start over.
                Section.MANGA -> shell.open(Route.Reader(item.id, if (again) 1 else item.page.coerceAtLeast(1)))
                // ASMR: play the last track listened to (1.8).
                Section.ASMR -> item.track?.let { shell.play(listOf(it), 0, item.title, PlaySource.WORK) }
                Section.JAV, Section.HENTAI -> shell.open(item.openRoute())
            }
        },
        onRemove = vm::remove,
    )
    if (confirmClear) {
        AlertDialog(
            onDismissRequest = { confirmClear = false },
            title = { Text(stringResource(R.string.history_clear_title)) },
            text = { Text(stringResource(R.string.history_clear_body)) },
            confirmButton = {
                TextButton(onClick = { confirmClear = false; vm.clear() }) { Text(stringResource(R.string.history_clear_confirm)) }
            },
            dismissButton = { TextButton(onClick = { confirmClear = false }) { Text(stringResource(android.R.string.cancel)) } },
        )
    }
}

/** Figma 0.3 History (28:6776). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SharedHistoryScreen(
    state: SharedHistoryUiState,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onSection: (Section) -> Unit,
    onClear: () -> Unit,
    onOpen: (ContinueItem) -> Unit,
    /** [again] is true for a finished row: "Listen again" / "Read again" start from the beginning. */
    onAction: (ContinueItem, again: Boolean) -> Unit,
    onRemove: (ContinueItem) -> Unit,
    modifier: Modifier = Modifier,
) {
    val scroll = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    Box(modifier.fillMaxSize().testTag("screen:0.3")) {
        Column(Modifier.nestedScroll(scroll.nestedScrollConnection)) {
            EchoFlexibleAppBar(
                title = stringResource(R.string.history_title),
                onBack = onBack,
                scrollBehavior = scroll,
            )
            Row(
                Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                ConnectedButtonGroup(
                    options = listOf(
                        ConnectedOption(stringResource(R.string.history_asmr)),
                        ConnectedOption(stringResource(R.string.history_manga)),
                    ),
                    selected = if (state.section == Section.MANGA) 1 else 0,
                    onSelect = { onSection(if (it == 1) Section.MANGA else Section.ASMR) },
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(EchoSpacing.s))
                EchoButton(
                    text = stringResource(R.string.history_clear),
                    onClick = onClear,
                    style = ButtonStyle.Text,
                    size = ComponentSize.S,
                    icon = EchoIcons.Delete,
                )
            }
            LazyColumn(
                contentPadding = PaddingValues(
                    top = EchoSpacing.s,
                    bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l,
                ),
                verticalArrangement = Arrangement.spacedBy(EchoSpacing.s),
            ) {
                if (state.isEmpty) {
                    item {
                        EmptyState(
                            EchoIcons.History, stringResource(R.string.state_empty_title),
                            stringResource(R.string.library_empty_body), Modifier.padding(top = EchoSpacing.xxl),
                        )
                    }
                }
                state.days.forEach { day ->
                    item(key = "day-${day.label}") {
                        Text(
                            dayTitle(day.label),
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin + EchoSpacing.s),
                        )
                    }
                    item(key = "rows-${day.label}") {
                        SegmentedList {
                            day.items.forEach { row ->
                                item { HistoryRow(row, onOpen, onAction, onRemove) }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun dayTitle(label: DayLabel): String = when (label) {
    DayLabel.Today -> stringResource(R.string.history_day_today)
    DayLabel.Yesterday -> stringResource(R.string.history_day_yesterday)
    is DayLabel.On -> label.date.format(DateTimeFormatter.ofPattern("MMM d", Locale.getDefault())).uppercase(Locale.getDefault())
}

@Composable
private fun HistoryRow(
    item: ContinueItem,
    onOpen: (ContinueItem) -> Unit,
    onAction: (ContinueItem, Boolean) -> Unit,
    onRemove: (ContinueItem) -> Unit,
) {
    val asmr = item.section == Section.ASMR
    val actionLabel = when {
        item.finished && asmr -> R.string.history_listen_again
        item.finished -> R.string.history_read_again
        else -> R.string.history_continue
    }
    SegmentedListItem(
        headline = item.track?.title ?: item.title,
        supporting = historySupporting(item),
        onClick = { onOpen(item) },
        leading = { CoverImage(item.coverUrl, null, Modifier.size(52.dp), shape = MaterialTheme.shapes.small) },
        trailing = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                EchoButton(
                    text = stringResource(actionLabel),
                    onClick = { onAction(item, item.finished) },
                    style = if (item.finished) ButtonStyle.Outlined else ButtonStyle.Tonal,
                    size = ComponentSize.XS,
                )
                EchoIconButton(EchoIcons.Close, stringResource(R.string.history_remove_cd), { onRemove(item) }, size = ComponentSize.XS)
            }
        },
    )
}

@Composable
private fun historySupporting(item: ContinueItem): String = when {
    item.finished -> stringResource(R.string.history_finished)
    item.section == Section.MANGA -> stringResource(R.string.history_page_of, item.page, item.pageCount)
    else -> formatTimeLeft(item)
}

@EchoScreenPreviews
@Composable
private fun SharedHistoryScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        val today = LocalDate.of(2026, 11, 22)
        val rows = listOf(
            ContinueItem(Section.MANGA, "g1", "Gallery title placeholder", page = 34, pageCount = 52, updatedAt = epoch(today), finished = false),
            ContinueItem(Section.MANGA, "g2", "Another gallery title", page = 52, pageCount = 52, updatedAt = epoch(today), finished = true),
            ContinueItem(Section.MANGA, "g3", "Gallery title placeholder", page = 12, pageCount = 40, updatedAt = epoch(today.minusDays(1)), finished = false),
            ContinueItem(Section.MANGA, "g4", "Gallery title placeholder", page = 5, pageCount = 24, updatedAt = epoch(today.minusDays(5)), finished = false),
        )
        SharedHistoryScreen(
            state = SharedHistoryUiState(Section.MANGA, groupByDay(rows, today)),
            contentPadding = PaddingValues(),
            onBack = {}, onSection = {}, onClear = {}, onOpen = {}, onAction = { _, _ -> }, onRemove = {},
        )
    }
}

private fun epoch(date: LocalDate): Long = date.atTime(9, 30).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
