package app.echo.android.navigation

import kotlinx.serialization.Serializable

/**
 * Every screen of the phone app, one route per Figma frame (design.md §10.3). Frames that are overlays in Figma
 * (0.1, P.1, 1.9–1.11, 2.6/2.7 menus, 2.8, 2.9, 3.8 filters, H.4, H.8, S.3, S.7, S.14, S.15, O.9) are state on the
 * screen beneath, not routes.
 */
@Serializable
sealed interface Route {
    // Shared
    @Serializable data object Library : Route
    @Serializable data object History : Route
    @Serializable data object NotFound : Route

    // ASMR
    @Serializable data object AsmrHome : Route
    @Serializable data object AsmrSearch : Route
    @Serializable data class AsmrResults(val query: String) : Route
    /** 1.4 Feed: 1 Popular · 2 New · 3 Recommended (the 1.1 tabs). */
    @Serializable data class AsmrFeed(val tab: Int = 1) : Route
    @Serializable data class Work(val id: String) : Route
    @Serializable data class Artist(val id: String) : Route
    @Serializable data class Playlist(val id: Long) : Route
    @Serializable data object Playlists : Route

    // Manga
    @Serializable data object MangaBrowse : Route
    @Serializable data object MangaSearch : Route
    @Serializable data object Tags : Route
    @Serializable data class TagList(val tagId: String) : Route
    @Serializable data class Gallery(val id: String) : Route
    @Serializable data class Reader(val galleryId: String, val page: Int = 1, val showPages: Boolean = false) : Route
    @Serializable data class EndOfGallery(val galleryId: String) : Route
    @Serializable data object MangaArtists : Route

    // JAV
    @Serializable data object News : Route
    @Serializable data class NewsPost(val id: String) : Route
    @Serializable data object Latest : Route
    @Serializable data object Movies : Route
    @Serializable data class MovieList(val filter: String) : Route
    @Serializable data class Movie(val id: String) : Route
    @Serializable data class JavTheater(val movieId: String, val fromStart: Boolean = false) : Route
    /** 3.8; [agency] pre-sets the agency filter (3.9 "Agency A"). */
    @Serializable data class Idols(val agency: String? = null) : Route
    @Serializable data class Idol(val id: String) : Route
    @Serializable data object Genres : Route
    @Serializable data object JavSearch : Route
    @Serializable data object JavLibrary : Route

    // Hentai
    @Serializable data object HentaiHome : Route
    @Serializable data object HentaiBrowse : Route
    @Serializable data object HentaiTitles : Route
    @Serializable data object Seasons : Route
    @Serializable data object HentaiSearch : Route
    @Serializable data class HentaiTitle(val id: String) : Route
    @Serializable data object HentaiLibrary : Route
    @Serializable data class TitleState(val kind: String) : Route
    @Serializable data class HentaiTheater(val titleId: String, val episode: Int = 1) : Route

    // Settings
    @Serializable data object Settings : Route
    @Serializable data object Preferences : Route
    @Serializable data object AiSubtitles : Route
    @Serializable data object JavSettings : Route
    @Serializable data object Storage : Route
    @Serializable data object LookAndFeel : Route
    @Serializable data object Playback : Route
    @Serializable data object ReaderDefaults : Route
    @Serializable data object About : Route
    @Serializable data object EditProfile : Route
    @Serializable data object Updates : Route

    // Onboarding (O.1–O.8; O.9 is a tooltip on 1.1)
    @Serializable data object Splash : Route
    @Serializable data class Welcome(val page: Int) : Route
    @Serializable data object ChooseSources : Route
    @Serializable data object YourProfile : Route
    @Serializable data object Age : Route
    @Serializable data object MakeItYours : Route
}
