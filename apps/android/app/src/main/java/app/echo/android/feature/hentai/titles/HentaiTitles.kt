package app.echo.android.feature.hentai.titles

import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.InputChip
import androidx.compose.material3.InputChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.feature.hentai.GRID_COLUMNS
import app.echo.android.feature.hentai.HentaiHeader
import app.echo.android.feature.hentai.HentaiTab
import app.echo.android.feature.hentai.TitleRow
import app.echo.android.feature.hentai.label
import app.echo.android.feature.hentai.titleCount
import app.echo.android.feature.manga.LoadFallback
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.fake.FakeCatalog
import app.echo.data.model.HentaiTag
import app.echo.data.model.HentaiTagCategory
import app.echo.data.model.HentaiTitle
import app.echo.data.model.Source
import app.echo.data.model.Tag
import app.echo.data.repository.HentaiRepository
import app.echo.data.repository.Load
import app.echo.data.repository.map
import app.echo.designsystem.component.m3e.ButtonStyle
import app.echo.designsystem.component.m3e.ChipRow
import app.echo.designsystem.component.m3e.ChipSpec
import app.echo.designsystem.component.m3e.ComponentSize
import app.echo.designsystem.component.m3e.ConnectedButtonGroup
import app.echo.designsystem.component.m3e.ConnectedOption
import app.echo.designsystem.component.m3e.EchoButton
import app.echo.designsystem.component.m3e.EchoButtonGroup
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.component.m3e.EchoRangeSlider
import app.echo.designsystem.component.m3e.EchoSheet
import app.echo.designsystem.component.m3e.TriState
import app.echo.designsystem.component.m3e.TriStateChip
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

/** H.3 sorts (Figma: Newest upload · Views · Rating · Trending · Released). */
enum class TitleSort { NEWEST, VIEWS, RATING, TRENDING, RELEASED }

enum class TitleCensorship { ALL, CENSORED, UNCENSORED }

const val FIRST_YEAR = 2018
const val LAST_YEAR = 2026

/** The H.4 filters, plus what the route pre-set (season, query). */
data class TitleFilters(
    val tags: Map<String, TriState> = emptyMap(),
    /** Tags must match: all included (AND) or any of them (OR). */
    val matchAll: Boolean = true,
    val studios: Set<String> = emptySet(),
    val fromYear: Int = FIRST_YEAR,
    val toYear: Int = LAST_YEAR,
    val season: String? = null,
    val query: String? = null,
) {
    private val included get() = tags.filterValues { it == TriState.INCLUDE }.keys
    private val excluded get() = tags.filterValues { it == TriState.EXCLUDE }.keys
    val yearsSet: Boolean get() = fromYear != FIRST_YEAR || toYear != LAST_YEAR

    /** The badge on Filters: tags, studios and the year range (season and query show as chips but aren't H.4's). */
    val count: Int get() = included.size + excluded.size + studios.size + (if (yearsSet) 1 else 0)

    fun matches(t: HentaiTitle): Boolean {
        val inc = included
        val tagsOk = inc.isEmpty() || if (matchAll) inc.all { it in t.tags } else inc.any { it in t.tags }
        return tagsOk && excluded.none { it in t.tags } &&
            (studios.isEmpty() || t.studio in studios) &&
            t.year in fromYear..toYear &&
            (season == null || t.season == season) &&
            (query.isNullOrBlank() || (listOf(t.title, t.studio, t.series.orEmpty()) + t.tags).any { it.contains(query, ignoreCase = true) })
    }
}

fun List<HentaiTitle>.sortedBy(sort: TitleSort, descending: Boolean): List<HentaiTitle> {
    val sorted = when (sort) {
        TitleSort.NEWEST -> sortedBy { it.added }
        TitleSort.VIEWS -> sortedBy { it.views }
        TitleSort.RATING -> sortedBy { it.rating }
        TitleSort.TRENDING -> sortedBy { it.trending }
        TitleSort.RELEASED -> sortedBy { it.released }
    }
    return if (descending) sorted.reversed() else sorted
}

data class HentaiTitlesUiState(
    val sort: TitleSort = TitleSort.NEWEST,
    val descending: Boolean = true,
    val censorship: TitleCensorship = TitleCensorship.ALL,
    val filters: TitleFilters = TitleFilters(),
    val all: List<HentaiTitle> = emptyList(),
    val tags: List<HentaiTag> = emptyList(),
    val studios: List<Tag> = emptyList(),
    val titles: Load<List<HentaiTitle>> = Load.Loading,
)

class HentaiTitlesViewModel(route: Route.HentaiTitles, hentai: HentaiRepository) : ViewModel() {
    private val sort = MutableStateFlow(route.sort?.let { s -> TitleSort.entries.firstOrNull { it.name == s } } ?: TitleSort.NEWEST)
    private val descending = MutableStateFlow(true)
    private val censorship = MutableStateFlow(TitleCensorship.ALL)
    private val filters = MutableStateFlow(
        TitleFilters(
            tags = route.tag?.let { mapOf(it to TriState.INCLUDE) }.orEmpty(),
            studios = setOfNotNull(route.studio),
            season = route.season,
            query = route.query,
        ),
    )
    private val options = combine(sort, descending, censorship, filters) { s, d, c, f -> Options(s, d, c, f) }

    val state: StateFlow<HentaiTitlesUiState> = combine(hentai.catalog(), hentai.tags(), hentai.studios(), options) { load, tags, studios, o ->
        val all = (load as? Load.Content)?.value.orEmpty()
        HentaiTitlesUiState(
            o.sort, o.descending, o.censorship, o.filters, all,
            (tags as? Load.Content)?.value.orEmpty(), (studios as? Load.Content)?.value.orEmpty(),
            load.map { list -> list.filter { it.passes(o.censorship) && o.filters.matches(it) }.sortedBy(o.sort, o.descending) },
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), HentaiTitlesUiState())

    private data class Options(val sort: TitleSort, val descending: Boolean, val censorship: TitleCensorship, val filters: TitleFilters)

    fun setSort(value: TitleSort) { sort.value = value }
    fun toggleOrder() { descending.value = !descending.value }
    fun setCensorship(value: TitleCensorship) { censorship.value = value }
    fun setFilters(value: TitleFilters) { filters.value = value }
}

private fun HentaiTitle.passes(c: TitleCensorship) = when (c) {
    TitleCensorship.ALL -> true
    TitleCensorship.CENSORED -> !uncensored
    TitleCensorship.UNCENSORED -> uncensored
}

@Composable
fun HentaiTitlesRoute(route: Route.HentaiTitles, shell: ShellActions, source: Source, contentPadding: PaddingValues) {
    // Try again builds a fresh ViewModel, which loads again.
    var attempt by rememberSaveable { mutableIntStateOf(0) }
    val vm = echoViewModel(key = "titles-$route-$attempt") { HentaiTitlesViewModel(route, it.hentai) }
    val state by vm.state.collectAsStateWithLifecycle()
    HentaiTitlesScreen(
        onRetry = { attempt++ },
        state = state,
        header = { HentaiHeader(HentaiTab.TITLES, shell, source) },
        contentPadding = contentPadding,
        onSort = vm::setSort,
        onOrder = vm::toggleOrder,
        onCensorship = vm::setCensorship,
        onFilters = vm::setFilters,
        onTitle = { shell.open(Route.HentaiTitle(it)) },
    )
}

@Composable
private fun TitleSort.label(): String = stringResource(
    when (this) {
        TitleSort.NEWEST -> R.string.hentai_sort_newest
        TitleSort.VIEWS -> R.string.hentai_sort_views
        TitleSort.RATING -> R.string.hentai_sort_rating
        TitleSort.TRENDING -> R.string.hentai_sort_trending
        TitleSort.RELEASED -> R.string.hentai_sort_released
    },
)

/** Figma H.3 All titles (28:4991): sorts and order, censorship, Filters (→ H.4) and active filters, then 3 columns. */
@Composable
fun HentaiTitlesScreen(
    state: HentaiTitlesUiState,
    header: @Composable () -> Unit,
    contentPadding: PaddingValues,
    onSort: (TitleSort) -> Unit,
    onOrder: () -> Unit,
    onCensorship: (TitleCensorship) -> Unit,
    onFilters: (TitleFilters) -> Unit,
    onTitle: (String) -> Unit,
    onRetry: () -> Unit = {},
) {
    var sheet by rememberSaveable { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().testTag("screen:H.3")) {
        header()
        Row(Modifier.fillMaxWidth().padding(end = EchoSpacing.s), verticalAlignment = Alignment.CenterVertically) {
            ChipRow(
                chips = TitleSort.entries.map { ChipSpec(it.label()) },
                onClick = { onSort(TitleSort.entries[it]) },
                selected = setOf(state.sort.ordinal),
                modifier = Modifier.weight(1f).padding(vertical = EchoSpacing.xs),
            )
            EchoIconButton(
                EchoIcons.Sort, stringResource(R.string.hentai_order), onOrder,
                modifier = Modifier.rotate(if (state.descending) 0f else 180f),
            )
        }
        ConnectedButtonGroup(
            options = listOf(
                ConnectedOption(stringResource(R.string.hentai_all)),
                ConnectedOption(stringResource(R.string.hentai_censored)),
                ConnectedOption(stringResource(R.string.hentai_uncensored)),
            ),
            selected = state.censorship.ordinal,
            onSelect = { onCensorship(TitleCensorship.entries[it]) },
            modifier = Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.xs),
        )
        ActiveFilters(state.filters, onFilters, onOpen = { sheet = true })
        val titles = state.titles
        if (titles !is Load.Content) {
            LoadFallback(titles, onRetry = onRetry)
        } else {
            Text(
                titleCount(titles.value.size),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.xs),
            )
            LazyColumn(
                Modifier.weight(1f),
                contentPadding = PaddingValues(top = EchoSpacing.xs, bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l),
            ) {
                items(titles.value.chunked(GRID_COLUMNS), key = { it.first().id }) { row -> TitleRow(row, onTitle) }
            }
        }
    }
    if (sheet) {
        FiltersSheet(state, onApply = { onFilters(it); sheet = false }, onDismiss = { sheet = false })
    }
}

/** "⚙ Filters ③" (Tonal, S) and the active filters as input chips; × removes one. */
@Composable
private fun ActiveFilters(filters: TitleFilters, onFilters: (TitleFilters) -> Unit, onOpen: () -> Unit) {
    val chips = buildList {
        filters.tags.forEach { (tag, s) ->
            if (s != TriState.OFF) {
                val label = if (s == TriState.EXCLUDE) stringResource(R.string.hentai_not_tag, tag) else tag
                add(label to filters.copy(tags = filters.tags - tag))
            }
        }
        filters.studios.forEach { add(it to filters.copy(studios = filters.studios - it)) }
        if (filters.yearsSet) {
            add(stringResource(R.string.hentai_year_range, filters.fromYear, filters.toYear) to filters.copy(fromYear = FIRST_YEAR, toYear = LAST_YEAR))
        }
        filters.season?.let { add(it to filters.copy(season = null)) }
        filters.query?.takeIf { it.isNotBlank() }?.let { add("“$it”" to filters.copy(query = null)) }
    }
    LazyRow(
        contentPadding = PaddingValues(horizontal = EchoSpacing.screenMargin),
        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        item("filters") {
            BadgedBox(badge = { if (filters.count > 0) Badge { Text(filters.count.toString()) } }) {
                EchoButton(stringResource(R.string.hentai_filters), onOpen, style = ButtonStyle.Tonal, icon = EchoIcons.Tune)
            }
        }
        items(chips, key = { it.first }) { (label, without) ->
            InputChip(
                selected = false,
                onClick = { onFilters(without) },
                label = { Text(label) },
                trailingIcon = { Icon(painterResource(EchoIcons.Close), null, Modifier.size(InputChipDefaults.IconSize)) },
            )
        }
    }
}

/** Figma H.4 Filters sheet (28:5186): AND / OR, tri-state tag chips by group, studios, release years. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FiltersSheet(state: HentaiTitlesUiState, onApply: (TitleFilters) -> Unit, onDismiss: () -> Unit) {
    var draft by remember { mutableStateOf(state.filters) }
    val count = state.all.count { draft.matches(it) }
    EchoSheet(onDismiss = onDismiss) {
        Row(Modifier.fillMaxWidth().padding(start = 20.dp, end = EchoSpacing.m), verticalAlignment = Alignment.CenterVertically) {
            Text(stringResource(R.string.hentai_filters), style = MaterialTheme.typography.titleLargeEmphasized, modifier = Modifier.weight(1f))
            EchoButton(stringResource(R.string.hentai_reset), { draft = TitleFilters(season = draft.season, query = draft.query) }, style = ButtonStyle.Text)
        }
        // The filters scroll; Cancel · Show stay pinned under them (Figma H.4).
        Column(
            Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(EchoSpacing.xs),
        ) {
            Row(Modifier.fillMaxWidth().padding(top = EchoSpacing.m), verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.hentai_tags_match), style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                ConnectedButtonGroup(
                    options = listOf(ConnectedOption(stringResource(R.string.hentai_match_all)), ConnectedOption(stringResource(R.string.hentai_match_any))),
                    selected = if (draft.matchAll) 0 else 1,
                    onSelect = { draft = draft.copy(matchAll = it == 0) },
                    equalWidth = false,
                )
            }
            Text(stringResource(R.string.hentai_tri_hint), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            HentaiTagCategory.entries.forEach { cat ->
                val tags = state.tags.filter { it.category == cat }
                if (tags.isNotEmpty()) {
                    GroupLabel(stringResource(cat.label()))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
                        tags.forEach { tag ->
                            val current = draft.tags[tag.name] ?: TriState.OFF
                            TriStateChip(tag.name, current, onClick = {
                                val next = current.next()
                                draft = draft.copy(tags = if (next == TriState.OFF) draft.tags - tag.name else draft.tags + (tag.name to next))
                            })
                        }
                    }
                }
            }
            GroupLabel(stringResource(R.string.hentai_studios))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
                state.studios.forEach { s ->
                    val on = s.name in draft.studios
                    FilterChip(
                        selected = on,
                        onClick = { draft = draft.copy(studios = if (on) draft.studios - s.name else draft.studios + s.name) },
                        label = { Text(s.name) },
                        leadingIcon = if (on) {
                            { Icon(painterResource(EchoIcons.Check), null, Modifier.size(FilterChipDefaults.IconSize)) }
                        } else {
                            null
                        },
                    )
                }
            }
            GroupLabel(stringResource(R.string.hentai_release_year, draft.fromYear, draft.toYear))
            EchoRangeSlider(
                value = draft.fromYear.toFloat()..draft.toYear.toFloat(),
                onValueChange = { r -> draft = draft.copy(fromYear = r.start.toInt(), toYear = r.endInclusive.toInt()) },
                valueRange = FIRST_YEAR.toFloat()..LAST_YEAR.toFloat(),
                steps = LAST_YEAR - FIRST_YEAR - 1,
            )
        }
        EchoButtonGroup(Modifier.padding(vertical = EchoSpacing.l)) {
            EchoButton(stringResource(android.R.string.cancel), onDismiss, Modifier.weight(1f), ButtonStyle.Outlined, ComponentSize.M)
            EchoButton(stringResource(R.string.hentai_show_titles, count), { onApply(draft) }, Modifier.weight(1f), size = ComponentSize.M)
        }
    }
}

@Composable
private fun GroupLabel(text: String) = Text(
    text.uppercase(),
    style = MaterialTheme.typography.labelMediumEmphasized,
    color = MaterialTheme.colorScheme.onSurfaceVariant,
    modifier = Modifier.padding(top = EchoSpacing.m, bottom = EchoSpacing.xxs),
)

@EchoScreenPreviews
@Composable
private fun HentaiTitlesScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        val all = FakeCatalog.hentaiTitles
        HentaiTitlesScreen(
            state = HentaiTitlesUiState(
                filters = TitleFilters(tags = mapOf("Romance" to TriState.INCLUDE, "Maid" to TriState.EXCLUDE)),
                all = all, titles = Load.Content(all.take(9)),
            ),
            header = { HentaiHeader(HentaiTab.TITLES, "Hentai", EchoIcons.PlayArrow, "P", {}, {}, {}, {}) },
            contentPadding = PaddingValues(), onSort = {}, onOrder = {}, onCensorship = {}, onFilters = {}, onTitle = {},
        )
    }
}
