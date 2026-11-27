package app.echo.android.navigation

import app.echo.designsystem.component.echo.LocalNavAnimatedScope
import androidx.navigation.NavBackStackEntry
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Composable
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
import app.echo.android.feature.hentai.browse.HentaiBrowseRoute
import app.echo.android.feature.hentai.browse.HentaiSeasonsRoute
import app.echo.android.feature.hentai.home.HentaiHomeRoute
import app.echo.android.feature.hentai.library.HentaiLibraryRoute
import app.echo.android.feature.hentai.search.HentaiSearchRoute
import app.echo.android.feature.hentai.theater.HentaiTheaterRoute
import app.echo.android.feature.hentai.title.HentaiTitleRoute
import app.echo.android.feature.hentai.title.TitleStateRoute
import app.echo.android.feature.hentai.titles.HentaiTitlesRoute
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
 * A destination that hands its enter / exit animation to the screen ([LocalNavAnimatedScope]), so covers can share
 * elements across the navigation (Phase 12).
 */
internal inline fun <reified T : Any> NavGraphBuilder.screen(noinline content: @Composable (NavBackStackEntry) -> Unit) {
    composable<T> { entry -> CompositionLocalProvider(LocalNavAnimatedScope provides this) { content(entry) } }
}

/**
 * Registers the screens that are built, and returns their route classes so [EchoNavHost] skips their placeholders.
 * Grows phase by phase.
 */
internal fun NavGraphBuilder.realScreens(
    shell: ShellActions,
    source: State<Source>,
    contentPadding: PaddingValues,
): Set<KClass<out Route>> {
    screen<Route.AsmrHome> { AsmrHomeRoute(shell, source.value, contentPadding) }
    screen<Route.AsmrSearch> { AsmrSearchRoute(shell, contentPadding) }
    screen<Route.AsmrResults> { entry ->
        val s = source.value
        AsmrResultsRoute(entry.toRoute<Route.AsmrResults>().query, shell, s.name, shell.sectionIcon(s.section), contentPadding)
    }
    screen<Route.AsmrFeed> { entry -> AsmrFeedRoute(entry.toRoute<Route.AsmrFeed>().tab, shell, source.value.name, contentPadding) }
    screen<Route.Work> { entry -> AsmrWorkRoute(entry.toRoute<Route.Work>().id, shell, contentPadding) }
    screen<Route.Artist> { entry -> AsmrArtistRoute(entry.toRoute<Route.Artist>().id, shell, contentPadding) }
    screen<Route.Playlists> { AsmrPlaylistsRoute(shell, contentPadding) }
    screen<Route.Playlist> { entry -> AsmrPlaylistRoute(entry.toRoute<Route.Playlist>().id, shell, contentPadding) }
    screen<Route.Library> { SharedLibraryRoute(shell, contentPadding) }
    screen<Route.History> { SharedHistoryRoute(shell, contentPadding) }
    screen<Route.NotFound> { SharedStatesRoute(shell, source.value, contentPadding) }
    // Manga (2.1–2.11). The reader is immersive: no content padding.
    screen<Route.MangaBrowse> { MangaBrowseRoute(shell, source.value, contentPadding) }
    screen<Route.MangaSearch> { MangaSearchRoute(shell, source.value, contentPadding) }
    screen<Route.Tags> { MangaTagsRoute(shell, source.value, contentPadding) }
    screen<Route.TagList> { entry -> MangaTagListRoute(entry.toRoute<Route.TagList>().tagId, shell, contentPadding) }
    screen<Route.Gallery> { entry -> MangaGalleryRoute(entry.toRoute<Route.Gallery>().id, shell, contentPadding) }
    screen<Route.Reader> { entry ->
        val reader = entry.toRoute<Route.Reader>()
        MangaReaderRoute(reader.galleryId, reader.page, reader.showPages, shell)
    }
    screen<Route.EndOfGallery> { entry -> MangaEndRoute(entry.toRoute<Route.EndOfGallery>().galleryId, shell) }
    screen<Route.MangaArtists> { MangaArtistsRoute(shell, source.value, contentPadding) }
    // JAV (3.1–3.12). The theater is immersive and landscape: no content padding.
    screen<Route.News> { JavNewsRoute(shell, source.value, contentPadding) }
    screen<Route.NewsPost> { entry -> JavNewsPostRoute(entry.toRoute<Route.NewsPost>().id, shell, contentPadding) }
    screen<Route.Latest> { JavLatestRoute(shell, source.value, contentPadding) }
    screen<Route.Movies> { JavMoviesRoute(shell, source.value, contentPadding) }
    screen<Route.MovieList> { entry -> JavMovieListRoute(entry.toRoute<Route.MovieList>().filter, shell, contentPadding) }
    screen<Route.Movie> { entry -> JavMovieRoute(entry.toRoute<Route.Movie>().id, shell, contentPadding) }
    screen<Route.JavTheater> { entry ->
        val theater = entry.toRoute<Route.JavTheater>()
        JavTheaterRoute(theater.movieId, theater.fromStart, shell)
    }
    screen<Route.Idols> { entry -> JavIdolsRoute(entry.toRoute<Route.Idols>().agency, shell, source.value, contentPadding) }
    screen<Route.Idol> { entry -> JavIdolRoute(entry.toRoute<Route.Idol>().id, shell, contentPadding) }
    screen<Route.Genres> { JavGenresRoute(shell, source.value, contentPadding) }
    screen<Route.JavSearch> { JavSearchRoute(shell, contentPadding) }
    screen<Route.JavLibrary> { JavLibraryRoute(shell, contentPadding) }
    // Hentai (H.1–H.11; H.4 and H.8 are a sheet and a dialog). The theater is immersive: no content padding.
    screen<Route.HentaiHome> { HentaiHomeRoute(shell, source.value, contentPadding) }
    screen<Route.HentaiBrowse> { HentaiBrowseRoute(shell, source.value, contentPadding) }
    screen<Route.HentaiTitles> { entry -> HentaiTitlesRoute(entry.toRoute<Route.HentaiTitles>(), shell, source.value, contentPadding) }
    screen<Route.Seasons> { HentaiSeasonsRoute(shell, source.value, contentPadding) }
    screen<Route.HentaiSearch> { HentaiSearchRoute(shell, contentPadding) }
    screen<Route.HentaiTitle> { entry -> HentaiTitleRoute(entry.toRoute<Route.HentaiTitle>().id, shell, contentPadding) }
    screen<Route.HentaiLibrary> { HentaiLibraryRoute(shell, contentPadding) }
    screen<Route.TitleState> { entry -> TitleStateRoute(entry.toRoute<Route.TitleState>().kind, shell) }
    screen<Route.HentaiTheater> { entry ->
        val theater = entry.toRoute<Route.HentaiTheater>()
        HentaiTheaterRoute(theater.titleId, theater.episode, shell)
    }
    // Settings and profile (S.1–S.13; P.1, S.14 and S.15 are sheets in the shell).
    screen<Route.Settings> { SettingsRoute(shell) }
    screen<Route.Preferences> { AsmrPreferencesRoute(shell) }
    screen<Route.AiSubtitles> { AiSubtitlesRoute(shell) }
    screen<Route.JavSettings> { JavSettingsRoute(shell) }
    screen<Route.Storage> { StorageRoute(shell, onClearAll = shell::clearAllData) }
    screen<Route.LookAndFeel> { LookAndFeelRoute(shell) }
    screen<Route.Playback> { PlaybackRoute(shell) }
    screen<Route.ReaderDefaults> { ReaderDefaultsRoute(shell) }
    screen<Route.About> { AboutRoute(shell) }
    screen<Route.EditProfile> { EditProfileRoute(shell, onReset = shell::resetProfile) }
    screen<Route.Updates> { UpdatesRoute(shell) }
    // Onboarding (O.1–O.8; O.9 comes after the JAV and Hentai sections).
    screen<Route.Splash> { SplashRoute(shell) }
    screen<Route.Welcome> { entry -> WelcomeRoute(entry.toRoute<Route.Welcome>().page, shell) }
    screen<Route.ChooseSources> { ChooseSourcesRoute(shell) }
    screen<Route.YourProfile> { YourProfileRoute(shell) }
    screen<Route.Age> { AgeRoute(shell) }
    screen<Route.MakeItYours> { MakeItYoursRoute(shell) }
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
        Route.HentaiHome::class, Route.HentaiBrowse::class, Route.HentaiTitles::class, Route.Seasons::class,
        Route.HentaiSearch::class, Route.HentaiTitle::class, Route.HentaiLibrary::class, Route.TitleState::class,
        Route.HentaiTheater::class,
        Route.Splash::class, Route.Welcome::class, Route.ChooseSources::class, Route.YourProfile::class,
        Route.Age::class, Route.MakeItYours::class,
    )
}
