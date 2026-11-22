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
import app.echo.android.feature.manga.artists.MangaArtistsRoute
import app.echo.android.feature.manga.browse.MangaBrowseRoute
import app.echo.android.feature.manga.end.MangaEndRoute
import app.echo.android.feature.manga.gallery.MangaGalleryRoute
import app.echo.android.feature.manga.reader.MangaReaderRoute
import app.echo.android.feature.manga.search.MangaSearchRoute
import app.echo.android.feature.manga.tags.MangaTagsRoute
import app.echo.android.feature.manga.taglist.MangaTagListRoute
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
    // Manga (2.1–2.11). The reader is immersive: no content padding.
    composable<Route.MangaBrowse> { MangaBrowseRoute(shell, source.value, contentPadding) }
    composable<Route.MangaSearch> { MangaSearchRoute(shell, source.value, contentPadding) }
    composable<Route.Tags> { MangaTagsRoute(shell, source.value, contentPadding) }
    composable<Route.TagList> { entry -> MangaTagListRoute(entry.toRoute<Route.TagList>().tagId, shell, contentPadding) }
    composable<Route.Gallery> { entry -> MangaGalleryRoute(entry.toRoute<Route.Gallery>().id, shell, contentPadding) }
    composable<Route.Reader> { entry ->
        val reader = entry.toRoute<Route.Reader>()
        MangaReaderRoute(reader.galleryId, reader.page, reader.showPages, shell)
    }
    composable<Route.EndOfGallery> { entry -> MangaEndRoute(entry.toRoute<Route.EndOfGallery>().galleryId, shell) }
    composable<Route.MangaArtists> { MangaArtistsRoute(shell, source.value, contentPadding) }
    return setOf(
        Route.Playlists::class, Route.Playlist::class,
        Route.AsmrHome::class, Route.AsmrSearch::class, Route.AsmrResults::class,
        Route.AsmrFeed::class, Route.Work::class, Route.Artist::class,
        Route.Library::class, Route.History::class, Route.NotFound::class,
        Route.MangaBrowse::class, Route.MangaSearch::class, Route.Tags::class, Route.TagList::class, Route.Gallery::class,
        Route.Reader::class, Route.EndOfGallery::class, Route.MangaArtists::class,
    )
}
