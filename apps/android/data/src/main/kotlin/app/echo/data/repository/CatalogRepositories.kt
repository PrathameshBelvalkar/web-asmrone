package app.echo.data.repository

import app.echo.data.model.ArtistPage
import app.echo.data.model.FeedPeriod
import app.echo.data.model.GenreGroup
import app.echo.data.model.HentaiTag
import app.echo.data.model.Lyric
import app.echo.data.model.MovieList
import app.echo.data.model.AsmrHome
import app.echo.data.model.AsmrSearchResults
import app.echo.data.model.Gallery
import app.echo.data.model.HentaiTitle
import app.echo.data.model.Idol
import app.echo.data.model.Movie
import app.echo.data.model.NewsCategory
import app.echo.data.model.NewsPost
import app.echo.data.model.Shelf
import app.echo.data.model.Tag
import app.echo.data.model.Work
import kotlinx.coroutines.flow.Flow

/*
 * One repository per section (design.md §5.3). Each call is a cold Flow that emits Loading, then Content / Empty /
 * Error. The fake implementations serve FakeCatalog; the real ones will wrap the :services scrapers.
 */

interface AsmrRepository {
    fun home(tab: Int): Flow<Load<AsmrHome>>
    fun work(id: String): Flow<Load<Work>>
    /** By id or by name (work chips carry names). */
    fun artist(id: String): Flow<Load<ArtistPage>>
    fun search(query: String): Flow<Load<AsmrSearchResults>>
    /** 1.2 TRENDING chips. */
    fun trendingSearches(): Flow<List<String>>
    /** 1.2 SUGGESTIONS while typing. */
    fun suggestions(query: String): Flow<List<String>>
    /** 1.4 Feed: tab 1 Popular · 2 New · 3 Recommended, over [period]. */
    fun feed(tab: Int, period: FeedPeriod): Flow<Load<List<Work>>>
    /** 1.10 synced lyrics of a track; empty when it has none. */
    fun lyrics(trackId: String): Flow<List<Lyric>>
    /** 1.5 "More like this". */
    fun similar(workId: String): Flow<Load<List<Work>>>
}

interface MangaRepository {
    fun browse(tab: Int): Flow<Load<List<Gallery>>>
    fun gallery(id: String): Flow<Load<Gallery>>
    fun search(query: String): Flow<Load<List<Gallery>>>
    fun tags(): Flow<Load<List<Tag>>>
    fun byTag(tagId: String): Flow<Load<List<Gallery>>>
    fun byArtist(name: String): Flow<Load<List<Gallery>>>
    fun artists(): Flow<Load<List<Tag>>>
}

interface JavRepository {
    fun news(category: NewsCategory?): Flow<Load<List<NewsPost>>>
    fun newsPost(id: String): Flow<Load<NewsPost>>
    fun latest(): Flow<Load<List<Movie>>>
    fun movies(page: Int): Flow<Load<List<Movie>>>
    fun movie(id: String): Flow<Load<Movie>>
    fun idols(): Flow<Load<List<Idol>>>
    fun idol(id: String): Flow<Load<Pair<Idol, List<Movie>>>>
    fun genres(): Flow<Load<List<Tag>>>
    /** 3.10: genres in their groups. */
    fun genreGroups(): Flow<Load<List<GenreGroup>>>
    /**
     * 3.5: the movies of a list. [filter] is "all", a genre id ("genre-3"), "studio:<name>" or "director:<name>".
     */
    fun movieList(filter: String): Flow<Load<MovieList>>
    fun search(query: String): Flow<Load<List<Movie>>>
}

interface HentaiRepository {
    fun home(): Flow<Load<List<Shelf<HentaiTitle>>>>
    fun titles(page: Int): Flow<Load<List<HentaiTitle>>>
    fun title(id: String): Flow<Load<HentaiTitle>>
    fun search(query: String): Flow<Load<List<HentaiTitle>>>
    fun seasons(): Flow<Load<List<Shelf<HentaiTitle>>>>
    /** H.3 / H.4: the whole catalogue; the screen sorts and filters it. */
    fun catalog(): Flow<Load<List<HentaiTitle>>>
    /** H.2 / H.4 tags with their groups and counts. */
    fun tags(): Flow<Load<List<HentaiTag>>>
    /** H.2 "Studios & brands", H.6 STUDIOS: studio names with title counts. */
    fun studios(): Flow<Load<List<Tag>>>
}
