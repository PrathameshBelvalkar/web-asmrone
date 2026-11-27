package app.echo.android.feature.hentai.browse

import androidx.compose.foundation.layout.heightIn
import androidx.annotation.DrawableRes
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.feature.hentai.HentaiHeader
import app.echo.android.feature.hentai.HentaiTab
import app.echo.android.feature.hentai.TitleCard
import app.echo.android.feature.hentai.label
import app.echo.android.feature.hentai.openHentaiTab
import app.echo.android.feature.hentai.titleCount
import app.echo.android.feature.hentai.titles.TitleSort
import app.echo.android.feature.manga.LoadFallback
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.fake.FakeCatalog
import app.echo.data.model.HentaiTag
import app.echo.data.model.HentaiTagCategory
import app.echo.data.model.HentaiTitle
import app.echo.data.model.Shelf
import app.echo.data.model.Source
import app.echo.data.model.Tag
import app.echo.data.repository.HentaiRepository
import app.echo.data.repository.Load
import app.echo.designsystem.component.echo.CoverImage
import app.echo.designsystem.component.echo.ShelfHeader
import app.echo.designsystem.component.m3e.ChipRow
import app.echo.designsystem.component.m3e.ChipSpec
import app.echo.designsystem.component.m3e.ConnectedButtonGroup
import app.echo.designsystem.component.m3e.ConnectedOption
import app.echo.designsystem.component.m3e.CoverRow
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

// H.2 Browse ---------------------------------------------------------------------------------------------------------

data class HentaiBrowseUiState(
    val titles: List<HentaiTitle> = emptyList(),
    val tags: List<HentaiTag> = emptyList(),
    val studios: List<Tag> = emptyList(),
    val loaded: Load<Unit> = Load.Loading,
)

class HentaiBrowseViewModel(hentai: HentaiRepository) : ViewModel() {
    val state: StateFlow<HentaiBrowseUiState> = combine(hentai.catalog(), hentai.tags(), hentai.studios()) { titles, tags, studios ->
        HentaiBrowseUiState(
            (titles as? Load.Content)?.value.orEmpty(), (tags as? Load.Content)?.value.orEmpty(), (studios as? Load.Content)?.value.orEmpty(),
            if (titles is Load.Content) Load.Content(Unit) else titles as Load<Unit>,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), HentaiBrowseUiState())
}

@Composable
fun HentaiBrowseRoute(shell: ShellActions, source: Source, contentPadding: PaddingValues) {
    // Try again builds a fresh ViewModel, which loads again.
    var attempt by rememberSaveable { mutableIntStateOf(0) }
    val vm = echoViewModel(key = "browse-$attempt") { HentaiBrowseViewModel(it.hentai) }
    val state by vm.state.collectAsStateWithLifecycle()
    HentaiBrowseScreen(
        onRetry = { attempt++ },
        state = state,
        header = { HentaiHeader(HentaiTab.BROWSE, shell, source) },
        contentPadding = contentPadding,
        onTrending = { shell.open(Route.HentaiTitles(sort = TitleSort.TRENDING.name)) },
        onSeasons = { shell.openHentaiTab(HentaiTab.BROWSE, HentaiTab.SEASONS) },
        onRandom = { state.titles.randomOrNull()?.let { shell.open(Route.HentaiTitle(it.id)) } },
        onAll = { shell.openHentaiTab(HentaiTab.BROWSE, HentaiTab.TITLES) },
        onTag = { shell.open(Route.HentaiTitles(tag = it)) },
        onStudio = { shell.open(Route.HentaiTitles(studio = it)) },
    )
}

/** Figma H.2 Browse (28:4852): four entry cards, tags by group as tall cards, then studios. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun HentaiBrowseScreen(
    state: HentaiBrowseUiState,
    header: @Composable () -> Unit,
    contentPadding: PaddingValues,
    onTrending: () -> Unit,
    onSeasons: () -> Unit,
    onRandom: () -> Unit,
    onAll: () -> Unit,
    onTag: (String) -> Unit,
    onStudio: (String) -> Unit,
    onRetry: () -> Unit = {},
) {
    // null = All; otherwise the category's index.
    var category by rememberSaveable { mutableIntStateOf(-1) }
    var studiosAz by rememberSaveable { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().testTag("screen:H.2")) {
        header()
        if (state.loaded !is Load.Content) {
            LoadFallback(state.loaded, onRetry = onRetry)
            return@Column
        }
        LazyColumn(
            Modifier.weight(1f),
            contentPadding = PaddingValues(top = EchoSpacing.m, bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l),
            verticalArrangement = Arrangement.spacedBy(EchoSpacing.s),
        ) {
            item("entries") {
                Column(Modifier.padding(horizontal = EchoSpacing.screenMargin), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        EntryCard(EchoIcons.TrendingUp, R.string.hentai_trending, stringResource(R.string.hentai_trending_body), onTrending, Modifier.weight(1f))
                        EntryCard(EchoIcons.CalendarToday, R.string.hentai_tab_seasons, stringResource(R.string.hentai_seasons_body), onSeasons, Modifier.weight(1f))
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        EntryCard(EchoIcons.Shuffle, R.string.hentai_random, stringResource(R.string.hentai_random_body), onRandom, Modifier.weight(1f))
                        EntryCard(EchoIcons.GridView, R.string.hentai_tab_titles, titleCount(state.titles.size), onAll, Modifier.weight(1f))
                    }
                }
            }
            item("tags-head") { ShelfHeader(stringResource(R.string.hentai_categories)) }
            item("categories") {
                val chips = listOf(ChipSpec(stringResource(R.string.hentai_all))) +
                    HentaiTagCategory.entries.map { ChipSpec(stringResource(it.label())) }
                ChipRow(chips, onClick = { category = it - 1 }, selected = setOf(category + 1))
            }
            item("tags") {
                val tags = state.tags.filter { category < 0 || it.category == HentaiTagCategory.entries[category] }
                LazyRow(
                    contentPadding = PaddingValues(horizontal = EchoSpacing.screenMargin),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    items(tags, key = { it.name }) { tag -> TagCard(tag) { onTag(tag.name) } }
                }
            }
            item("studios-head") { ShelfHeader(stringResource(R.string.hentai_studios_brands)) }
            item("studios-sort") {
                ConnectedButtonGroup(
                    options = listOf(ConnectedOption(stringResource(R.string.hentai_uploads)), ConnectedOption(stringResource(R.string.hentai_az))),
                    selected = if (studiosAz) 1 else 0,
                    onSelect = { studiosAz = it == 1 },
                    modifier = Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin),
                )
            }
            item("studios") {
                val studios = if (studiosAz) state.studios.sortedBy { it.name } else state.studios.sortedByDescending { it.count }
                FlowRow(Modifier.padding(horizontal = EchoSpacing.screenMargin), horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
                    studios.forEach { s -> AssistChip(onClick = { onStudio(s.name) }, label = { Text("${s.name} · ${s.count}") }) }
                }
            }
        }
    }
}

/** A big entry card (Figma "Cards (Filled) — big entry cards"): a 40 dp icon tile, title, one line. */
@Composable
private fun EntryCard(@DrawableRes icon: Int, title: Int, body: String, onClick: () -> Unit, modifier: Modifier) {
    Card(
        onClick = onClick,
        // Figma's 117 dp is the minimum: larger text grows the card instead of clipping it.
        modifier = modifier.heightIn(min = 117.dp),
        shape = MaterialTheme.shapes.extraLarge,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
    ) {
        Column(Modifier.padding(EchoSpacing.l), verticalArrangement = Arrangement.spacedBy(EchoSpacing.xs)) {
            Box(
                Modifier.size(40.dp).clip(RoundedCornerShape(14.dp)).background(MaterialTheme.colorScheme.surface),
                contentAlignment = Alignment.Center,
            ) { Icon(painterResource(icon), null, Modifier.size(20.dp)) }
            Text(stringResource(title), style = MaterialTheme.typography.titleMediumEmphasized)
            Text(body, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
        }
    }
}

/** A tall tag card (Figma "Tag/HD"): 120 × 170 picture, the tag and its title count. */
@Composable
private fun TagCard(tag: HentaiTag, onClick: () -> Unit) {
    Column(Modifier.width(120.dp).clickable(onClick = onClick), verticalArrangement = Arrangement.spacedBy(EchoSpacing.xs)) {
        val shape = MaterialTheme.shapes.largeIncreased
        CoverImage(null, null, Modifier.fillMaxWidth().height(170.dp).border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape), shape = shape)
        Text(tag.name, style = MaterialTheme.typography.titleSmall)
        Text(titleCount(tag.count), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

// H.5 Seasons --------------------------------------------------------------------------------------------------------

class HentaiSeasonsViewModel(hentai: HentaiRepository) : ViewModel() {
    val seasons: StateFlow<Load<List<Shelf<HentaiTitle>>>> =
        hentai.seasons().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), Load.Loading)
}

@Composable
fun HentaiSeasonsRoute(shell: ShellActions, source: Source, contentPadding: PaddingValues) {
    // Try again builds a fresh ViewModel, which loads again.
    var attempt by rememberSaveable { mutableIntStateOf(0) }
    val vm = echoViewModel(key = "seasons-$attempt") { HentaiSeasonsViewModel(it.hentai) }
    val seasons by vm.seasons.collectAsStateWithLifecycle()
    HentaiSeasonsScreen(
        onRetry = { attempt++ },
        seasons = seasons,
        header = { HentaiHeader(HentaiTab.SEASONS, shell, source) },
        contentPadding = contentPadding,
        onSeason = { shell.open(Route.HentaiTitles(season = it)) },
        onTitle = { shell.open(Route.HentaiTitle(it)) },
    )
}

/** Figma H.5 Seasons (28:5451): a year chip row, then one shelf per season of that year. */
@Composable
fun HentaiSeasonsScreen(
    seasons: Load<List<Shelf<HentaiTitle>>>,
    header: @Composable () -> Unit,
    contentPadding: PaddingValues,
    onSeason: (String) -> Unit,
    onTitle: (String) -> Unit,
    onRetry: () -> Unit = {},
) {
    Column(Modifier.fillMaxSize().testTag("screen:H.5")) {
        header()
        if (seasons !is Load.Content) {
            LoadFallback(seasons, onRetry = onRetry)
            return@Column
        }
        val years = seasons.value.map { it.title.substringAfterLast(' ') }.distinct()
        var year by rememberSaveable { mutableStateOf(years.firstOrNull().orEmpty()) }
        ChipRow(
            chips = years.map { ChipSpec(it) }, onClick = { year = years[it] }, selected = setOf(years.indexOf(year)),
            modifier = Modifier.padding(vertical = EchoSpacing.xs),
        )
        LazyColumn(
            Modifier.weight(1f),
            contentPadding = PaddingValues(bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l),
            verticalArrangement = Arrangement.spacedBy(EchoSpacing.s),
        ) {
            items(seasons.value.filter { it.title.endsWith(year) }, key = { it.title }) { shelf ->
                Column {
                    ShelfHeader(stringResource(R.string.hentai_season_shelf, shelf.title, titleCount(shelf.items.size)), onClick = { onSeason(shelf.title) })
                    CoverRow(shelf.items.size) { i -> TitleCard(shelf.items[i], { onTitle(shelf.items[i].id) }) }
                }
            }
        }
    }
}

// Previews -----------------------------------------------------------------------------------------------------------

@EchoScreenPreviews
@Composable
private fun HentaiBrowseScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        HentaiBrowseScreen(
            state = HentaiBrowseUiState(FakeCatalog.hentaiTitles, FakeCatalog.hentaiTags, FakeCatalog.hentaiStudioTags, Load.Content(Unit)),
            header = { HentaiHeader(HentaiTab.BROWSE, "Hentai", EchoIcons.PlayArrow, "P", {}, {}, {}, {}) },
            contentPadding = PaddingValues(), onTrending = {}, onSeasons = {}, onRandom = {}, onAll = {}, onTag = {}, onStudio = {},
        )
    }
}
