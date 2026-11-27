package app.echo.android.feature.hentai

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import app.echo.android.R
import app.echo.android.feature.manga.formatCount
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.data.model.HentaiTagCategory
import app.echo.data.model.HentaiTitle
import app.echo.data.model.Source
import app.echo.designsystem.component.echo.HanimeCard
import app.echo.designsystem.component.m3e.EchoSearchAppBar
import app.echo.designsystem.component.m3e.SectionTabs
import app.echo.designsystem.tokens.EchoSpacing
import java.util.Locale

/** The Hentai section tabs (Figma H.1 · H.2 · H.3 · H.5). */
enum class HentaiTab(@StringRes val label: Int, val route: Route) {
    HOME(R.string.hentai_tab_home, Route.HentaiHome),
    BROWSE(R.string.hentai_tab_browse, Route.HentaiBrowse),
    TITLES(R.string.hentai_tab_titles, Route.HentaiTitles()),
    SEASONS(R.string.hentai_tab_seasons, Route.Seasons),
}

/** Moves between the tabs without piling them up: Home is returned to, the others swap in place (as in JAV). */
fun ShellActions.openHentaiTab(from: HentaiTab, to: HentaiTab) {
    when {
        to == from -> Unit
        to == HentaiTab.HOME -> returnTo(Route.HentaiHome)
        from == HentaiTab.HOME -> open(to.route)
        else -> replace(to.route)
    }
}

/** The top of every Hentai tab: the search app bar (→ H.6) and the section tabs. */
@Composable
fun HentaiHeader(tab: HentaiTab, shell: ShellActions, source: Source) = HentaiHeader(
    tab = tab,
    sourceName = source.name,
    sectionIcon = shell.sectionIcon(source.section),
    profileInitial = shell.profileInitial,
    onSearch = { shell.open(Route.HentaiSearch) },
    onSwitchSource = shell::openSourceSwitcher,
    onProfile = shell::openProfile,
    onTab = { shell.openHentaiTab(tab, it) },
)

@Composable
fun HentaiHeader(
    tab: HentaiTab,
    sourceName: String,
    sectionIcon: Int,
    profileInitial: String,
    onSearch: () -> Unit,
    onSwitchSource: () -> Unit,
    onProfile: () -> Unit,
    onTab: (HentaiTab) -> Unit,
) = Column {
    EchoSearchAppBar(
        source = sourceName, sectionIcon = sectionIcon, profileInitial = profileInitial,
        onSearch = onSearch, onSwitchSource = onSwitchSource, onProfile = onProfile,
    )
    SectionTabs(
        tabs = HentaiTab.entries.map { stringResource(it.label) },
        selected = tab.ordinal,
        onSelect = { onTab(HentaiTab.entries[it]) },
    )
}

/** "1 title", "2,322 titles". */
@Composable
fun titleCount(count: Int): String = pluralStringResource(R.plurals.hentai_titles, count, formatCount(count))

/** "1.6M", "41K", "950". */
fun compactCount(value: Long): String = when {
    value >= 1_000_000 -> String.format(Locale.ROOT, "%.1fM", value / 1_000_000.0)
    value >= 1_000 -> "${value / 1_000}K"
    else -> value.toString()
}

@StringRes
fun HentaiTagCategory.label(): Int = when (this) {
    HentaiTagCategory.FORMAT -> R.string.hentai_cat_format
    HentaiTagCategory.STORY -> R.string.hentai_cat_story
    HentaiTagCategory.CHARACTERS -> R.string.hentai_cat_characters
    HentaiTagCategory.PAIRING -> R.string.hentai_cat_pairing
    HentaiTagCategory.OTHER -> R.string.hentai_cat_other
}

/** A title card (Figma "Echo · HanimeCard"): 2:3 cover, NEW, views; "Studio Name · 2025" under the title. */
@Composable
fun TitleCard(title: HentaiTitle, onClick: () -> Unit, modifier: Modifier = Modifier, width: androidx.compose.ui.unit.Dp? = HANIME_WIDTH) =
    HanimeCard(
        title.title, "${title.studio} · ${title.year}", title.coverUrl, onClick, modifier,
        views = compactCount(title.views), isNew = title.isNew, width = width,
    )

/** Figma's shelf cards are 112 dp wide. */
val HANIME_WIDTH = androidx.compose.ui.unit.Dp(112f)

/** Titles three to a row with the screen margins (H.3 grid, H.7 Similar), for a LazyColumn. */
@Composable
fun TitleRow(row: List<HentaiTitle>, onTitle: (String) -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin).padding(bottom = EchoSpacing.l),
        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.m),
    ) {
        row.forEach { t -> TitleCard(t, { onTitle(t.id) }, Modifier.weight(1f), width = null) }
        repeat(GRID_COLUMNS - row.size) { Spacer(Modifier.weight(1f)) }
    }
}

const val GRID_COLUMNS = 3
