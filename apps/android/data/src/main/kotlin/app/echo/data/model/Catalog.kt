package app.echo.data.model

/*
 * What the sites return, as the screens need it. The fake catalogue fills these now; the real services (:services)
 * map their results to the same types later.
 */

// ASMR ----------------------------------------------------------------------------------------------------------

data class Work(
    val id: String,
    val title: String,
    val circle: String,
    val voiceActors: List<String> = emptyList(),
    val code: String? = null,
    val coverUrl: String? = null,
    val tags: List<String> = emptyList(),
    val description: String? = null,
    val tracks: List<Track> = emptyList(),
    val totalDurationMs: Long = tracks.sumOf { it.durationMs },
)

enum class ArtistKind { VOICE_ACTOR, CIRCLE }

data class Artist(
    val id: String,
    val name: String,
    val workCount: Int,
    val imageUrl: String? = null,
    val kind: ArtistKind = ArtistKind.VOICE_ACTOR,
)

/** 1.4 Feed time range. */
enum class FeedPeriod { TODAY, WEEK, MONTH, ALL }

/** A lyric line (1.10): when it starts, the translated text, and the Japanese original. */
data class Lyric(val timeMs: Long, val text: String, val original: String? = null)

/** 1.6 Artist page. */
data class ArtistPage(val artist: Artist, val popular: List<Work>, val latest: List<Work>, val appearsWith: List<Artist>)

/** 1.3 Search results: every kind at once ("All"), each filter shows one list. */
data class AsmrSearchResults(val works: List<Work>, val artists: List<Artist>, val tracks: List<Track>) {
    val isEmpty: Boolean get() = works.isEmpty() && artists.isEmpty() && tracks.isEmpty()
}

/** 1.1 Home for one tab (For you · Popular · New · Recommended). */
data class AsmrHome(val featured: List<Work>, val trending: List<Track>, val shelves: List<Shelf<Work>>)

// Manga ---------------------------------------------------------------------------------------------------------

data class Gallery(
    val id: String,
    val title: String,
    val artist: String?,
    val pageCount: Int,
    val language: String,
    val category: String = "Doujinshi",
    val coverUrl: String? = null,
    val tags: List<String> = emptyList(),
    val addedOn: String = "2026-11-18",
    val parodies: List<String> = emptyList(),
    val characters: List<String> = emptyList(),
    val groups: List<String> = emptyList(),
)

data class Tag(val id: String, val name: String, val count: Int)

// JAV -----------------------------------------------------------------------------------------------------------

data class Movie(
    val id: String,
    val code: String,
    val title: String,
    val studio: String,
    val releaseDate: String,
    val durationMin: Int,
    val idols: List<String> = emptyList(),
    val genres: List<String> = emptyList(),
    val coverUrl: String? = null,
    val sampleImages: List<String?> = emptyList(),
    val director: String = "Director Name",
    /** 3.3 / 3.11 Censored · Uncensored. */
    val censored: Boolean = true,
    /** Announced but not out yet (3.3 Upcoming, 3.9 Upcoming); hidden when S.5 "Hide upcoming movies" is on. */
    val upcoming: Boolean = false,
    /** For the 3.4 sorts Most viewed and Top rated. */
    val views: Int = 0,
    val rating: Float = 0f,
)

data class Idol(
    val id: String,
    val name: String,
    val movieCount: Int,
    val imageUrl: String? = null,
    val debutYear: Int = 2021,
    val active: Boolean = true,
    val agency: String = "Agency A",
)

/** A 3.10 genre group ("Format", "Story" …) and its genres. */
data class GenreGroup(val name: String, val genres: List<Tag>)

/** What a 3.5 movie list shows. */
enum class MovieListKind { ALL, STUDIO, GENRE, DIRECTOR }

/** A 3.5 movie list: a studio's, a genre's or a director's movies. */
data class MovieList(val title: String, val kind: MovieListKind, val count: Int, val movies: List<Movie>)

enum class NewsCategory { RELEASES, INDUSTRY, INTERVIEWS, RANKINGS }

data class NewsPost(
    val id: String,
    val headline: String,
    val category: NewsCategory,
    val published: String,
    val readMinutes: Int,
    val imageUrl: String? = null,
    val body: List<String> = emptyList(),
    /** 3.2 pull quote and image caption. */
    val pullQuote: String? = null,
    val caption: String? = null,
    /** 3.2 "Mentioned in this story": a movie (id, code), an idol (id, name) and a studio. */
    val movieId: String? = null,
    val movieCode: String? = null,
    val idolId: String? = null,
    val idolName: String? = null,
    val studio: String? = null,
)

// Hentai --------------------------------------------------------------------------------------------------------

data class HentaiTitle(
    val id: String,
    val title: String,
    val studio: String,
    val year: Int,
    val views: Long,
    val isNew: Boolean = false,
    val uncensored: Boolean = false,
    val coverUrl: String? = null,
    val posterUrl: String? = null,
    val episodes: List<Episode> = emptyList(),
    val tags: List<String> = emptyList(),
)

data class Episode(val number: Int, val title: String, val durationMs: Long, val videoUrl: String? = null)

// Shared --------------------------------------------------------------------------------------------------------

/** A titled row of items on a home screen ("Continue listening", "Trending this week"…). */
data class Shelf<T>(val title: String, val items: List<T>)
