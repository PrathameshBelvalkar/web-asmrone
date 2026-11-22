package app.echo.data.repository

import app.echo.data.model.Artist
import app.echo.data.model.AsmrHome
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
    fun artist(id: String): Flow<Load<Pair<Artist, List<Work>>>>
    fun search(query: String): Flow<Load<List<Work>>>
    fun feed(): Flow<Load<List<Work>>>
}

interface MangaRepository {
    fun browse(tab: Int): Flow<Load<List<Gallery>>>
    fun gallery(id: String): Flow<Load<Gallery>>
    fun search(query: String): Flow<Load<List<Gallery>>>
    fun tags(): Flow<Load<List<Tag>>>
    fun byTag(tagId: String): Flow<Load<List<Gallery>>>
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
    fun search(query: String): Flow<Load<List<Movie>>>
}

interface HentaiRepository {
    fun home(): Flow<Load<List<Shelf<HentaiTitle>>>>
    fun titles(page: Int): Flow<Load<List<HentaiTitle>>>
    fun title(id: String): Flow<Load<HentaiTitle>>
    fun search(query: String): Flow<Load<List<HentaiTitle>>>
    fun seasons(): Flow<Load<List<Shelf<HentaiTitle>>>>
}
