package app.echo.data.fake

import app.echo.data.model.AsmrHome
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
            trending = works.flatMap { it.tracks.take(1) }.take(6),
            shelves = listOf(Shelf("New releases", works.reversed()), Shelf("Popular circles", works)),
        )
    }
    override fun work(id: String) = config.serve { c.works.firstOrNull { it.id == id } }
    override fun artist(id: String) = config.serve {
        c.artists.firstOrNull { it.id == id }?.let { a -> a to c.works.filter { a.name == it.circle || a.name in it.voiceActors } }
    }
    override fun search(query: String) = config.serve { c.works.filter { it.title.matches(query) || it.circle.matches(query) || it.tags.any { t -> t.matches(query) } } }
    override fun feed() = config.serve { c.works }
}

class FakeMangaRepository(private val config: FakeConfig) : MangaRepository {
    private val c = FakeCatalog
    override fun browse(tab: Int) = config.serve { c.galleries.drop(tab * 3) + c.galleries.take(tab * 3) }
    override fun gallery(id: String) = config.serve { c.galleries.firstOrNull { it.id == id } }
    override fun search(query: String) = config.serve { c.galleries.filter { it.title.matches(query) || it.tags.any { t -> t.matches(query) } } }
    override fun tags() = config.serve { c.tags }
    override fun byTag(tagId: String) = config.serve { c.galleries.filterIndexed { i, _ -> i % 2 == tagId.length % 2 } }
    override fun artists() = config.serve { c.mangaArtists }
}

class FakeJavRepository(private val config: FakeConfig) : JavRepository {
    private val c = FakeCatalog
    override fun news(category: NewsCategory?) = config.serve { c.news.filter { category == null || it.category == category } }
    override fun newsPost(id: String) = config.serve { c.news.firstOrNull { it.id == id } }
    override fun latest() = config.serve { c.movies.take(10) }
    override fun movies(page: Int) = config.serve { c.movies.drop(page * 10).take(10) }
    override fun movie(id: String) = config.serve { c.movies.firstOrNull { it.id == id } }
    override fun idols() = config.serve { c.idols }
    override fun idol(id: String) = config.serve { c.idols.firstOrNull { it.id == id }?.let { i -> i to c.movies.filter { i.name in it.idols } } }
    override fun genres() = config.serve { c.genres }
    override fun search(query: String) = config.serve { c.movies.filter { it.code.matches(query) || it.title.matches(query) } }
}

class FakeHentaiRepository(private val config: FakeConfig) : HentaiRepository {
    private val c = FakeCatalog
    override fun home() = config.serve {
        listOf(
            Shelf("New uploads", c.hentaiTitles.filter { it.isNew }),
            Shelf("Trending this week", c.hentaiTitles.sortedByDescending { it.views }.take(8)),
        )
    }
    override fun titles(page: Int) = config.serve { c.hentaiTitles.drop(page * 12).take(12) }
    override fun title(id: String) = config.serve { c.hentaiTitles.firstOrNull { it.id == id } }
    override fun search(query: String) = config.serve { c.hentaiTitles.filter { it.title.matches(query) || it.studio.matches(query) } }
    override fun seasons() = config.serve {
        c.hentaiTitles.groupBy { it.year }.toSortedMap(compareByDescending { it }).map { (year, list) -> Shelf<HentaiTitle>("$year", list) }
    }
}
