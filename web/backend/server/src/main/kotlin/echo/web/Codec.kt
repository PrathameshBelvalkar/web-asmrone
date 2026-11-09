package echo.web

import dev.brahmkshatriya.echo.common.models.EchoMediaItem
import dev.brahmkshatriya.echo.common.models.ImageHolder
import dev.brahmkshatriya.echo.common.models.Lyrics
import dev.brahmkshatriya.echo.common.models.Shelf
import dev.brahmkshatriya.echo.common.models.Streamable
import io.ktor.server.plugins.BadRequestException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull

/** JSON encoding/decoding shared by routes. Media items are polymorphic (`mediaItemType`). */
object Codec {
    val json = Json {
        encodeDefaults = true
        ignoreUnknownKeys = true
    }

    fun mediaJson(item: EchoMediaItem): JsonElement {
        rememberImage(item.cover)
        rememberImage(item.background)
        return json.encodeToJsonElement(EchoMediaItem.serializer(), item)
    }

    fun decodeMedia(el: JsonElement?): EchoMediaItem {
        val value = el ?: throw BadRequestException("Missing media item")
        return json.decodeFromJsonElement(EchoMediaItem.serializer(), value)
    }

    fun imageJson(holder: ImageHolder?): JsonElement {
        if (holder == null) return JsonNull
        rememberImage(holder)
        return json.encodeToJsonElement(ImageHolder.serializer(), holder)
    }

    fun mediaResponseJson(media: Streamable.Media): JsonElement {
        if (media is Streamable.Media.Server) {
            media.sources.forEach {
                if (it is Streamable.Source.Http) IssuedUrls.add(it.request.url)
            }
        }
        return json.encodeToJsonElement(Streamable.Media.serializer(), media)
    }

    /** Items placed in a feed page: shelves for shelf feeds, media for track/album feeds, etc. */
    fun pageItem(value: Any): JsonElement = when (value) {
        is Shelf -> json.encodeToJsonElement(ShelfDto.serializer(), shelfDto(value))
        is EchoMediaItem -> mediaJson(value)
        is Lyrics -> json.encodeToJsonElement(Lyrics.serializer(), value)
        else -> error("Unsupported feed item: ${value::class.qualifiedName}")
    }

    fun shelfDto(shelf: Shelf): ShelfDto = when (shelf) {
        is Shelf.Lists.Items -> ShelfDto(
            kind = "items", id = shelf.id, title = shelf.title, subtitle = shelf.subtitle,
            horizontal = shelf.type == Shelf.Lists.Type.Linear,
            moreFeedId = shelf.more?.let { Store.feeds.put(it) },
            items = shelf.list.map { mediaJson(it) },
        )

        is Shelf.Lists.Tracks -> ShelfDto(
            kind = "tracks", id = shelf.id, title = shelf.title, subtitle = shelf.subtitle,
            horizontal = shelf.type == Shelf.Lists.Type.Linear,
            moreFeedId = shelf.more?.let { Store.feeds.put(it) },
            items = shelf.list.map { mediaJson(it) },
        )

        is Shelf.Lists.Categories -> ShelfDto(
            kind = "categories", id = shelf.id, title = shelf.title, subtitle = shelf.subtitle,
            horizontal = shelf.type == Shelf.Lists.Type.Linear,
            moreFeedId = shelf.more?.let { Store.feeds.put(it) },
            categories = shelf.list.map { categoryDto(it) },
        )

        is Shelf.Item -> ShelfDto(
            kind = "item", id = shelf.id, title = shelf.title,
            item = mediaJson(shelf.media),
        )

        is Shelf.Category -> ShelfDto(
            kind = "category", id = shelf.id, title = shelf.title,
            category = categoryDto(shelf),
        )
    }

    fun categoryDto(c: Shelf.Category) = CategoryDto(
        id = c.id,
        title = c.title,
        subtitle = c.subtitle,
        image = imageJson(c.image),
        backgroundColor = c.backgroundColor,
        feedId = c.feed?.let { Store.feeds.put(it) },
    )

    private fun rememberImage(holder: ImageHolder?) {
        if (holder is ImageHolder.NetworkRequestImageHolder) IssuedUrls.add(holder.request.url)
    }
}
