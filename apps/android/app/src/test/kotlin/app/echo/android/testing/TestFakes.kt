package app.echo.android.testing

import app.echo.data.model.ContinueItem
import app.echo.data.model.Playlist
import app.echo.data.model.PlaylistPrivacy
import app.echo.data.model.Section
import app.echo.data.model.Track
import app.echo.data.repository.LibraryRepository
import app.echo.data.repository.PlaylistRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.rules.TestWatcher
import org.junit.runner.Description

/** viewModelScope runs on Dispatchers.Main; tests swap in a test dispatcher. */
@OptIn(ExperimentalCoroutinesApi::class)
class MainDispatcherRule(val dispatcher: TestDispatcher = UnconfinedTestDispatcher()) : TestWatcher() {
    override fun starting(description: Description) = Dispatchers.setMain(dispatcher)
    override fun finished(description: Description) = Dispatchers.resetMain()
}

/** In-memory [LibraryRepository] for ViewModel tests. */
class FakeLibrary(items: List<ContinueItem> = emptyList()) : LibraryRepository {
    val items = MutableStateFlow(items)
    val searches = MutableStateFlow<Map<Section, List<String>>>(emptyMap())

    override val continueAll: Flow<List<ContinueItem>> = this.items.map { l -> l.filterNot { it.finished } }
    override fun continueIn(section: Section) = items.map { l -> l.filter { it.section == section && !it.finished } }
    override fun history(section: Section) = items.map { l -> l.filter { it.section == section } }
    override suspend fun clearHistory(section: Section) { items.value = items.value.filterNot { it.section == section } }
    override suspend fun removeWatched(section: Section, id: String) { items.value = items.value.filterNot { it.id == id } }
    override fun recentSearches(section: Section) = searches.map { it[section].orEmpty() }
    override suspend fun addSearch(section: Section, query: String) {
        searches.value = searches.value + (section to (listOf(query) + searches.value[section].orEmpty().minus(query)))
    }
    override suspend fun removeSearch(section: Section, query: String) {
        searches.value = searches.value + (section to searches.value[section].orEmpty().minus(query))
    }
}

/** In-memory [PlaylistRepository] for ViewModel tests. */
class FakePlaylists : PlaylistRepository {
    private val lists = MutableStateFlow<Map<Long, Pair<Playlist, List<Track>>>>(emptyMap())
    private val likedTracks = MutableStateFlow<List<Track>>(emptyList())
    private var nextId = 1L

    override val playlists = lists.map { m -> m.values.map { (p, t) -> p.copy(trackCount = t.size) } }
    override val liked: Flow<List<Track>> = likedTracks
    override fun tracks(playlistId: Long) = lists.map { it[playlistId]?.second.orEmpty() }
    override fun isLiked(trackId: String) = likedTracks.map { l -> l.any { it.id == trackId } }
    override suspend fun create(name: String, privacy: PlaylistPrivacy): Long {
        val id = nextId++
        lists.value = lists.value + (id to (Playlist(id, name, privacy, 0) to emptyList()))
        return id
    }
    override suspend fun rename(id: Long, name: String, privacy: PlaylistPrivacy) {
        lists.value[id]?.let { (p, t) -> lists.value = lists.value + (id to (p.copy(name = name, privacy = privacy) to t)) }
    }
    override suspend fun delete(id: Long) { lists.value = lists.value - id }
    override suspend fun add(playlistId: Long, track: Track) = update(playlistId) { it + track }
    override suspend fun move(playlistId: Long, from: Int, to: Int) = update(playlistId) { it.toMutableList().apply { add(to, removeAt(from)) } }
    override suspend fun remove(playlistId: Long, position: Int) = update(playlistId) { it.filterIndexed { i, _ -> i != position } }
    override suspend fun setLiked(track: Track, liked: Boolean) {
        likedTracks.value = if (liked) likedTracks.value + track else likedTracks.value.filterNot { it.id == track.id }
    }
    private fun update(id: Long, change: (List<Track>) -> List<Track>) {
        lists.value[id]?.let { (p, t) -> lists.value = lists.value + (id to (p to change(t))) }
    }
}
