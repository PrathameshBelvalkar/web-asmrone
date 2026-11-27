package app.echo.android.feature.jav.idols

import android.content.Intent
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.grid.items
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.feature.jav.JavHeader
import app.echo.android.feature.jav.JavTab
import app.echo.android.feature.jav.cardMeta
import app.echo.android.feature.jav.fullWidth
import app.echo.android.feature.jav.gridPadding
import app.echo.android.feature.jav.movieCount
import app.echo.android.feature.jav.movieItems
import app.echo.android.feature.manga.LoadFallback
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.fake.FakeCatalog
import app.echo.data.model.Idol
import app.echo.data.model.Movie
import app.echo.data.model.Source
import app.echo.data.repository.JavRepository
import app.echo.data.repository.Load
import app.echo.data.repository.SettingsRepository
import app.echo.data.repository.map
import app.echo.designsystem.component.echo.CoverImage
import app.echo.designsystem.component.echo.IdolPortraitCard
import app.echo.designsystem.component.echo.MovieCard
import app.echo.designsystem.component.echo.ShelfHeader
import app.echo.designsystem.component.m3e.ButtonStyle
import app.echo.designsystem.component.m3e.ChipRow
import app.echo.designsystem.component.m3e.ChipSpec
import app.echo.designsystem.component.m3e.ComponentSize
import app.echo.designsystem.component.m3e.CoverGrid
import app.echo.designsystem.component.m3e.EchoButton
import app.echo.designsystem.component.m3e.EchoButtonGroup
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.component.m3e.EchoSheet
import app.echo.designsystem.component.m3e.IconButtonStyle
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

// 3.8 Idols ----------------------------------------------------------------------------------------------------------

enum class IdolSort { POPULAR, NEWEST, AZ }

/** Debut-year ranges of the filter sheet (Figma: Before 2015 · 2015–2019 · 2020–2024 · 2025+). */
enum class DebutRange(val label: String?, val years: IntRange) {
    BEFORE_2015(null, Int.MIN_VALUE..2014),
    Y2015_2019("2015–2019", 2015..2019),
    Y2020_2024("2020–2024", 2020..2024),
    Y2025("2025+", 2025..Int.MAX_VALUE),
}

/** The filter sheet's choices; null = any. */
data class IdolFilters(val debut: DebutRange? = null, val active: Boolean? = null, val agency: String? = null) {
    val count: Int get() = listOfNotNull(debut, active, agency).size
    fun matches(idol: Idol) = (debut == null || idol.debutYear in debut.years) &&
        (active == null || idol.active == active) && (agency == null || idol.agency == agency)
}

data class JavIdolsUiState(
    val sort: IdolSort = IdolSort.POPULAR,
    val filters: IdolFilters = IdolFilters(),
    val all: List<Idol> = emptyList(),
    val idols: Load<List<Idol>> = Load.Loading,
)

fun List<Idol>.sortedBy(sort: IdolSort) = when (sort) {
    IdolSort.POPULAR -> sortedByDescending { it.movieCount }
    IdolSort.NEWEST -> sortedByDescending { it.debutYear }
    IdolSort.AZ -> sortedBy { it.name }
}

class JavIdolsViewModel(agency: String?, jav: JavRepository) : ViewModel() {
    private val sort = MutableStateFlow(IdolSort.POPULAR)
    private val filters = MutableStateFlow(IdolFilters(agency = agency))

    val state: StateFlow<JavIdolsUiState> = combine(jav.idols(), sort, filters) { load, s, f ->
        JavIdolsUiState(s, f, (load as? Load.Content)?.value.orEmpty(), load.map { list -> list.filter(f::matches).sortedBy(s) })
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), JavIdolsUiState())

    fun setSort(value: IdolSort) { sort.value = value }
    fun setFilters(value: IdolFilters) { filters.value = value }
}

@Composable
fun JavIdolsRoute(agency: String?, shell: ShellActions, source: Source, contentPadding: PaddingValues) {
    val vm = echoViewModel(key = "idols-$agency") { JavIdolsViewModel(agency, it.jav) }
    val state by vm.state.collectAsStateWithLifecycle()
    JavIdolsScreen(
        state = state,
        header = { JavHeader(JavTab.IDOLS, shell, source) },
        contentPadding = contentPadding,
        onSort = vm::setSort,
        onFilters = vm::setFilters,
        onIdol = { shell.open(Route.Idol(it)) },
    )
}

/** Figma 3.8 Idols (28:4088): sort chips, the filter button with its count, active filters, then 3 columns. */
@Composable
fun JavIdolsScreen(
    state: JavIdolsUiState,
    header: @Composable () -> Unit,
    contentPadding: PaddingValues,
    onSort: (IdolSort) -> Unit,
    onFilters: (IdolFilters) -> Unit,
    onIdol: (String) -> Unit,
) {
    var sheet by rememberSaveable { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().testTag("screen:3.8")) {
        header()
        Row(Modifier.fillMaxWidth().padding(end = EchoSpacing.m), verticalAlignment = Alignment.CenterVertically) {
            ChipRow(
                chips = listOf(
                    ChipSpec(stringResource(R.string.jav_popular)),
                    ChipSpec(stringResource(R.string.jav_newest)),
                    ChipSpec(stringResource(R.string.jav_az)),
                ),
                onClick = { onSort(IdolSort.entries[it]) },
                selected = setOf(state.sort.ordinal),
                modifier = Modifier.weight(1f).padding(vertical = EchoSpacing.xs + EchoSpacing.xxs),
            )
            BadgedBox(badge = { if (state.filters.count > 0) Badge { Text(state.filters.count.toString()) } }) {
                EchoIconButton(EchoIcons.Tune, stringResource(R.string.jav_filters), { sheet = true }, style = IconButtonStyle.Tonal)
            }
        }
        ActiveFilters(state.filters, onFilters)
        CoverGrid(columns = 3, modifier = Modifier.weight(1f), contentPadding = gridPadding(contentPadding)) {
            when (val idols = state.idols) {
                is Load.Content -> items(idols.value, key = { it.id }) { idol ->
                    IdolPortraitCard(
                        idol.name, movieCount(idol.movieCount), idol.imageUrl,
                        onClick = { onIdol(idol.id) },
                    )
                }
                else -> fullWidth("state") { LoadFallback(idols, onRetry = {}) }
            }
        }
    }
    if (sheet) {
        FilterSheet(state.filters, state.all, onApply = { onFilters(it); sheet = false }, onDismiss = { sheet = false })
    }
}

@Composable
private fun DebutRange.text(): String = label ?: stringResource(R.string.jav_before_2015)

/** The active filters as input chips; × removes one. */
@Composable
private fun ActiveFilters(filters: IdolFilters, onFilters: (IdolFilters) -> Unit) {
    val chips = buildList {
        filters.debut?.let { add(stringResource(R.string.jav_debut_range, it.text()) to filters.copy(debut = null)) }
        filters.active?.let { add(stringResource(if (it) R.string.jav_active else R.string.jav_retired) to filters.copy(active = null)) }
        filters.agency?.let { add(it to filters.copy(agency = null)) }
    }
    if (chips.isEmpty()) return
    LazyRow(
        contentPadding = PaddingValues(horizontal = EchoSpacing.screenMargin),
        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s),
    ) {
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

/** The filter sheet (Figma 3.8): Debut year, Status, Agency; Reset; Cancel · Show N idols. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FilterSheet(current: IdolFilters, all: List<Idol>, onApply: (IdolFilters) -> Unit, onDismiss: () -> Unit) {
    var draft by rememberSaveable(stateSaver = IdolFiltersSaver) { mutableStateOf(current) }
    val agencies = all.map { it.agency }.distinct().sorted()
    EchoSheet(onDismiss = onDismiss) {
        Row(Modifier.fillMaxWidth().padding(start = 20.dp, end = EchoSpacing.m), verticalAlignment = Alignment.CenterVertically) {
            Text(stringResource(R.string.jav_filters), style = MaterialTheme.typography.titleLargeEmphasized, modifier = Modifier.weight(1f))
            EchoButton(stringResource(R.string.jav_reset), { draft = IdolFilters() }, style = ButtonStyle.Text)
        }
        Group(stringResource(R.string.jav_debut_year)) {
            DebutRange.entries.forEach { r -> Choice(r.text(), draft.debut == r) { draft = draft.copy(debut = r.takeIf { draft.debut != r }) } }
        }
        Group(stringResource(R.string.jav_status)) {
            Choice(stringResource(R.string.jav_active), draft.active == true) { draft = draft.copy(active = true.takeIf { draft.active != true }) }
            Choice(stringResource(R.string.jav_retired), draft.active == false) { draft = draft.copy(active = false.takeIf { draft.active != false }) }
        }
        Group(stringResource(R.string.jav_agency)) {
            agencies.forEach { a -> Choice(a, draft.agency == a) { draft = draft.copy(agency = a.takeIf { draft.agency != a }) } }
        }
        EchoButtonGroup(Modifier.padding(vertical = EchoSpacing.l)) {
            EchoButton(stringResource(android.R.string.cancel), onDismiss, Modifier.weight(1f), ButtonStyle.Outlined, ComponentSize.M)
            EchoButton(
                stringResource(R.string.jav_show_idols, all.count(draft::matches)), { onApply(draft) },
                Modifier.weight(1f), size = ComponentSize.M,
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Group(label: String, content: @Composable () -> Unit) {
    Text(
        label.uppercase(),
        style = MaterialTheme.typography.labelMediumEmphasized,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(start = 20.dp, top = EchoSpacing.l, bottom = EchoSpacing.xs),
    )
    FlowRow(Modifier.padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s)) { content() }
}

@Composable
private fun Choice(label: String, selected: Boolean, onClick: () -> Unit) = FilterChip(
    selected = selected,
    onClick = onClick,
    label = { Text(label) },
    leadingIcon = if (selected) {
        { Icon(painterResource(EchoIcons.Check), null, Modifier.size(FilterChipDefaults.IconSize)) }
    } else {
        null
    },
)

/** Keeps the sheet's draft across rotation: debut ordinal, active, agency. */
private val IdolFiltersSaver = androidx.compose.runtime.saveable.listSaver<IdolFilters, Any?>(
    save = { listOf(it.debut?.ordinal, it.active, it.agency) },
    restore = { IdolFilters((it[0] as Int?)?.let(DebutRange.entries::get), it[1] as Boolean?, it[2] as String?) },
)

// 3.9 Idol page ------------------------------------------------------------------------------------------------------

enum class IdolMovieFilter { ONLY_HER, NEWEST, MOST_VIEWED }

data class JavIdolUiState(
    val idol: Idol? = null,
    val filter: IdolMovieFilter = IdolMovieFilter.NEWEST,
    val upcoming: List<Movie> = emptyList(),
    val movies: Load<List<Movie>> = Load.Loading,
)

class JavIdolViewModel(id: String, jav: JavRepository, settings: SettingsRepository) : ViewModel() {
    private val filter = MutableStateFlow(IdolMovieFilter.NEWEST)

    val state: StateFlow<JavIdolUiState> = combine(jav.idol(id), settings.settings, filter) { load, s, f ->
        val pair = (load as? Load.Content)?.value
        val idol = pair?.first
        val all = pair?.second.orEmpty()
        val released = all.filter { !it.upcoming }.let { list ->
            when (f) {
                IdolMovieFilter.ONLY_HER -> list.filter { it.idols.firstOrNull() == idol?.name }.sortedByDescending { it.releaseDate }
                IdolMovieFilter.NEWEST -> list.sortedByDescending { it.releaseDate }
                IdolMovieFilter.MOST_VIEWED -> list.sortedByDescending { it.views }
            }
        }
        JavIdolUiState(
            idol = idol,
            filter = f,
            // S.5 "Hide upcoming movies" removes the Upcoming shelf.
            upcoming = if (s.jav.hideUpcoming) emptyList() else all.filter { it.upcoming },
            movies = if (pair == null) load.map { emptyList() } else Load.Content(released),
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), JavIdolUiState())

    fun setFilter(value: IdolMovieFilter) { filter.value = value }
}

private const val IDOLS_URL = "https://www.javdatabase.com/idols/"

@Composable
fun JavIdolRoute(id: String, shell: ShellActions, contentPadding: PaddingValues) {
    val vm = echoViewModel(key = "idol-$id") { JavIdolViewModel(id, it.jav, it.settings) }
    val state by vm.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val uri = LocalUriHandler.current
    JavIdolScreen(
        state = state,
        contentPadding = contentPadding,
        onBack = shell::back,
        onShare = { idol ->
            val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, "${idol.name}\n$IDOLS_URL")
            context.startActivity(Intent.createChooser(send, null))
        },
        onOpenSite = { uri.openUri(IDOLS_URL) },
        onAgency = { shell.open(Route.Idols(it)) },
        onFilter = vm::setFilter,
        onMovie = { shell.open(Route.Movie(it)) },
        onUpcoming = { shell.open(Route.Latest) },
    )
}

/** Figma 3.9 Idol page (28:4233): photo and name, Follow · Agency, filters, Upcoming, then her movies. */
@Composable
fun JavIdolScreen(
    state: JavIdolUiState,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onShare: (Idol) -> Unit,
    onOpenSite: () -> Unit,
    onAgency: (String) -> Unit,
    onFilter: (IdolMovieFilter) -> Unit,
    onMovie: (String) -> Unit,
    onUpcoming: () -> Unit = {},
) {
    var following by rememberSaveable { mutableStateOf(false) }
    val idol = state.idol
    Column(Modifier.fillMaxSize().statusBarsPadding().testTag("screen:3.9")) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            EchoIconButton(EchoIcons.ArrowBack, stringResource(app.echo.designsystem.R.string.echo_cd_back), onBack)
            androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
            if (idol != null) EchoIconButton(EchoIcons.Share, stringResource(R.string.jav_share), { onShare(idol) })
            EchoIconButton(EchoIcons.OpenInNew, stringResource(R.string.jav_open_site), onOpenSite)
        }
        if (idol == null) {
            LoadFallback(state.movies, onRetry = {})
            return@Column
        }
        // Rows of two cards, not a grid: the chips and shelf headers keep their own screen margins.
        LazyColumn(
            Modifier.weight(1f),
            contentPadding = PaddingValues(bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l),
            verticalArrangement = Arrangement.spacedBy(EchoSpacing.s),
        ) {
            item("head") { Head(idol) }
            item("actions") {
                Row(
                    Modifier.padding(horizontal = EchoSpacing.screenMargin).padding(top = EchoSpacing.s),
                    horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s),
                ) {
                    EchoButton(
                        stringResource(if (following) R.string.jav_following else R.string.jav_follow), { following = !following },
                        style = if (following) ButtonStyle.Tonal else ButtonStyle.Filled,
                        icon = if (following) EchoIcons.Check else EchoIcons.Add,
                    )
                    EchoButton(idol.agency, { onAgency(idol.agency) }, style = ButtonStyle.Outlined, icon = EchoIcons.PersonFilled)
                }
            }
            item("filters") {
                ChipRow(
                    chips = listOf(
                        ChipSpec(stringResource(R.string.jav_only_her), EchoIcons.PersonFilled),
                        ChipSpec(stringResource(R.string.jav_newest)),
                        ChipSpec(stringResource(R.string.jav_most_viewed)),
                    ),
                    onClick = { onFilter(IdolMovieFilter.entries[it]) },
                    selected = setOf(state.filter.ordinal),
                )
            }
            if (state.upcoming.isNotEmpty()) {
                item("upcoming-head") { ShelfHeader(stringResource(R.string.jav_upcoming), onClick = onUpcoming) }
                item("upcoming") {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = EchoSpacing.screenMargin),
                        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.m),
                    ) {
                        items(state.upcoming, key = { it.id }) { m ->
                            MovieCard(m.code, null, m.cardMeta(), m.coverUrl, { onMovie(m.id) }, width = 160.dp)
                        }
                    }
                }
            }
            item("movies-head") { ShelfHeader(stringResource(R.string.jav_movies_count, idol.movieCount)) }
            val movies = (state.movies as? Load.Content)?.value.orEmpty()
            items(movies.chunked(2), key = { row -> row.first().id }) { row ->
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin).padding(bottom = EchoSpacing.s),
                    horizontalArrangement = Arrangement.spacedBy(EchoSpacing.m),
                ) {
                    row.forEach { m -> MovieCard(m.code, m.title, m.cardMeta(), m.coverUrl, { onMovie(m.id) }, Modifier.weight(1f)) }
                    if (row.size == 1) androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
                }
            }
        }
    }
}

/** The 88 × 112 photo, the name (36 sp) and "Debut 2021 · Active · 126 movies". */
@Composable
private fun Head(idol: Idol) {
    Row(
        Modifier.padding(horizontal = EchoSpacing.screenMargin),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.l),
    ) {
        val shape = MaterialTheme.shapes.extraLarge
        CoverImage(
            idol.imageUrl, null,
            Modifier.size(88.dp, 112.dp).border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape),
            shape = shape,
        )
        Column(verticalArrangement = Arrangement.spacedBy(EchoSpacing.xs)) {
            Text(idol.name, style = MaterialTheme.typography.displaySmallEmphasized.copy(fontSize = 36.sp, lineHeight = 44.sp))
            Text(
                stringResource(
                    R.string.jav_idol_meta, idol.debutYear,
                    stringResource(if (idol.active) R.string.jav_active else R.string.jav_retired), movieCount(idol.movieCount),
                ),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

// Previews -----------------------------------------------------------------------------------------------------------

@EchoScreenPreviews
@Composable
private fun JavIdolsScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        JavIdolsScreen(
            state = JavIdolsUiState(
                filters = IdolFilters(debut = DebutRange.Y2020_2024, active = true),
                all = FakeCatalog.idols, idols = Load.Content(FakeCatalog.idols),
            ),
            header = { JavHeader(JavTab.IDOLS, "javdatabase", EchoIcons.Movie, "P", {}, {}, {}, {}) },
            contentPadding = PaddingValues(), onSort = {}, onFilters = {}, onIdol = {},
        )
    }
}

@EchoScreenPreviews
@Composable
private fun JavIdolScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        val idol = FakeCatalog.idols.first()
        JavIdolScreen(
            state = JavIdolUiState(
                idol = idol, upcoming = FakeCatalog.movies.filter { it.upcoming },
                movies = Load.Content(FakeCatalog.movies.filter { !it.upcoming }.take(4)),
            ),
            contentPadding = PaddingValues(), onBack = {}, onShare = {}, onOpenSite = {}, onAgency = {}, onFilter = {}, onMovie = {},
        )
    }
}
