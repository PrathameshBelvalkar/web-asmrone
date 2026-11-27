package app.echo.android.feature.jav

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyGridScope
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import app.echo.android.R
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.data.model.Movie
import app.echo.data.model.NewsCategory
import app.echo.data.model.Source
import app.echo.designsystem.component.echo.MovieCard
import app.echo.designsystem.component.m3e.EchoSearchAppBar
import app.echo.designsystem.component.m3e.SectionTabs
import app.echo.designsystem.tokens.EchoSpacing

/** The JAV section tabs (Figma 3.1 · 3.3 · 3.4 · 3.8 · 3.10). */
enum class JavTab(@StringRes val label: Int, val route: Route) {
    NEWS(R.string.jav_tab_news, Route.News),
    LATEST(R.string.jav_tab_latest, Route.Latest),
    MOVIES(R.string.jav_tab_movies, Route.Movies),
    IDOLS(R.string.jav_tab_idols, Route.Idols()),
    GENRES(R.string.jav_tab_genres, Route.Genres),
}

/**
 * Moves between the JAV tabs without piling them up: News is the section's Home, so it's returned to; any other tab
 * replaces the current one (or opens over News).
 */
fun ShellActions.openJavTab(from: JavTab, to: JavTab) {
    when {
        to == from -> Unit
        to == JavTab.NEWS -> returnTo(Route.News)
        from == JavTab.NEWS -> open(to.route)
        else -> replace(to.route)
    }
}

/** The top of every JAV tab: the search app bar (source pill, Search → 3.11, avatar) and the section tabs. */
@Composable
fun JavHeader(tab: JavTab, shell: ShellActions, source: Source) = JavHeader(
    tab = tab,
    sourceName = source.name,
    sectionIcon = shell.sectionIcon(source.section),
    profileInitial = shell.profileInitial,
    onSearch = { shell.open(Route.JavSearch) },
    onSwitchSource = shell::openSourceSwitcher,
    onProfile = shell::openProfile,
    onTab = { shell.openJavTab(tab, it) },
)

@Composable
fun JavHeader(
    tab: JavTab,
    sourceName: String,
    sectionIcon: Int,
    profileInitial: String,
    onSearch: () -> Unit,
    onSwitchSource: () -> Unit,
    onProfile: () -> Unit,
    onTab: (JavTab) -> Unit,
) = Column {
    EchoSearchAppBar(
        source = sourceName, sectionIcon = sectionIcon, profileInitial = profileInitial,
        onSearch = onSearch, onSwitchSource = onSwitchSource, onProfile = onProfile,
    )
    SectionTabs(
        tabs = JavTab.entries.map { stringResource(it.label) },
        selected = tab.ordinal,
        onSelect = { onTab(JavTab.entries[it]) },
    )
}

@StringRes
fun NewsCategory.label(): Int = when (this) {
    NewsCategory.RELEASES -> R.string.jav_news_releases
    NewsCategory.INDUSTRY -> R.string.jav_news_industry
    NewsCategory.INTERVIEWS -> R.string.jav_news_interviews
    NewsCategory.RANKINGS -> R.string.jav_news_rankings
}

/** "2026-12-03" → "Dec 3". */
fun shortDate(date: String): String = runCatching {
    val d = java.time.LocalDate.parse(date)
    "${d.month.getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.ENGLISH)} ${d.dayOfMonth}"
}.getOrDefault(date)

/** "42:07", or "1:02:07" past an hour. */
fun clock(ms: Long): String {
    val total = ms / 1000
    val h = total / 3600
    val m = total % 3600 / 60
    val s = total % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}

/** A movie card's meta line: the date, or "Releases Dec 3" for an upcoming one. */
@Composable
fun Movie.cardMeta(): String = if (upcoming) stringResource(R.string.jav_releases_on, shortDate(releaseDate)) else releaseDate

/** Movies as grid items (2 columns, Figma 3.3–3.5, 3.9). */
fun LazyGridScope.movieItems(movies: List<Movie>, onMovie: (String) -> Unit) {
    items(movies, key = { it.id }) { movie ->
        MovieCard(movie.code, movie.title, movie.cardMeta(), movie.coverUrl, onClick = { onMovie(movie.id) })
    }
}

/** A full-width item in a grid (headers, filters, states). */
fun LazyGridScope.fullWidth(key: Any? = null, content: @Composable () -> Unit) =
    item(key = key, span = { GridItemSpan(maxLineSpan) }) { content() }

/** The grid's padding: screen margins, room for the shell at the bottom. */
fun gridPadding(contentPadding: PaddingValues) = PaddingValues(
    start = EchoSpacing.screenMargin,
    end = EchoSpacing.screenMargin,
    top = EchoSpacing.s,
    bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l,
)

/** "1 movie", "1,284 movies". */
@Composable
fun movieCount(count: Int): String =
    androidx.compose.ui.res.pluralStringResource(R.plurals.jav_movies, count, app.echo.android.feature.manga.formatCount(count))
