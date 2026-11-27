package app.echo.android.navigation

import androidx.navigation.NavDestination
import androidx.navigation.NavDestination.Companion.hasRoute
import kotlin.reflect.KClass

/** What the shell shows around a screen (design.md §10.1). */
enum class Chrome {
    /** Section screens, 0.2, 0.3: floating navigation bar + mini player. */
    SECTION,

    /** Settings, 0.4, H.10: neither. */
    PLAIN,

    /** Reader, theaters, onboarding: neither, and system bars hidden where Figma hides them. */
    IMMERSIVE,
}

/**
 * A Figma frame as a route: its code ("1.5"), name, chrome, and the example routes its placeholder links to (the
 * Figma prototype targets). Placeholders use [links] until each screen is built.
 */
data class ScreenSpec(
    val code: String,
    val name: String,
    val routeClass: KClass<out Route>,
    val sample: Route,
    val chrome: Chrome,
    val links: List<Route> = emptyList(),
    val hidesSystemBars: Boolean = false,
)

/** The registry of every routed frame, in Figma order. */
object ScreenSpecs {
    private fun s(code: String, name: String, sample: Route, chrome: Chrome, vararg links: Route, hideBars: Boolean = false) =
        ScreenSpec(code, name, sample::class, sample, chrome, links.toList(), hideBars)

    private val S = Chrome.SECTION
    private val P = Chrome.PLAIN
    private val I = Chrome.IMMERSIVE

    val all: List<ScreenSpec> = listOf(
        // Shared
        s("0.2", "Library", Route.Library, S, Route.History, Route.Playlists, Route.Work("w1"), Route.Gallery("g1"), Route.Movie("m1")),
        s("0.3", "History", Route.History, S, Route.Gallery("g1"), Route.Reader("g1", 34)),
        s("0.4", "Not found & empty", Route.NotFound, P),
        // ASMR
        s("1.1", "Home", Route.AsmrHome, S, Route.Work("w1"), Route.AsmrFeed(1), Route.History),
        s("1.2", "Search", Route.AsmrSearch, S, Route.AsmrResults("rain")),
        s("1.3", "Search results", Route.AsmrResults("rain"), S, Route.Work("w2"), Route.Artist("a1")),
        s("1.4", "Feed", Route.AsmrFeed(1), S, Route.Work("w3")),
        s("1.5", "Work", Route.Work("w1"), S, Route.Artist("a1"), Route.Playlists),
        s("1.6", "Artist", Route.Artist("a1"), S, Route.Work("w1")),
        s("1.7", "Playlist", Route.Playlist(1), S, Route.Work("w1")),
        s("1.12", "Playlists", Route.Playlists, S, Route.Playlist(1)),
        // Manga
        s("2.1", "Browse", Route.MangaBrowse, S, Route.Gallery("g1"), Route.Tags, Route.MangaArtists, Route.History),
        s("2.2", "Search", Route.MangaSearch, S, Route.Gallery("g2")),
        s("2.3", "Tags index", Route.Tags, S, Route.TagList("tag-A1")),
        s("2.4", "Tag list", Route.TagList("tag-A1"), S, Route.Gallery("g3")),
        s("2.5", "Gallery", Route.Gallery("g1"), S, Route.Reader("g1", 34), Route.TagList("tag-A1"), Route.MangaArtists),
        s("2.6", "Reader", Route.Reader("g1", 34), I, Route.EndOfGallery("g1")),
        s("2.10", "End of gallery", Route.EndOfGallery("g1"), I, Route.Gallery("g2"), Route.Reader("g1", 1)),
        s("2.11", "Artists index", Route.MangaArtists, S, Route.TagList("artist-A1")),
        // JAV
        s("3.1", "News", Route.News, S, Route.NewsPost("n1"), Route.Latest, Route.Movies, Route.Idols(), Route.Genres),
        s("3.2", "News post", Route.NewsPost("n1"), S, Route.Movie("m1")),
        s("3.3", "Latest", Route.Latest, S, Route.Movie("m2")),
        s("3.4", "Movies", Route.Movies, S, Route.MovieList("all"), Route.Movie("m3")),
        s("3.5", "Movie list", Route.MovieList("all"), S, Route.Movie("m4")),
        s("3.6", "Movie page", Route.Movie("m1"), S, Route.JavTheater("m1"), Route.Idol("i1"), Route.MovieList("genre-0")),
        s("3.7", "Theater (landscape)", Route.JavTheater("m1"), I, hideBars = true),
        s("3.8", "Idols", Route.Idols(), S, Route.Idol("i1")),
        s("3.9", "Idol page", Route.Idol("i1"), S, Route.Movie("m1")),
        s("3.10", "Genres", Route.Genres, S, Route.MovieList("genre-0")),
        s("3.11", "Search", Route.JavSearch, S, Route.Movie("m5")),
        s("3.12", "Library", Route.JavLibrary, S, Route.Movie("m1"), Route.JavTheater("m1")),
        // Hentai
        s("H.1", "Home", Route.HentaiHome, S, Route.HentaiTitle("h1"), Route.HentaiBrowse, Route.HentaiTitles, Route.Seasons),
        s("H.2", "Browse", Route.HentaiBrowse, S, Route.HentaiTitles, Route.HentaiTitle("h2")),
        s("H.3", "All titles", Route.HentaiTitles, S, Route.HentaiTitle("h3")),
        s("H.5", "Seasons", Route.Seasons, S, Route.HentaiTitle("h4")),
        s("H.6", "Search", Route.HentaiSearch, S, Route.HentaiTitle("h5")),
        s("H.7", "Title page", Route.HentaiTitle("h1"), S, Route.HentaiTheater("h1", 1), Route.TitleState("unavailable")),
        s("H.9", "Library", Route.HentaiLibrary, S, Route.HentaiTitle("h1"), Route.HentaiTheater("h1", 1)),
        s("H.10", "Title states", Route.TitleState("unavailable"), P),
        s("H.11", "Theater (landscape)", Route.HentaiTheater("h1", 1), I, hideBars = true),
        // Settings (P.1 is a sheet in the shell)
        s("S.1", "Settings", Route.Settings, P,
            Route.Preferences, Route.AiSubtitles, Route.JavSettings, Route.Storage, Route.LookAndFeel,
            Route.Playback, Route.ReaderDefaults, Route.About, Route.EditProfile, Route.Updates),
        s("S.2", "Preferences", Route.Preferences, P),
        s("S.4", "AI subtitles", Route.AiSubtitles, P),
        s("S.5", "JAV", Route.JavSettings, P),
        s("S.6", "Storage", Route.Storage, P),
        s("S.8", "Look and feel", Route.LookAndFeel, P),
        s("S.9", "Playback", Route.Playback, P),
        s("S.10", "Reader", Route.ReaderDefaults, P),
        s("S.11", "About", Route.About, P, Route.Updates),
        s("S.12", "Profile", Route.EditProfile, P),
        s("S.13", "App updates", Route.Updates, P),
        // Onboarding
        s("O.1", "Splash", Route.Splash, I, Route.Welcome(0)),
        s("O.2", "Welcome · one app", Route.Welcome(0), I, Route.Welcome(1)),
        s("O.3", "Welcome · switch sources", Route.Welcome(1), I, Route.Welcome(2)),
        s("O.4", "Welcome · pick up", Route.Welcome(2), I, Route.ChooseSources),
        s("O.5", "Choose sources", Route.ChooseSources, I, Route.YourProfile),
        s("O.6", "Your profile", Route.YourProfile, I, Route.Age),
        s("O.7", "Age", Route.Age, I, Route.MakeItYours),
        s("O.8", "Make it yours", Route.MakeItYours, I),
    )

    /** The spec of a route instance ("Welcome" has one frame per page). */
    fun of(route: Route): ScreenSpec =
        all.firstOrNull { it.sample == route } ?: all.first { it.routeClass == route::class }

    /** The spec of the screen at [destination], or null while the graph isn't ready. */
    fun of(destination: NavDestination?): ScreenSpec? =
        destination?.let { d -> all.firstOrNull { d.hasRoute(it.routeClass) } }
}
