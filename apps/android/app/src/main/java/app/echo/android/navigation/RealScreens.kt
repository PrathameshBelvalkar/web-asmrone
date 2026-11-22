package app.echo.android.navigation

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.State
import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.composable
import androidx.navigation.toRoute
import app.echo.android.feature.asmr.artist.AsmrArtistRoute
import app.echo.android.feature.asmr.feed.AsmrFeedRoute
import app.echo.android.feature.asmr.home.AsmrHomeRoute
import app.echo.android.feature.asmr.playlist.AsmrPlaylistRoute
import app.echo.android.feature.asmr.playlists.AsmrPlaylistsRoute
import app.echo.android.feature.asmr.work.AsmrWorkRoute
import app.echo.android.feature.asmr.results.AsmrResultsRoute
import app.echo.android.feature.asmr.search.AsmrSearchRoute
import app.echo.android.feature.shared.history.SharedHistoryRoute
import app.echo.android.feature.shared.library.SharedLibraryRoute
import app.echo.android.feature.shared.states.SharedStatesRoute
import app.echo.data.model.Source
import kotlin.reflect.KClass

/**
 * Registers the screens that are built, and returns their route classes so [EchoNavHost] skips their placeholders.
 * Grows phase by phase.
 */
internal fun NavGraphBuilder.realScreens(
    shell: ShellActions,
    source: State<Source>,
    contentPadding: PaddingValues,
): Set<KClass<out Route>> {
    composable<Route.AsmrHome> { AsmrHomeRoute(shell, source.value, contentPadding) }
    composable<Route.AsmrSearch> { AsmrSearchRoute(shell, contentPadding) }
    composable<Route.AsmrResults> { entry ->
        val s = source.value
        AsmrResultsRoute(entry.toRoute<Route.AsmrResults>().query, shell, s.name, shell.sectionIcon(s.section), contentPadding)
    }
    composable<Route.AsmrFeed> { entry -> AsmrFeedRoute(entry.toRoute<Route.AsmrFeed>().tab, shell, source.value.name, contentPadding) }
    composable<Route.Work> { entry -> AsmrWorkRoute(entry.toRoute<Route.Work>().id, shell, contentPadding) }
    composable<Route.Artist> { entry -> AsmrArtistRoute(entry.toRoute<Route.Artist>().id, shell, contentPadding) }
    composable<Route.Playlists> { AsmrPlaylistsRoute(shell, contentPadding) }
    composable<Route.Playlist> { entry -> AsmrPlaylistRoute(entry.toRoute<Route.Playlist>().id, shell, contentPadding) }
    composable<Route.Library> { SharedLibraryRoute(shell, contentPadding) }
    composable<Route.History> { SharedHistoryRoute(shell, contentPadding) }
    composable<Route.NotFound> { SharedStatesRoute(shell, source.value, contentPadding) }
    return setOf(
        Route.Playlists::class, Route.Playlist::class,
        Route.AsmrHome::class, Route.AsmrSearch::class, Route.AsmrResults::class,
        Route.AsmrFeed::class, Route.Work::class, Route.Artist::class,
        Route.Library::class, Route.History::class, Route.NotFound::class,
    )
}
