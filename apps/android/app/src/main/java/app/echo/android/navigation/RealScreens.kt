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
import app.echo.android.feature.jav.genres.JavGenresRoute
import app.echo.android.feature.jav.idols.JavIdolRoute
import app.echo.android.feature.jav.idols.JavIdolsRoute
import app.echo.android.feature.jav.library.JavLibraryRoute
import app.echo.android.feature.jav.movie.JavMovieRoute
import app.echo.android.feature.jav.movies.JavLatestRoute
import app.echo.android.feature.jav.movies.JavMovieListRoute
import app.echo.android.feature.jav.movies.JavMoviesRoute
import app.echo.android.feature.jav.news.JavNewsPostRoute
import app.echo.android.feature.jav.news.JavNewsRoute
import app.echo.android.feature.jav.search.JavSearchRoute
import app.echo.android.feature.jav.theater.JavTheaterRoute
import app.echo.android.feature.manga.artists.MangaArtistsRoute
import app.echo.android.feature.manga.browse.MangaBrowseRoute
import app.echo.android.feature.manga.end.MangaEndRoute
import app.echo.android.feature.manga.gallery.MangaGalleryRoute
import app.echo.android.feature.manga.reader.MangaReaderRoute
import app.echo.android.feature.manga.search.MangaSearchRoute
import app.echo.android.feature.manga.tags.MangaTagsRoute
import app.echo.android.feature.manga.taglist.MangaTagListRoute
import app.echo.android.feature.onboarding.AgeRoute
import app.echo.android.feature.onboarding.ChooseSourcesRoute
import app.echo.android.feature.onboarding.MakeItYoursRoute
import app.echo.android.feature.onboarding.SplashRoute
import app.echo.android.feature.onboarding.WelcomeRoute
import app.echo.android.feature.onboarding.YourProfileRoute
import app.echo.android.feature.settings.AboutRoute
import app.echo.android.feature.settings.AiSubtitlesRoute
import app.echo.android.feature.settings.AsmrPreferencesRoute
import app.echo.android.feature.settings.EditProfileRoute
import app.echo.android.feature.settings.JavSettingsRoute
import app.echo.android.feature.settings.LookAndFeelRoute
import app.echo.android.feature.settings.PlaybackRoute
import app.echo.android.feature.settings.ReaderDefaultsRoute
import app.echo.android.feature.settings.SettingsRoute
import app.echo.android.feature.settings.StorageRoute
import app.echo.android.feature.settings.UpdatesRoute
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
    // JAV (3.1–3.12). The theater is immersive and landscape: no content padding.
    composable<Route.News> { JavNewsRoute(shell, source.value, contentPadding) }
    composable<Route.NewsPost> { entry -> JavNewsPostRoute(entry.toRoute<Route.NewsPost>().id, shell, contentPadding) }
    composable<Route.Latest> { JavLatestRoute(shell, source.value, contentPadding) }
    composable<Route.Movies> { JavMoviesRoute(shell, source.value, contentPadding) }
    composable<Route.MovieList> { entry -> JavMovieListRoute(entry.toRoute<Route.MovieList>().filter, shell, contentPadding) }
    composable<Route.Movie> { entry -> JavMovieRoute(entry.toRoute<Route.Movie>().id, shell, contentPadding) }
    composable<Route.JavTheater> { entry ->
        val theater = entry.toRoute<Route.JavTheater>()
        JavTheaterRoute(theater.movieId, theater.fromStart, shell)
    }
    composable<Route.Idols> { entry -> JavIdolsRoute(entry.toRoute<Route.Idols>().agency, shell, source.value, contentPadding) }
    composable<Route.Idol> { entry -> JavIdolRoute(entry.toRoute<Route.Idol>().id, shell, contentPadding) }
    composable<Route.Genres> { JavGenresRoute(shell, source.value, contentPadding) }
    composable<Route.JavSearch> { JavSearchRoute(shell, contentPadding) }
    composable<Route.JavLibrary> { JavLibraryRoute(shell, contentPadding) }
    // Settings and profile (S.1–S.13; P.1, S.14 and S.15 are sheets in the shell).
    composable<Route.Settings> { SettingsRoute(shell) }
    composable<Route.Preferences> { AsmrPreferencesRoute(shell) }
    composable<Route.AiSubtitles> { AiSubtitlesRoute(shell) }
    composable<Route.JavSettings> { JavSettingsRoute(shell) }
    composable<Route.Storage> { StorageRoute(shell, onClearAll = shell::clearAllData) }
    composable<Route.LookAndFeel> { LookAndFeelRoute(shell) }
    composable<Route.Playback> { PlaybackRoute(shell) }
    composable<Route.ReaderDefaults> { ReaderDefaultsRoute(shell) }
    composable<Route.About> { AboutRoute(shell) }
    composable<Route.EditProfile> { EditProfileRoute(shell, onReset = shell::resetProfile) }
    composable<Route.Updates> { UpdatesRoute(shell) }
    // Onboarding (O.1–O.8; O.9 comes after the JAV and Hentai sections).
    composable<Route.Splash> { SplashRoute(shell) }
    composable<Route.Welcome> { entry -> WelcomeRoute(entry.toRoute<Route.Welcome>().page, shell) }
    composable<Route.ChooseSources> { ChooseSourcesRoute(shell) }
    composable<Route.YourProfile> { YourProfileRoute(shell) }
    composable<Route.Age> { AgeRoute(shell) }
    composable<Route.MakeItYours> { MakeItYoursRoute(shell) }
    return setOf(
        Route.Playlists::class, Route.Playlist::class,
        Route.AsmrHome::class, Route.AsmrSearch::class, Route.AsmrResults::class,
        Route.AsmrFeed::class, Route.Work::class, Route.Artist::class,
        Route.Library::class, Route.History::class, Route.NotFound::class,
        Route.MangaBrowse::class, Route.MangaSearch::class, Route.Tags::class, Route.TagList::class, Route.Gallery::class,
        Route.Reader::class, Route.EndOfGallery::class, Route.MangaArtists::class,
        Route.Settings::class, Route.Preferences::class, Route.AiSubtitles::class, Route.JavSettings::class,
        Route.Storage::class, Route.LookAndFeel::class, Route.Playback::class, Route.ReaderDefaults::class,
        Route.About::class, Route.EditProfile::class, Route.Updates::class,
        Route.News::class, Route.NewsPost::class, Route.Latest::class, Route.Movies::class, Route.MovieList::class,
        Route.Movie::class, Route.JavTheater::class, Route.Idols::class, Route.Idol::class, Route.Genres::class,
        Route.JavSearch::class, Route.JavLibrary::class,
        Route.Splash::class, Route.Welcome::class, Route.ChooseSources::class, Route.YourProfile::class,
        Route.Age::class, Route.MakeItYours::class,
    )
}
