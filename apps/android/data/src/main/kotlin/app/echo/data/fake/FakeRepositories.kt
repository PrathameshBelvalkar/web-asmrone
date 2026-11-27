package app.echo.data.fake

import app.echo.data.model.MovieListKind
import app.echo.data.model.MovieList
import app.echo.data.model.ArtistPage
import app.echo.data.model.AsmrHome
import app.echo.data.model.FeedPeriod
import app.echo.data.model.Lyric
import app.echo.data.model.AsmrSearchResults
import app.echo.data.model.HentaiTitle
import app.echo.data.model.NewsCategory
import app.echo.data.model.Shelf
import app.echo.data.repository.AsmrRepository
import app.echo.data.repository.ErrorKind
import app.echo.data.repository.HentaiRepository
import app.echo.data.repository.JavRepository
import app.echo.data.repository.Load
import app.echo.data.repository.MangaRepository
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf

/**
 * Emits Loading, waits [FakeConfig.latencyMs], then [value] — or what [FakeConfig.forced] says. A null or empty
 * value is [Load.Empty]; a missing id is [ErrorKind.NOT_FOUND].
 */
internal fun <T> FakeConfig.serve(value: () -> T?): Flow<Load<T>> = flow {
    emit(Load.Loading)
    when (val f = forced.value) {
        ForcedState.Loading -> awaitCancellation()
        ForcedState.Empty -> { delay(latencyMs.value); emit(Load.Empty) }
        is ForcedState.Error -> { delay(latencyMs.value); emit(Load.Error(f.kind)) }
        ForcedState.None -> {
            delay(latencyMs.value)
            val v = value()
            emit(
                when {
                    v == null -> Load.Error(ErrorKind.NOT_FOUND)
                    v is Collection<*> && v.isEmpty() -> Load.Empty
                    v is AsmrSearchResults && v.isEmpty -> Load.Empty
                    else -> Load.Content(v)
                },
            )
        }
    }
}

private fun String.matches(query: String) = contains(query.trim(), ignoreCase = true)

class FakeAsmrRepository(private val config: FakeConfig) : AsmrRepository {
    private val c = FakeCatalog
    override fun home(tab: Int) = config.serve {
        val works = c.works.drop(tab % 2).let { it + c.works.take(tab % 2) }
        AsmrHome(
            featured = works.take(4),
            // One track per work, a different one each (Figma: "01 · Opening, whispered", "03 · Rain and heartbeat").
            trending = works.mapIndexed { i, w -> w.tracks[(i * 2) % w.tracks.size] }.take(6),
            shelves = listOf(Shelf("New releases", works.reversed()), Shelf("Popular circles", works)),
        )
    }
    override fun work(id: String) = config.serve { c.works.firstOrNull { it.id == id } }
    override fun artist(id: String) = config.serve {
        c.artists.firstOrNull { it.id == id || it.name.equals(id, ignoreCase = true) }?.let { a ->
            val works = c.works.filter { a.name == it.circle || a.name in it.voiceActors }.ifEmpty { c.works.take(3) }
            val names = works.flatMap { it.voiceActors + it.circle }.toSet() - a.name
            ArtistPage(a, popular = works, latest = works.reversed(), appearsWith = c.artists.filter { it.name in names })
        }
    }
    override fun search(query: String) = config.serve {
        val words = query.trim().split(' ').filter { it.isNotBlank() }
        fun String.hit() = words.any { matches(it) }
        val works = c.works.filter { it.title.hit() || it.circle.hit() || it.tags.any { t -> t.hit() } }
        // Artists whose name matches, or who made a matching work (Figma: "rain" lists Aoi Mizuno, Hana Seto…).
        val makers = works.flatMap { it.voiceActors + it.circle }.toSet()
        AsmrSearchResults(
            works = works,
            artists = c.artists.filter { it.name.hit() || it.name in makers },
            tracks = c.works.flatMap { it.tracks }.filter { it.title.hit() }.distinctBy { it.title },
        )
    }
    override fun trendingSearches() = flowOf(listOf("rain sounds", "binaural", "no talking", "heartbeat", "ear cleaning"))
    override fun suggestions(query: String) = flowOf(
        if (query.isBlank()) emptyList()
        else listOf("rain sounds", "rain and thunder, binaural", "rainy café whispers", "rain + ear cleaning", "ear cleaning binaural",
            "heartbeat", "soft tapping", "whispered story").filter { it.matches(query) || query.trim().split(' ').any { w -> it.matches(w) } }.take(4),
    )
    override fun feed(tab: Int, period: FeedPeriod) = config.serve {
        val shift = (tab + period.ordinal) % c.works.size
        (c.works.drop(shift) + c.works.take(shift)).let { it + it.reversed() }.distinctBy { it.id }.let { it + it.map { w -> w.copy(id = w.id + "b") } }
    }
    override fun lyrics(trackId: String) = flowOf(
        FakeCatalog.lyricLines.mapIndexed { i, (text, original) -> Lyric(i * 12_000L, text, original) },
    )
    override fun similar(workId: String) = config.serve {
        val work = c.works.firstOrNull { it.id == workId } ?: return@serve null
        c.works.filter { it.id != workId && it.tags.any { t -> t in work.tags } }.ifEmpty { c.works.filter { it.id != workId }.take(4) }
    }
}

class FakeMangaRepository(private val config: FakeConfig) : MangaRepository {
    private val c = FakeCatalog
    override fun browse(tab: Int) = config.serve { c.galleries.drop(tab * 3) + c.galleries.take(tab * 3) }
    override fun gallery(id: String) = config.serve { c.galleries.firstOrNull { it.id == id } }
    override fun search(query: String) = config.serve { c.galleries.filter { it.title.matches(query) || it.tags.any { t -> t.matches(query) } } }
    override fun tags() = config.serve { c.tags }
    override fun byTag(tagId: String) = config.serve { c.galleries.filterIndexed { i, _ -> i % 2 == tagId.length % 2 } }
    override fun byArtist(name: String) = config.serve { c.galleries.filter { it.artist == name } }
    override fun artists() = config.serve { c.mangaArtists }
}

class FakeJavRepository(private val config: FakeConfig) : JavRepository {
    private val c = FakeCatalog
    private val released get() = c.movies.filter { !it.upcoming }
    override fun news(category: NewsCategory?) = config.serve { c.news.filter { category == null || it.category == category } }
    override fun newsPost(id: String) = config.serve { c.news.firstOrNull { it.id == id } }
    /** Released and upcoming, newest first; 3.3 filters them. */
    override fun latest() = config.serve { c.movies }
    override fun movies(page: Int) = config.serve { released.drop(page * PAGE).take(PAGE) }
    override fun movie(id: String) = config.serve { c.movies.firstOrNull { it.id == id } }
    override fun idols() = config.serve { c.idols }
    override fun idol(id: String) = config.serve { c.idols.firstOrNull { it.id == id }?.let { i -> i to c.movies.filter { i.name in it.idols } } }
    override fun genres() = config.serve { c.genres }
    override fun genreGroups() = config.serve { c.genreGroups }
    override fun movieList(filter: String) = config.serve {
        val genre = c.genres.firstOrNull { it.id == filter }
        when {
            genre != null -> released.filter { genre.name in it.genres }.let { MovieList(genre.name, MovieListKind.GENRE, it.size, it) }
            filter.startsWith(STUDIO) -> filter.removePrefix(STUDIO).let { name ->
                released.filter { it.studio == name }.let { MovieList(name, MovieListKind.STUDIO, it.size, it) }
            }
            filter.startsWith(DIRECTOR) -> filter.removePrefix(DIRECTOR).let { name ->
                released.filter { it.director == name }.let { MovieList(name, MovieListKind.DIRECTOR, it.size, it) }
            }
            else -> MovieList("All movies", MovieListKind.ALL, released.size, released)
        }
    }
    override fun search(query: String) = config.serve { c.movies.filter { it.code.matches(query) || it.title.matches(query) } }

    private companion object {
        const val PAGE = 20
        const val STUDIO = "studio:"
        const val DIRECTOR = "director:"
    }
}

class FakeHentaiRepository(private val config: FakeConfig) : HentaiRepository {
    private val c = FakeCatalog
    override fun home() = config.serve {
        listOf(
            Shelf("New uploads", c.hentaiTitles.sortedByDescending { it.added }.take(10)),
            Shelf("Trending this week", c.hentaiTitles.sortedByDescending { it.trending }.take(10)),
            Shelf("Most viewed", c.hentaiTitles.sortedByDescending { it.views }.take(10)),
        )
    }
    override fun titles(page: Int) = config.serve { c.hentaiTitles.drop(page * 12).take(12) }

    /** H.10: "blocked", "busy" and "novideo" show the three title states. */
    override fun title(id: String): Flow<Load<HentaiTitle>> = when (id) {
        BLOCKED -> flowOf(Load.Error(ErrorKind.BLOCKED))
        BUSY -> flowOf(Load.Error(ErrorKind.BUSY))
        NO_VIDEO -> flowOf(Load.Error(ErrorKind.NO_VIDEO))
        else -> config.serve { c.hentaiTitles.firstOrNull { it.id == id } }
    }

    override fun search(query: String) = config.serve {
        c.hentaiTitles.filter { it.title.matches(query) || it.studio.matches(query) || it.series.orEmpty().matches(query) }
    }

    /** Season shelves, newest first ("Fall 2025" …). */
    override fun seasons() = config.serve {
        c.hentaiTitles.sortedByDescending { it.released }.groupBy { it.season }.map { (season, list) -> Shelf(season, list) }
    }
    override fun catalog() = config.serve { c.hentaiTitles }
    override fun tags() = config.serve { c.hentaiTags }
    override fun studios() = config.serve { c.hentaiStudioTags }

    companion object {
        const val BLOCKED = "blocked"
        const val BUSY = "busy"
        const val NO_VIDEO = "novideo"
    }
}
