package echo.web

import dev.brahmkshatriya.echo.common.helpers.PagedData
import dev.brahmkshatriya.echo.common.models.Feed
import dev.brahmkshatriya.echo.common.models.Tab
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Registers a feed and opens its default tab. */
suspend fun openNew(feed: Feed<*>): FeedDto = openFeed(feed, Store.feeds.put(feed), null)

/** Opens [feed] at [tabId] (or its first non-sort tab) and registers the resulting pages. */
@Suppress("UNCHECKED_CAST")
suspend fun openFeed(feed: Feed<*>, feedId: String, tabId: String?): FeedDto {
    val typed = feed as Feed<Any>
    val tabs: List<Tab> = typed.notSortTabs
    val tab = tabId?.let { id -> tabs.firstOrNull { it.id == id } } ?: tabs.firstOrNull()
    val data = typed.getPagedData(tab)
    val pagedId = Store.pages.put(data.pagedData)
    return FeedDto(
        feedId = feedId,
        pagedId = pagedId,
        tabs = tabs,
        selectedTab = tab?.id,
        showSearch = data.buttons?.showSearch ?: true,
        showSort = data.buttons?.showSort ?: true,
        showPlayAndShuffle = data.buttons?.showPlayAndShuffle ?: false,
        background = Codec.imageJson(data.background),
        customTracks = data.buttons?.customTrackList?.map { Codec.mediaJson(it) },
    )
}

/** Feed result for extension calls that may return no feed. */
fun emptyFeed() = FeedDto()

/** Loads one page of an opened feed. Returns null when the page has expired. */
@Suppress("UNCHECKED_CAST")
suspend fun loadPage(pagedId: String, continuation: String?): PageDto? {
    val paged = Store.pages.get(pagedId) ?: return null
    val page = withContext(Dispatchers.IO) { (paged as PagedData<Any>).loadPage(continuation) }
    return PageDto(page.data.map { Codec.pageItem(it) }, page.continuation)
}
